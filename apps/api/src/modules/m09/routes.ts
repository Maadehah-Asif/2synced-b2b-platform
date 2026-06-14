/**
 * Module: Campaign Performance Optimization (m09)
 * Layer: Backend
 * File: routes.ts
 * Purpose: Supports the r ou te s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import { parse } from 'csv-parse/sync';
import UploadFile from '../m01/models/UploadFile.js';
import MergedDataset from './models/MergedDataset.js';
import { invokePythonRoiPrediction, loadRoiModelMetadata } from './services/pythonRoiInvoker.js';

const router = Router();

const CANONICAL_FIELDS = [
  'campaign_id',
  'campaign_name',
  'platform',
  'channel',
  'campaign_type',
  'period_start',
  'period_end',
  'spend',
  'impressions',
  'clicks',
  'conversions',
  'mqls',
  'sqls',
  'pipeline_revenue',
  'launch_weekday',
  'launch_hour_bucket',
  'touches_per_user',
  'fatigue_flag',
  'ctr',
  'cpl',
  'roi',
  'campaign_duration_days',
] as const;

type CanonicalField = (typeof CANONICAL_FIELDS)[number];
type CsvRow = Record<string, string>;
type CanonicalRow = Record<CanonicalField, string | number | boolean | null>;
type Mapping = Partial<Record<CanonicalField, string>>;

const NUMERIC_FIELDS = new Set<CanonicalField>([
  'spend',
  'impressions',
  'clicks',
  'conversions',
  'mqls',
  'sqls',
  'pipeline_revenue',
  'touches_per_user',
  'ctr',
  'cpl',
  'roi',
  'campaign_duration_days',
]);

const REQUIRED_USEFUL_FIELDS: CanonicalField[] = ['campaign_name', 'campaign_id'];

const ALIASES: Record<CanonicalField, string[]> = {
  campaign_id: ['campaign_id', 'campaign ref', 'external campaign id', 'campaignref', 'campaign id', 'id'],
  campaign_name: ['campaign_name', 'campaign name', 'sequence name', 'campaigntitle', 'campaign label', 'name'],
  platform: ['platform', 'channel', 'channel_hint', 'channel type'],
  channel: ['channel', 'platform', 'channel_hint', 'channel type'],
  campaign_type: ['campaign_type', 'campaign type', 'type'],
  period_start: ['period_start', 'period start', 'launch date', 'from_date', 'run start', 'start date'],
  period_end: ['period_end', 'period end', 'end date', 'to_date', 'run end'],
  spend: ['spend', 'spend gbp', 'budget (gbp)', 'est_cost_gbp', 'cost', 'budget'],
  impressions: ['impressions', 'impression_count', 'views'],
  clicks: ['clicks', 'response count', 'accepted invites', 'accepted', 'replies'],
  conversions: ['conversions', 'conversion_count', 'leads'],
  mqls: ['mqls', 'mql_count', 'mql count'],
  sqls: ['sqls', 'sql_count', 'sql count'],
  pipeline_revenue: ['pipeline_revenue', 'pipeline_value_gbp', 'pipeline revenue', 'pipeline value'],
  launch_weekday: ['launch_weekday', 'launch weekday', 'weekday_launched'],
  launch_hour_bucket: ['launch_hour_bucket', 'launch hour bucket', 'timing window', 'hour_bucket'],
  touches_per_user: ['touches_per_user', 'touches per user', 'touches / user'],
  fatigue_flag: ['fatigue_flag', 'fatigue flag'],
  ctr: ['ctr', 'click through rate', 'click-through rate'],
  cpl: ['cpl', 'cost per lead'],
  roi: ['roi', 'return on investment'],
  campaign_duration_days: ['campaign_duration_days', 'campaign duration days', 'duration days'],
};

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    module: 'm09',
    status: 'ready',
  });
});

router.get('/uploads/:id/preview', async (req, res) => {
  try {
    const workspace = getWorkspace(req, 'query');
    const upload = await getUploadForWorkspace(req.params.id, workspace, res);
    if (!upload) return;

    const parsed = await readUploadCsv(upload.fileId);
    const inferredTypes = inferTypes(parsed.rows);
    const suggestedMapping = suggestMapping(parsed.headers);

    return res.json({
      ok: true,
      uploadId: String(upload._id),
      fileName: upload.originalName || upload.filename || 'campaign.csv',
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 20),
      inferredTypes,
      summary: {
        rowCount: parsed.rows.length,
        columnCount: parsed.headers.length,
        fileSize: upload.length ?? null,
        contentType: upload.contentType ?? null,
      },
      suggestedMapping,
    });
  } catch (error) {
    return handleError(res, error, 'preview failed');
  }
});

router.post('/merge/validate', async (req, res) => {
  try {
    const body = req.body || {};
    const workspace = getWorkspace(req, 'body');
    const uploadIds = getUploadIds(body.uploadIds);
    if (uploadIds.length === 0) return res.status(400).json({ ok: false, error: 'uploadIds are required' });

    const result = await validateUploads(workspace, uploadIds, body.mappingsByUpload || {});
    return res.json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error, 'validation failed');
  }
});

router.post('/merge/run', async (req, res) => {
  try {
    const body = req.body || {};
    const workspace = getWorkspace(req, 'body');
    const uploadIds = getUploadIds(body.uploadIds);
    if (uploadIds.length === 0) return res.status(400).json({ ok: false, error: 'uploadIds are required' });

    const validation = await validateUploads(workspace, uploadIds, body.mappingsByUpload || {});
    if (!validation.canMerge) {
      return res.status(400).json({ ok: false, error: 'selected files are not ready to merge', files: validation.files });
    }

    const { normalizedRows, uploadNames } = await normalizeUploads(workspace, uploadIds, body.mappingsByUpload || {});
    const deduped = dedupeRows(normalizedRows);
    const headers = [...CANONICAL_FIELDS];
    const csvText = toCsv(headers, deduped.rows);
    const title = `Module 9 merged dataset ${new Date().toISOString().slice(0, 10)}`;
    const filename = `module9-merged-${Date.now()}.csv`;
    const stored = await saveMergedCsv(workspace, filename, csvText);
    const warnings = validation.files.flatMap((file) => file.issues.filter((issue) => issue.level === 'warning').map((issue) => `${file.fileName}: ${issue.message}`));
    const sampleRows = deduped.rows.slice(0, 20);
    const duplicateMethod = {
      exactKey: deduped.exactKeyDuplicates,
      fuzzyNameChannelWindow: deduped.fuzzyDuplicates,
    };
    const fuzzyThreshold = 'Names are compared after lowercasing, punctuation removal, space collapse, and 0.86 similarity threshold.';
    const created = await MergedDataset.create({
      title,
      filename,
      fileId: stored.fileId,
      contentType: 'text/csv',
      length: stored.length,
      workspace,
      sourceUploadIds: uploadIds,
      sourceUploadNames: uploadNames,
      rowCountBeforeMerge: normalizedRows.length,
      rowCountAfterMerge: deduped.rows.length,
      duplicateCount: deduped.duplicateCount,
      mergedCount: deduped.duplicateCount,
      headers,
      sampleRows,
      mapping: body.mappingsByUpload || {},
      mergeSummary: {
        duplicateCount: deduped.duplicateCount,
        mergedCount: deduped.duplicateCount,
        duplicateMethod,
        fuzzyThreshold,
      },
      validationSummary: { warnings },
      createdBy: getUserId(req),
    });

    return res.json({
      ok: true,
      mergedOutputId: String(created._id),
      title,
      rowCountBeforeMerge: normalizedRows.length,
      rowCountAfterMerge: deduped.rows.length,
      duplicateCount: deduped.duplicateCount,
      mergedCount: deduped.duplicateCount,
      warnings,
      sampleRows,
    });
  } catch (error) {
    return handleError(res, error, 'merge failed');
  }
});

router.get('/merged', async (req, res) => {
  try {
    const workspace = getWorkspace(req, 'query');
    const items = await (MergedDataset as any).find({ workspace }).sort({ createdAt: -1 }).lean();
    return res.json({
      ok: true,
      items: items.map((item: any) => formatMergedItem(item)),
    });
  } catch (error) {
    return handleError(res, error, 'merged list failed');
  }
});

router.get('/merged/:id', async (req, res) => {
  try {
    const workspace = getWorkspace(req, 'query');
    const item = await getMergedForWorkspace(req.params.id, workspace, res);
    if (!item) return;
    return res.json({
      ok: true,
      item: formatMergedItem(item),
      headers: item.headers || [],
      sampleRows: item.sampleRows || [],
      mergeSummary: item.mergeSummary || null,
      validationSummary: item.validationSummary || null,
    });
  } catch (error) {
    return handleError(res, error, 'merged detail failed');
  }
});

router.get('/merged/:id/download', async (req, res) => {
  try {
    const workspace = getWorkspace(req, 'query');
    const item = await getMergedForWorkspace(req.params.id, workspace, res);
    if (!item) return;
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ ok: false, error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm09_merged' });
    const downloadStream = bucket.openDownloadStream(item.fileId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${String(item.filename || 'module9-merged.csv').replace(/"/g, '')}"`);
    downloadStream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'download_failed' });
    });
    downloadStream.pipe(res);
  } catch (error) {
    return handleError(res, error, 'download failed');
  }
});

router.get('/simulator/baselines', async (req, res) => {
  try {
    const workspace = getWorkspace(req, 'query');
    const mergedId = String(req.query.mergedId || '');
    const item = await getMergedForWorkspace(mergedId, workspace, res);
    if (!item) return;
    const rows = await readMergedCsv(item.fileId);
    if (rows.rows.length === 0) return res.status(400).json({ ok: false, error: 'merged dataset has no rows' });

    const q = String(req.query.q || '').trim().toLowerCase();
    const channel = String(req.query.channel || '').trim().toLowerCase();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '10'), 10) || 10, 1), 100);
    const baselines = rows.rows.map((row, index) => buildBaselineItem(row, index)).filter((row) => row.campaign_name || row.campaign_id);
    const filtered = baselines.filter((row) => {
      const matchesQuery = !q || String(row.campaign_name || '').toLowerCase().includes(q) || String(row.campaign_id || '').toLowerCase().includes(q);
      const matchesChannel = !channel || String(row.channel || '').toLowerCase() === channel;
      return matchesQuery && matchesChannel;
    });
    const offset = (page - 1) * pageSize;
    return res.json({
      ok: true,
      page,
      pageSize,
      total: filtered.length,
      items: filtered.slice(offset, offset + pageSize),
    });
  } catch (error) {
    return handleError(res, error, 'baseline loading failed');
  }
});

router.post('/simulator/run', async (req, res) => {
  try {
    const body = req.body || {};
    const workspace = getWorkspace(req, 'body');
    const mergedId = String(body.mergedId || '');
    const baselineRowId = String(body.baselineRowId || '');
    const item = await getMergedForWorkspace(mergedId, workspace, res);
    if (!item) return;
    if (!baselineRowId) return res.status(400).json({ ok: false, error: 'baselineRowId is required' });

    const rows = await readMergedCsv(item.fileId);
    const baselineIndex = parseBaselineRowId(baselineRowId);
    const rawBaseline = baselineIndex >= 0 ? rows.rows[baselineIndex] : null;
    if (!rawBaseline) return res.status(404).json({ ok: false, error: 'baseline row not found' });

    const baseline = buildBaselineItem(rawBaseline, baselineIndex);
    const baselineRoiRaw = toNumber(rawBaseline.roi);
    const baselineRoi = clampRoi(baselineRoiRaw);
    const scenario = normalizeScenario(body.scenario || {}, baseline);
    const noChange = isNoChangeScenario(baseline, scenario);
    const modelMetadata = loadRoiModelMetadata();
    const predictionInput = buildPredictionPayload(rawBaseline, baseline, scenario);
    const predictionPayload = predictionInput.payload;
    const normalization = {
      raw_roi: baselineRoiRaw,
      normalized_roi: baselineRoi,
      min: -1,
      max: 5,
      clipped: baselineRoiRaw !== null && baselineRoiRaw !== baselineRoi,
    };

    let predictedRoi = baselineRoi;
    let pythonPredictedRoi: number | null = null;
    let pythonRaw: Record<string, unknown> | null = null;
    let explanation = 'No scenario changes detected; projected ROI is equal to the normalized baseline ROI.';
    if (!noChange) {
      if (process.env.M09_SIM_DEBUG === '1') {
        console.info('[m09.simulator] prediction payload', summarizePredictionPayload(predictionPayload));
      }
      const prediction = await invokePythonRoiPrediction(predictionPayload);
      pythonRaw = prediction.raw;
      pythonPredictedRoi = clampRoi(prediction.predicted_roi) ?? prediction.predicted_roi;
      predictedRoi = projectBaselineAwareRoi(baselineRoi, pythonPredictedRoi, baseline, scenario);
      explanation = buildExplanation(predictedRoi - (baselineRoi ?? 0), scenario, baseline);
    }

    const deltaRoi = round((predictedRoi ?? 0) - (baselineRoi ?? 0));
    const confidence = buildConfidence(deltaRoi, scenario, baseline, modelMetadata.r2);

    return res.json({
      ok: true,
      baseline: {
        rowId: baseline.rowId,
        campaign_id: baseline.campaign_id,
        campaign_name: baseline.campaign_name,
        channel: baseline.channel,
        roi: baselineRoi,
        raw_roi: baselineRoiRaw,
      },
      scenario,
      prediction: {
        predicted_roi: predictedRoi,
        delta_roi: deltaRoi,
        outcome: outcomeForDelta(deltaRoi),
        recommendation: recommendationForDelta(deltaRoi),
        confidence_label: confidence.label,
      },
      model: {
        model_type: modelMetadata.model_type,
        model_version: modelMetadata.model_version,
        mae: modelMetadata.mae,
        rmse: modelMetadata.rmse,
        r2: modelMetadata.r2,
      },
      technical: {
        predictionPayloadSummary: summarizePredictionPayload(predictionPayload),
        predictionPayloadUsed: summarizePredictionPayload(predictionPayload),
        baselineNormalization: normalization,
        baseline_roi: baselineRoi,
        projected_roi: predictedRoi,
        python_projected_roi: pythonPredictedRoi,
        fallbacksUsed: predictionInput.fallbacksUsed,
        baselineFeatureSummary: predictionInput.baselineFeatureSummary,
        noChangeDetected: noChange,
        confidence,
        pythonRaw,
        featureCount: modelMetadata.feature_names.length,
      },
      explanation,
    });
  } catch (error) {
    return handleError(res, error, 'simulation failed');
  }
});

function getWorkspace(req: Request, source: 'query' | 'body') {
  const value = source === 'query' ? req.query.workspace : req.body?.workspace;
  const workspace = String(value || '');
  if (!workspace || !mongoose.isValidObjectId(workspace)) {
    throw Object.assign(new Error('workspace is required'), { statusCode: 400 });
  }
  return workspace;
}

function getUploadIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id)).filter((id) => mongoose.isValidObjectId(id));
}

async function getUploadForWorkspace(id: string | undefined, workspace: string, res: Response) {
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(400).json({ ok: false, error: 'invalid upload id' });
    return null;
  }
  const upload = await UploadFile.findById(id).lean();
  if (!upload) {
    res.status(404).json({ ok: false, error: 'upload not found' });
    return null;
  }
  if (String(upload.workspace) !== workspace) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  if (upload.status === 'archived') {
    res.status(400).json({ ok: false, error: 'upload is archived' });
    return null;
  }
  const taggedModule = String((upload as any).module || upload.metadata?.module || '').toLowerCase();
  if (taggedModule && taggedModule !== 'm09') {
    res.status(400).json({ ok: false, error: 'upload is not tagged for module m09' });
    return null;
  }
  return upload;
}

async function getMergedForWorkspace(id: string | undefined, workspace: string, res: Response) {
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(400).json({ ok: false, error: 'invalid merged id' });
    return null;
  }
  const item: any = await (MergedDataset as any).findById(id).lean();
  if (!item) {
    res.status(404).json({ ok: false, error: 'merged output not found' });
    return null;
  }
  if (String(item.workspace) !== workspace) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return item;
}

async function readUploadCsv(fileId: unknown) {
  const db = mongoose.connection.db;
  if (!db) throw Object.assign(new Error('db not ready'), { statusCode: 500 });
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm01_uploads' });
  return parseCsv(await streamToText(bucket.openDownloadStream(fileId as mongoose.Types.ObjectId)));
}

async function readMergedCsv(fileId: unknown) {
  const db = mongoose.connection.db;
  if (!db) throw Object.assign(new Error('db not ready'), { statusCode: 500 });
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm09_merged' });
  return parseCsv(await streamToText(bucket.openDownloadStream(fileId as mongoose.Types.ObjectId)));
}

function parseCsv(text: string) {
  const records = parse(text, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];
  const headers = (records[0] || []).map((header, index) => String(header || `column_${index + 1}`).trim());
  const rows = records.slice(1).map((record) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = String(record[index] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function buildBaselineItem(row: CsvRow, index: number) {
  const roiRaw = toNumber(row.roi);
  return {
    rowId: `row-${index}`,
    campaign_id: cleanText(row.campaign_id),
    campaign_name: cleanText(row.campaign_name),
    channel: normalizeCategory(row.channel || row.platform),
    platform: normalizeCategory(row.platform || row.channel),
    campaign_type: normalizeCategory(row.campaign_type),
    segment: normalizeCategory((row as any).segment),
    launch_weekday: normalizeCategory(row.launch_weekday),
    launch_hour_bucket: cleanText(row.launch_hour_bucket),
    touches_per_user: toNumber(row.touches_per_user),
    spend: toNumber(row.spend),
    roi: clampRoi(roiRaw),
    raw_roi: roiRaw,
    ctr: toNumber(row.ctr),
    cpl: toNumber(row.cpl),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    conversions: toNumber(row.conversions),
    mqls: toNumber(row.mqls),
    sqls: toNumber(row.sqls),
    pipeline_revenue: toNumber(row.pipeline_revenue),
    campaign_duration_days: toNumber(row.campaign_duration_days),
  };
}

function parseBaselineRowId(rowId: string) {
  const matched = /^row-(\d+)$/.exec(rowId);
  if (!matched) return -1;
  return Number(matched[1]);
}

function normalizeScenario(input: Record<string, unknown>, baseline: ReturnType<typeof buildBaselineItem>) {
  return {
    spend: toNumber(input.spend) ?? baseline.spend,
    channel: normalizeCategory(input.channel) || baseline.channel || 'email',
    launch_weekday: normalizeCategory(input.launch_weekday) || baseline.launch_weekday || 'tuesday',
    launch_hour_bucket: cleanText(input.launch_hour_bucket) || baseline.launch_hour_bucket || '10:00-12:00',
    touches_per_user: toNumber(input.touches_per_user) ?? baseline.touches_per_user ?? 3,
  };
}

function isNoChangeScenario(baseline: ReturnType<typeof buildBaselineItem>, scenario: ReturnType<typeof normalizeScenario>) {
  return numbersEqual(baseline.spend, scenario.spend)
    && String(baseline.channel || '') === String(scenario.channel || '')
    && String(baseline.launch_weekday || '') === String(scenario.launch_weekday || '')
    && String(baseline.launch_hour_bucket || '') === String(scenario.launch_hour_bucket || '')
    && numbersEqual(baseline.touches_per_user, scenario.touches_per_user);
}

function buildPredictionPayload(raw: CsvRow, baseline: ReturnType<typeof buildBaselineItem>, scenario: ReturnType<typeof normalizeScenario>) {
  const fallbacksUsed: string[] = [];
  const spend = scenario.spend ?? baseline.spend ?? 0;
  const impressions = toNumber(raw.impressions);
  const clicks = toNumber(raw.clicks);
  const conversions = toNumber(raw.conversions);
  const mqls = toNumber(raw.mqls);
  const sqls = toNumber(raw.sqls);
  const ctr = toNumber((raw as any).ctr) ?? baseline.ctr ?? ratio(clicks, impressions);
  const conversionRate = toNumber((raw as any).conversion_rate) ?? ratio(conversions, clicks);
  const mqlRate = toNumber((raw as any).mql_rate) ?? ratio(mqls, conversions);
  const sqlRate = toNumber((raw as any).sql_rate) ?? ratio(sqls, mqls);
  const impressionsPerSpend = toNumber((raw as any).impressions_per_spend) ?? ratio(impressions, spend);
  const clicksPerSpend = toNumber((raw as any).clicks_per_spend) ?? ratio(clicks, spend);
  const segment = normalizeCategory((raw as any).segment) || deriveSegment(scenario.channel);
  const payload = {
    spend,
    touches_per_user: scenario.touches_per_user,
    campaign_duration_days: withPredictionFallback('campaign_duration_days', baseline.campaign_duration_days, 14, fallbacksUsed),
    fatigue_score: deriveFatigueScore(scenario.touches_per_user),
    ctr: withPredictionFallback('ctr', ctr, deriveChannelCtr(scenario.channel), fallbacksUsed),
    conversion_rate: withPredictionFallback('conversion_rate', conversionRate, deriveChannelConversionRate(scenario.channel), fallbacksUsed),
    mql_rate: withPredictionFallback('mql_rate', mqlRate, 0.62, fallbacksUsed),
    sql_rate: withPredictionFallback('sql_rate', sqlRate, 0.34, fallbacksUsed),
    impressions_per_spend: withPredictionFallback('impressions_per_spend', impressionsPerSpend, deriveChannelImpressionsPerSpend(scenario.channel), fallbacksUsed),
    clicks_per_spend: withPredictionFallback('clicks_per_spend', clicksPerSpend, deriveChannelClicksPerSpend(scenario.channel), fallbacksUsed),
    engagement_efficiency_score: withPredictionFallback(
      'engagement_efficiency_score',
      toNumber((raw as any).engagement_efficiency_score) ?? deriveEngagementEfficiency(ctr, conversionRate, mqlRate),
      deriveChannelEngagementEfficiency(scenario.channel),
      fallbacksUsed,
    ),
    timing_score: deriveTimingScore(scenario.launch_weekday, scenario.launch_hour_bucket),
    channel_quality_score: deriveChannelQualityScore(scenario.channel),
    segment_quality_score: deriveSegmentQualityScore(segment),
    channel: scenario.channel,
    campaign_type: normalizeCategory(raw.campaign_type) || deriveCampaignType(scenario.channel),
    launch_weekday: scenario.launch_weekday,
    launch_hour_bucket: scenario.launch_hour_bucket,
    segment,
  };
  return {
    payload,
    fallbacksUsed,
    baselineFeatureSummary: {
      ctr,
      conversion_rate: conversionRate,
      mql_rate: mqlRate,
      sql_rate: sqlRate,
      impressions_per_spend: impressionsPerSpend,
      clicks_per_spend: clicksPerSpend,
      campaign_duration_days: baseline.campaign_duration_days,
      campaign_type: normalizeCategory(raw.campaign_type) || null,
      segment: normalizeCategory((raw as any).segment) || null,
    },
  };
}

function withPredictionFallback(name: string, value: number | null, fallback: number, fallbacksUsed: string[]) {
  if (value !== null && Number.isFinite(value)) return round(value);
  fallbacksUsed.push(name);
  return fallback;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

function projectBaselineAwareRoi(
  baselineRoi: number | null,
  modelRoi: number,
  baseline: ReturnType<typeof buildBaselineItem>,
  scenario: ReturnType<typeof normalizeScenario>,
) {
  if (baselineRoi === null) return clampRoi(modelRoi) ?? modelRoi;

  const baselineScore = scenarioQualityScore({
    channel: baseline.channel,
    launch_weekday: baseline.launch_weekday,
    launch_hour_bucket: baseline.launch_hour_bucket,
    touches_per_user: baseline.touches_per_user,
  });
  const scenarioScore = scenarioQualityScore(scenario);
  const qualityDelta = scenarioScore - baselineScore;
  const directionalDelta = clamp(qualityDelta * 0.9, -0.75, 0.75);
  const rawModelDelta = clamp((modelRoi - baselineRoi) * 0.12, -0.22, 0.22);
  const modelDelta = constrainModelDeltaToScenarioDirection(rawModelDelta, qualityDelta);
  let projectedDelta = directionalDelta + modelDelta;

  if (Math.abs(projectedDelta) < 0.03 && Math.abs(qualityDelta) > 0.08) {
    projectedDelta = qualityDelta > 0 ? 0.06 : -0.06;
  }
  if (baselineRoi >= 4.75 && projectedDelta > 0) {
    projectedDelta = Math.min(projectedDelta, 5 - baselineRoi);
  }

  return round(clampRoi(baselineRoi + projectedDelta) ?? baselineRoi);
}

function scenarioQualityScore(input: {
  channel: string | null;
  launch_weekday: string | null;
  launch_hour_bucket: string | null;
  touches_per_user: number | null;
}) {
  const channelSignal = (deriveChannelQualityScore(input.channel) - 1) * 0.45;
  const timingSignal = (deriveTimingScore(input.launch_weekday, input.launch_hour_bucket) - 1) * 0.8;
  const fatigueSignal = touchQualitySignal(input.touches_per_user) * 0.65;
  return channelSignal + timingSignal + fatigueSignal;
}

function touchQualitySignal(touches: number | null) {
  if (touches === null) return 0;
  if (touches <= 2) return 0.05;
  if (touches <= 4) return 0.35;
  if (touches <= 6) return 0.1;
  if (touches <= 8) return -0.25;
  return -0.45;
}

function constrainModelDeltaToScenarioDirection(modelDelta: number, qualityDelta: number) {
  if (qualityDelta > 0.03 && modelDelta < 0) return Math.max(modelDelta, -0.03);
  if (qualityDelta < -0.03 && modelDelta > 0) return Math.min(modelDelta, 0.03);
  return modelDelta;
}

function summarizePredictionPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function buildExplanation(delta: number, scenario: ReturnType<typeof normalizeScenario>, baseline: ReturnType<typeof buildBaselineItem>) {
  const outcome = outcomeForDelta(delta);
  const spendText = numbersEqual(baseline.spend, scenario.spend) ? 'spend stayed flat' : `spend moved from ${baseline.spend ?? 'unknown'} to ${scenario.spend ?? 'unknown'}`;
  const channelText = baseline.channel === scenario.channel ? `channel stayed on ${scenario.channel}` : `channel changed from ${baseline.channel || 'unknown'} to ${scenario.channel}`;
  return `${outcome}. The projection used the selected baseline with ${spendText}, ${channelText}, timing ${scenario.launch_weekday}/${scenario.launch_hour_bucket}, and ${scenario.touches_per_user} touches per user.`;
}

function outcomeForDelta(delta: number) {
  if (delta > 0.05) return 'likely improvement';
  if (delta < -0.05) return 'likely decline';
  return 'minimal change';
}

function recommendationForDelta(delta: number) {
  if (delta > 0.35) return 'This scenario is likely to improve campaign efficiency.';
  if (delta > 0.05) return 'This scenario looks directionally stronger and may be worth testing.';
  if (delta < -0.35) return 'This change may reduce overall campaign ROI.';
  if (delta < -0.05) return 'This scenario may underperform the current baseline.';
  return 'The projected improvement is limited.';
}

function buildConfidence(delta: number, scenario: ReturnType<typeof normalizeScenario>, baseline: ReturnType<typeof buildBaselineItem>, r2: number | null) {
  const spendRatio = baseline.spend && scenario.spend ? scenario.spend / baseline.spend : 1;
  const touchDelta = Math.abs((scenario.touches_per_user ?? 0) - (baseline.touches_per_user ?? 0));
  const extreme = spendRatio > 2.5 || spendRatio < 0.35 || touchDelta > 6;
  const label = extreme ? 'exploratory result' : (r2 ?? 0) >= 0.9 && Math.abs(delta) >= 0.05 ? 'high confidence' : (r2 ?? 0) >= 0.75 ? 'medium confidence' : 'exploratory result';
  return {
    label,
    r2,
    extremeScenario: extreme,
    spendRatio: round(spendRatio),
    touchDelta,
  };
}

function inferTypes(rows: CsvRow[]) {
  const inferred: Record<string, string> = {};
  const headers = Object.keys(rows[0] || {});
  for (const header of headers) {
    const values = rows.map((row) => row[header]).filter((value): value is string => !!value);
    if (values.length === 0) {
      inferred[header] = 'text';
    } else if (values.every((value) => parseDate(value) !== null)) {
      inferred[header] = 'date';
    } else if (values.every((value) => parseNumber(value) !== null)) {
      inferred[header] = 'number';
    } else if (values.every((value) => ['true', 'false', 'yes', 'no', '0', '1'].includes(value.toLowerCase()))) {
      inferred[header] = 'boolean';
    } else {
      inferred[header] = 'text';
    }
  }
  return inferred;
}

function suggestMapping(headers: string[]) {
  const mapping: Mapping = {};
  const normalizedToHeader = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const field of CANONICAL_FIELDS) {
    const matched = ALIASES[field].map(normalizeHeader).find((alias) => normalizedToHeader.has(alias));
    if (matched) mapping[field] = normalizedToHeader.get(matched) || '';
  }
  return mapping;
}

async function validateUploads(workspace: string, uploadIds: string[], mappingsByUpload: Record<string, Mapping>) {
  const files = [];
  for (const uploadId of uploadIds) {
    const upload = await getUploadForValidation(uploadId, workspace);
    const parsed = await readUploadCsv(upload.fileId);
    const autoMapping = suggestMapping(parsed.headers);
    const mapping = cleanMapping({ ...autoMapping, ...(mappingsByUpload[uploadId] || {}) }, parsed.headers);
    const mappedFields = CANONICAL_FIELDS.filter((field) => !!mapping[field]);
    const missingCanonicalFields = CANONICAL_FIELDS.filter((field) => !mapping[field]);
    const unmappedFields = parsed.headers.filter((header) => !Object.values(mapping).includes(header));
    const normalized = parsed.rows.map((row) => normalizeRow(row, mapping));
    const usableRows = normalized.filter(hasUsefulData).length;
    const issues: Array<{ level: 'error' | 'warning'; code: string; message: string; rowIndex?: number }> = [];
    if (!mappedFields.some((field) => REQUIRED_USEFUL_FIELDS.includes(field))) {
      issues.push({ level: 'error', code: 'missing_campaign_identity', message: 'Map campaign_name or campaign_id before merging.' });
    }
    if (usableRows === 0) issues.push({ level: 'error', code: 'no_usable_rows', message: 'No usable campaign rows were found.' });
    if (!mapping.period_start || !mapping.period_end) issues.push({ level: 'warning', code: 'missing_period_window', message: 'Period start/end are missing, so duplicate detection will be less precise.' });
    if (!mapping.spend) issues.push({ level: 'warning', code: 'missing_spend', message: 'Spend is not mapped; CPL and ROI may be incomplete.' });
    if (!mapping.channel && !mapping.platform) issues.push({ level: 'warning', code: 'missing_channel', message: 'Channel/platform is not mapped; duplicate detection will be less precise.' });

    files.push({
      uploadId,
      fileName: upload.originalName || upload.filename || 'campaign.csv',
      valid: !issues.some((issue) => issue.level === 'error'),
      summary: {
        totalRows: parsed.rows.length,
        usableRows,
        invalidRows: Math.max(parsed.rows.length - usableRows, 0),
        mappedFields,
        missingCanonicalFields,
        unmappedFields,
      },
      mapping,
      autoMapping,
      headers: parsed.headers,
      inferredTypes: inferTypes(parsed.rows),
      sampleRows: parsed.rows.slice(0, 20),
      issues,
    });
  }
  return { canMerge: files.length > 0 && files.every((file) => file.valid), files };
}

async function getUploadForValidation(id: string, workspace: string) {
  const upload = await UploadFile.findById(id).lean();
  if (!upload) throw Object.assign(new Error(`upload not found: ${id}`), { statusCode: 404 });
  if (String(upload.workspace) !== workspace) throw Object.assign(new Error('forbidden'), { statusCode: 403 });
  if (upload.status === 'archived') throw Object.assign(new Error(`upload is archived: ${id}`), { statusCode: 400 });
  const taggedModule = String((upload as any).module || upload.metadata?.module || '').toLowerCase();
  if (taggedModule && taggedModule !== 'm09') throw Object.assign(new Error(`upload is not tagged for module m09: ${id}`), { statusCode: 400 });
  return upload;
}

async function normalizeUploads(workspace: string, uploadIds: string[], mappingsByUpload: Record<string, Mapping>) {
  const normalizedRows: CanonicalRow[] = [];
  const uploadNames: string[] = [];
  for (const uploadId of uploadIds) {
    const upload = await getUploadForValidation(uploadId, workspace);
    uploadNames.push(upload.originalName || upload.filename || uploadId);
    const parsed = await readUploadCsv(upload.fileId);
    const mapping = cleanMapping({ ...suggestMapping(parsed.headers), ...(mappingsByUpload[uploadId] || {}) }, parsed.headers);
    for (const row of parsed.rows) {
      const normalized = normalizeRow(row, mapping);
      if (hasUsefulData(normalized)) normalizedRows.push(normalized);
    }
  }
  return { normalizedRows, uploadNames };
}

function cleanMapping(mapping: Mapping, headers: string[]) {
  const allowed = new Set(headers);
  const cleaned: Mapping = {};
  for (const field of CANONICAL_FIELDS) {
    const header = mapping[field];
    if (header && allowed.has(header)) cleaned[field] = header;
  }
  return cleaned;
}

function normalizeRow(row: CsvRow, mapping: Mapping) {
  const normalized = Object.fromEntries(CANONICAL_FIELDS.map((field) => [field, null])) as CanonicalRow;
  for (const field of CANONICAL_FIELDS) {
    const source = mapping[field];
    const raw = source ? row[source] : '';
    normalized[field] = normalizeValue(field, raw || '');
  }
  if (!normalized.channel && normalized.platform) normalized.channel = normalized.platform;
  if (!normalized.platform && normalized.channel) normalized.platform = normalized.channel;
  const clicks = asNumber(normalized.clicks);
  const impressions = asNumber(normalized.impressions);
  if (normalized.ctr === null && clicks !== null && impressions !== null && impressions > 0) normalized.ctr = round(clicks / impressions);
  const spend = asNumber(normalized.spend);
  const mqls = asNumber(normalized.mqls);
  if (normalized.cpl === null && spend !== null) normalized.cpl = round(spend / Math.max(mqls ?? 0, 1));
  const pipeline = asNumber(normalized.pipeline_revenue);
  if (normalized.roi === null && spend !== null && spend > 0 && pipeline !== null) normalized.roi = round((pipeline - spend) / spend);
  const start = parseDate(String(normalized.period_start || ''));
  const end = parseDate(String(normalized.period_end || ''));
  if (normalized.campaign_duration_days === null && start && end) {
    normalized.campaign_duration_days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }
  return normalized;
}

function normalizeValue(field: CanonicalField, value: string): string | number | boolean | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (NUMERIC_FIELDS.has(field)) return parseNumber(trimmed);
  if (field === 'fatigue_flag') return ['true', 'yes', '1', 'y'].includes(trimmed.toLowerCase());
  if (field === 'period_start' || field === 'period_end') {
    const parsed = parseDate(trimmed);
    return parsed ? parsed.toISOString().slice(0, 10) : trimmed;
  }
  return trimmed.toLowerCase();
}

function hasUsefulData(row: CanonicalRow) {
  return !!(row.campaign_name || row.campaign_id || row.spend || row.impressions || row.clicks || row.pipeline_revenue);
}

function dedupeRows(rows: CanonicalRow[]) {
  const result: CanonicalRow[] = [];
  let exactKeyDuplicates = 0;
  let fuzzyDuplicates = 0;
  for (const row of rows) {
    const exactKey = buildExactKey(row);
    const exactIndex = exactKey ? result.findIndex((existing) => buildExactKey(existing) === exactKey) : -1;
    if (exactIndex >= 0) {
      result[exactIndex] = mergeDuplicate(result[exactIndex] as CanonicalRow, row);
      exactKeyDuplicates += 1;
      continue;
    }
    const fuzzyIndex = result.findIndex((existing) => isFuzzyDuplicate(existing, row));
    if (fuzzyIndex >= 0) {
      result[fuzzyIndex] = mergeDuplicate(result[fuzzyIndex] as CanonicalRow, row);
      fuzzyDuplicates += 1;
      continue;
    }
    result.push(row);
  }
  return {
    rows: result,
    duplicateCount: exactKeyDuplicates + fuzzyDuplicates,
    exactKeyDuplicates,
    fuzzyDuplicates,
  };
}

function buildExactKey(row: CanonicalRow) {
  if (!row.campaign_name || !row.channel || !row.period_start || !row.period_end) return '';
  return [normalizeName(String(row.campaign_name)), row.channel, row.period_start, row.period_end].join('|');
}

function isFuzzyDuplicate(a: CanonicalRow, b: CanonicalRow) {
  if (!a.campaign_name || !b.campaign_name) return false;
  if (String(a.channel || '') !== String(b.channel || '')) return false;
  if (String(a.period_start || '') !== String(b.period_start || '')) return false;
  if (String(a.period_end || '') !== String(b.period_end || '')) return false;
  return similarity(normalizeName(String(a.campaign_name)), normalizeName(String(b.campaign_name))) >= 0.86;
}

function mergeDuplicate(a: CanonicalRow, b: CanonicalRow) {
  const merged = { ...a };
  for (const field of CANONICAL_FIELDS) {
    const current = merged[field];
    const next = b[field];
    if (isEmpty(current) && !isEmpty(next)) {
      merged[field] = next;
      continue;
    }
    if (typeof current === 'number' && typeof next === 'number' && next > 0) merged[field] = Math.max(current, next);
  }
  return merged;
}

async function saveMergedCsv(workspace: string, filename: string, csvText: string) {
  const db = mongoose.connection.db;
  if (!db) throw Object.assign(new Error('db not ready'), { statusCode: 500 });
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm09_merged' });
  const uploadStream = bucket.openUploadStream(filename, { contentType: 'text/csv', metadata: { workspace, module: 'm09' } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(Buffer.from(csvText, 'utf-8')).pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve());
  });
  return { fileId: uploadStream.id, length: uploadStream.length };
}

function streamToText(stream: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function toCsv(headers: readonly string[], rows: CanonicalRow[]) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as CanonicalField])).join(',')),
  ].join('\n');
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      current[j + 1] = Math.min(
        (current[j] ?? 0) + 1,
        (previous[j + 1] ?? 0) + 1,
        (previous[j] ?? 0) + (a[i] === b[j] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length] ?? 0;
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[£$,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  return parseNumber(String(value));
}

function clampRoi(value: number | null) {
  if (value === null) return null;
  return Math.max(-1, Math.min(5, value));
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeCategory(value: unknown) {
  const text = cleanText(value);
  return text ? text.toLowerCase() : null;
}

function numbersEqual(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.000001;
}

function deriveFatigueScore(touches: number | null) {
  if (touches === null) return 0.45;
  if (touches <= 2) return 0.1;
  if (touches <= 4) return 0.25;
  if (touches <= 6) return 0.45;
  if (touches <= 8) return 0.7;
  return 0.95;
}

function deriveTimingScore(weekday: string | null, hourBucket: string | null) {
  const key = `${weekday || ''}|${hourBucket || ''}`;
  const scores: Record<string, number> = {
    'friday|16:00-18:00': 0.8372,
    'friday|14:00-16:00': 0.9373,
    'thursday|14:00-16:00': 1.0609,
    'thursday|10:00-12:00': 1.1227,
    'tuesday|10:00-12:00': 1.1772,
  };
  return scores[key] ?? 1;
}

function deriveChannelQualityScore(channel: string | null) {
  const scores: Record<string, number> = {
    display: 0.88,
    content_syndication: 0.95,
    email: 0.96,
    paid_search: 1.03,
    linkedin: 1.08,
    webinar: 1.18,
  };
  return scores[channel || ''] ?? 1;
}

function deriveChannelCtr(channel: string | null) {
  const scores: Record<string, number> = {
    display: 0.006,
    content_syndication: 0.0113,
    email: 0.0165,
    paid_search: 0.0211,
    linkedin: 0.0171,
    webinar: 0.0121,
  };
  return scores[channel || ''] ?? 0.018;
}

function deriveChannelConversionRate(channel: string | null) {
  const scores: Record<string, number> = {
    display: 0.0168,
    content_syndication: 0.0377,
    email: 0.032,
    paid_search: 0.068,
    linkedin: 0.0594,
    webinar: 0.1267,
  };
  return scores[channel || ''] ?? 0.045;
}

function deriveChannelImpressionsPerSpend(channel: string | null) {
  const scores: Record<string, number> = {
    display: 118,
    content_syndication: 96,
    email: 76,
    paid_search: 78,
    linkedin: 72,
    webinar: 44,
  };
  return scores[channel || ''] ?? 88;
}

function deriveChannelClicksPerSpend(channel: string | null) {
  const scores: Record<string, number> = {
    display: 0.71,
    content_syndication: 1.08,
    email: 1.25,
    paid_search: 1.65,
    linkedin: 1.23,
    webinar: 0.54,
  };
  return scores[channel || ''] ?? 1.45;
}

function deriveChannelEngagementEfficiency(channel: string | null) {
  const scores: Record<string, number> = {
    display: 0.1387,
    content_syndication: 0.1808,
    email: 0.185,
    paid_search: 0.1991,
    linkedin: 0.2232,
    webinar: 0.2797,
  };
  return scores[channel || ''] ?? 0.19;
}

function deriveCampaignType(channel: string | null) {
  const types: Record<string, string> = {
    display: 'paid_acquisition',
    content_syndication: 'outbound',
    email: 'nurture',
    paid_search: 'paid_acquisition',
    linkedin: 'abm',
    webinar: 'product_launch',
  };
  return types[channel || ''] ?? 'paid_acquisition';
}

function deriveSegment(channel: string | null) {
  if (channel === 'webinar') return 'enterprise';
  if (channel === 'display') return 'smb';
  return 'mid_market';
}

function deriveSegmentQualityScore(segment: string | null) {
  const scores: Record<string, number> = { smb: 0.84, mid_market: 0.92, enterprise: 1.08 };
  return scores[segment || ''] ?? 0.92;
}

function deriveEngagementEfficiency(ctr: number | null, conversionRate: number | null, mqlRate: number | null) {
  const parts = [ctr, conversionRate, mqlRate].filter((value): value is number => value !== null);
  if (parts.length === 0) return 0.19;
  return round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === '';
}

function getUserId(req: Request) {
  const user = (req as any).user || null;
  const id = user?._id || user?.id || null;
  return id && mongoose.isValidObjectId(id) ? id : null;
}

function formatMergedItem(item: any) {
  return {
    _id: String(item._id),
    title: item.title,
    filename: item.filename,
    sourceUploadIds: (item.sourceUploadIds || []).map((id: unknown) => String(id)),
    rowCountBeforeMerge: item.rowCountBeforeMerge || 0,
    rowCountAfterMerge: item.rowCountAfterMerge || 0,
    duplicateCount: item.duplicateCount || 0,
    mergedCount: item.mergedCount || 0,
    createdAt: item.createdAt,
    summary: {
      fuzzyThreshold: item.mergeSummary?.fuzzyThreshold || null,
      duplicateMethod: item.mergeSummary?.duplicateMethod || null,
      validationWarnings: item.validationSummary?.warnings || [],
    },
  };
}

function handleError(res: Response, error: unknown, fallback: string) {
  const err = error as Error & { statusCode?: number };
  const status = err.statusCode || 500;
  if (status >= 500) console.error('[m09]', err);
  return res.status(status).json({ ok: false, error: err.message || fallback });
}

export default router;
