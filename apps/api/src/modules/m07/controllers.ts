import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import FunnelLead from './models/FunnelLead.js';
import FunnelStageHistory from './models/StageHistory.js';
import StageHistory from './models/StageHistory.js';
import Interaction from './models/Interaction.js';
import { Campaign } from '../m06/models/Campaign.js';

const STAGE_STATUSES = new Set(['active', 'completed', 'dropped']);
const INTERACTION_TYPES = new Set(['call', 'email', 'meeting', 'demo']);
const INTERACTION_CHANNELS = new Set(['phone', 'email', 'zoom', 'linkedin']);
const INTERACTION_OUTCOMES = new Set(['positive', 'negative', 'no response', 'follow-up needed']);
const STAGE_SEQUENCE = ['MQL', 'SQL', 'Proposal', 'Negotiation', 'Closed'] as const;
const STAGE_NAME_LOOKUP = new Map(STAGE_SEQUENCE.map((stage) => [stage.toLowerCase(), stage]));

function sanitizeStringValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function parseDateValue(value: unknown): Date | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeInteractionType(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  return INTERACTION_TYPES.has(normalized) ? normalized : null;
}

function normalizeInteractionChannel(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  return INTERACTION_CHANNELS.has(normalized) ? normalized : null;
}

function normalizeInteractionOutcome(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  return INTERACTION_OUTCOMES.has(normalized) ? normalized : null;
}

function normalizeStageStatus(value: unknown, fallback = 'active'): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  return STAGE_STATUSES.has(normalized) ? normalized : null;
}

function normalizeStageName(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  return STAGE_NAME_LOOKUP.get(text.toLowerCase()) ?? null;
}

function getStageSequenceIndex(stageName: string | null) {
  return stageName ? STAGE_SEQUENCE.indexOf(stageName as (typeof STAGE_SEQUENCE)[number]) : -1;
}

function validateStageFlowRules(input: {
  stageName: string | null;
  stageStatus: string | null;
  enteredAt: Date | null;
  exitedAt: Date | null;
  nextStage: string | null;
  exitReason: string | null;
}) {
  const errors: Array<{ field: string; message: string }> = [];
  const { stageName, stageStatus, enteredAt, exitedAt, nextStage, exitReason } = input;
  const stageIndex = getStageSequenceIndex(stageName);
  const nextStageIndex = getStageSequenceIndex(nextStage);

  if (nextStage && nextStageIndex === -1) {
    errors.push({ field: 'next_stage', message: `next_stage must be one of ${STAGE_SEQUENCE.join(', ')}.` });
  }

  if (stageName === 'Closed' && nextStage) {
    errors.push({ field: 'next_stage', message: 'next_stage must be blank when stage_name is Closed.' });
  }

  if (stageIndex >= 0 && nextStageIndex >= 0 && nextStageIndex <= stageIndex) {
    errors.push({ field: 'next_stage', message: 'next_stage must come after stage_name in the funnel sequence.' });
  }

  if (stageStatus === 'active') {
    if (exitedAt) errors.push({ field: 'exited_at', message: 'active stages cannot have exited_at.' });
    if (exitReason) errors.push({ field: 'exit_reason', message: 'exit_reason must be blank for active stages.' });
  }

  if (stageStatus === 'completed') {
    if (!exitedAt && enteredAt) errors.push({ field: 'exited_at', message: 'completed stages require exited_at.' });
    if (stageName && stageName !== 'Closed' && !nextStage) {
      errors.push({ field: 'next_stage', message: 'completed stages require next_stage unless the stage is Closed.' });
    }
    if (exitReason) errors.push({ field: 'exit_reason', message: 'exit_reason must be blank for completed stages.' });
  }

  if (stageStatus === 'dropped') {
    if (!exitedAt && enteredAt) errors.push({ field: 'exited_at', message: 'dropped stages require exited_at.' });
    if (!exitReason) errors.push({ field: 'exit_reason', message: 'exit_reason is required when stage_status is dropped.' });
    if (nextStage) errors.push({ field: 'next_stage', message: 'next_stage must be blank when stage_status is dropped.' });
  }

  return errors;
}

function normalizeHeaderValue(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsvRecords(text: string): string[][] {
  const records = parse(text, { bom: true, relax_column_count: true });
  return Array.isArray(records)
    ? records.map((row: any) => (Array.isArray(row) ? row.map((cell: any) => String(cell ?? '')) : []))
    : [];
}

function buildOriginalRow(header: string[], row: string[]) {
  return Object.fromEntries(header.map((column, index) => [column, String(row[index] ?? '')]));
}

function normalizeEngagementScore(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score < 1 || score > 10) return null;
  return score;
}

// ------------------ INTERACTIONS CONTROLLERS ------------------

// POST /m07/interactions - create single interaction
export async function createInteraction(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const leadId = sanitizeStringValue(body.lead_id);
    const timestamp = parseDateValue(body.timestamp || body.time);
    const interactionType = normalizeInteractionType(body.interaction_type || body.type);
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!leadId) return res.status(400).json({ error: 'lead_id required' });
    if(!interactionType) return res.status(400).json({ error: 'interaction_type required' });
    if(!timestamp) return res.status(400).json({ error: 'timestamp required and must be a valid date' });
    const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
    if(!lead) return res.status(400).json({ error: 'referenced lead not found' });
    const campaignId = sanitizeStringValue(body.campaign_id || body.campaign);
    if (campaignId) {
      const campaign = await Campaign.findOne({ project_id: workspaceId, campaign_id: campaignId }).select('_id').lean();
      if (!campaign) return res.status(400).json({ error: 'referenced campaign not found' });
    }
    const channel = body.channel !== undefined || body.medium !== undefined ? normalizeInteractionChannel(body.channel || body.medium) : null;
    if ((body.channel !== undefined || body.medium !== undefined) && !channel) {
      return res.status(400).json({ error: 'channel must be one of phone, email, zoom, linkedin' });
    }
    const outcome = body.outcome !== undefined ? normalizeInteractionOutcome(body.outcome) : null;
    if (body.outcome !== undefined && !outcome) {
      return res.status(400).json({ error: 'outcome must be one of positive, negative, no response, follow-up needed' });
    }
    const engagementScore = normalizeEngagementScore(body.engagement_score);
    if (body.engagement_score !== undefined && engagementScore === null) return res.status(400).json({ error: 'engagement_score must be between 1 and 10' });

    const payload: any = {
      workspace_id: workspaceId,
      interaction_id: sanitizeStringValue(body.interaction_id),
      lead_id: leadId,
      timestamp,
      interaction_type: interactionType,
      channel,
      campaign_id: campaignId,
      outcome,
      engagement_score: engagementScore,
      notes: sanitizeStringValue(body.notes),
    };

    // duplicate key: workspace+lead+timestamp+interaction_type
    const filter = { workspace_id: workspaceId, lead_id: leadId, timestamp: timestamp, interaction_type: payload.interaction_type } as any;
    const existing = await Interaction.findOne(filter).lean();
    if(existing){ await Interaction.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } }); return res.json({ ok: true, updated: true }); }
    const doc = await Interaction.create(payload);
    return res.json({ ok: true, item: doc });
  }catch(e){ console.error('[m07.createInteraction]', e); return res.status(500).json({ error: 'internal' }); }
}

// POST /m07/interactions/upload/preview
export async function previewInteractionUpload(req: Request, res: Response){
  try{
    const file: any = (req as any).file;
    const body: any = (req as any).body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    let text = '';
    if(file && file.buffer) text = file.buffer.toString('utf8');
    else if(body.csvText) text = String(body.csvText);
    else return res.status(400).json({ error: 'file required' });
    const records = parse(text, { bom: true, relax_column_count: true });
    if(!records || records.length === 0) return res.json({ ok: true, columns: [], previewRows: [], warnings: [] });
    const header = records[0].map((c:any)=>String(c||'').trim());
    const previewRows = records.slice(1,21).map((r:any)=>r.map((c:any)=>(c==null?'':String(c))));
    return res.json({ ok: true, columns: header, previewRows, warnings: [] });
  }catch(e){ console.error('[m07.previewInteractionUpload]', e); return res.status(500).json({ error: 'internal' }); }
}

async function validateInteractionRows(params: {
  workspaceId: string;
  csv: string;
  map: Record<string, string | null | undefined>;
  startRow?: number;
  endRow?: number;
  duplicateMode?: 'skip_duplicates' | 'overwrite_existing';
}) {
  const records = parseCsvRecords(params.csv);
  if (records.length === 0) {
    return {
      ok: true as const,
      rowResults: [],
      summary: { checkedRows: 0, validRows: 0, invalidRows: 0, warningRows: 0 },
    };
  }

  const header = (records[0] || []).map((column) => String(column || '').trim());
  const dataRows = records.slice(1);
  const totalRows = dataRows.length;
  const safeStart = Number.isInteger(params.startRow) ? Math.max(1, Number(params.startRow)) : 1;
  const safeEnd = Number.isInteger(params.endRow) ? Number(params.endRow) : totalRows;
  if (safeStart < 1) throw new Error('start_row_invalid');
  if (safeEnd < safeStart) throw new Error('end_row_before_start');
  if (safeEnd > totalRows) throw new Error('end_row_exceeds_total');

  const headerIndex = new Map<string, number>();
  header.forEach((column, index) => headerIndex.set(normalizeHeaderValue(column), index));

  const parsedRows: Array<{
    rowNumber: number;
    original: Record<string, string>;
    mapped: Record<string, string | null>;
    baseErrors: Array<{ field: string; message: string }>;
    leadId: string | null;
    timestamp: Date | null;
    interactionType: string | null;
    campaignId: string | null;
    channelRaw: string | null;
    channel: string | null;
    outcomeRaw: string | null;
    outcome: string | null;
    engagementScoreRaw: string | null;
    engagementScore: number | null;
  }> = [];
  const uniqueLeadIds = new Set<string>();
  const uniqueCampaignIds = new Set<string>();

  for (let offset = safeStart - 1; offset < safeEnd; offset += 1) {
    const csvRow = dataRows[offset] || [];
    const rowNumber = offset + 1;
    const original = buildOriginalRow(header, csvRow);
    const baseErrors: Array<{ field: string; message: string }> = [];
    const mapped: Record<string, string | null> = {};
    const usedHeaders = new Set<string>();

    for (const field of ['lead_id', 'timestamp', 'interaction_type']) {
      if (!sanitizeStringValue(params.map[field])) baseErrors.push({ field, message: `${field} is missing from the mapping.` });
    }

    for (const [field, mappedHeaderRaw] of Object.entries(params.map || {})) {
      const mappedHeader = sanitizeStringValue(mappedHeaderRaw);
      if (!mappedHeader) continue;
      const normalizedHeader = normalizeHeaderValue(mappedHeader);
      if (usedHeaders.has(normalizedHeader)) {
        baseErrors.push({ field, message: `${mappedHeader} is mapped more than once.` });
        continue;
      }
      usedHeaders.add(normalizedHeader);
      const index = headerIndex.get(normalizedHeader);
      if (index === undefined) {
        baseErrors.push({ field, message: `${mappedHeader} was not found in the uploaded CSV headers.` });
        continue;
      }
      mapped[field] = String(csvRow[index] ?? '').trim();
    }

    const leadId = sanitizeStringValue(mapped.lead_id);
    const timestamp = parseDateValue(mapped.timestamp);
    const interactionType = normalizeInteractionType(mapped.interaction_type);
    const campaignId = sanitizeStringValue(mapped.campaign_id);
    const channelRaw = sanitizeStringValue(mapped.channel);
    const channel = channelRaw ? normalizeInteractionChannel(channelRaw) : null;
    const outcomeRaw = sanitizeStringValue(mapped.outcome);
    const outcome = outcomeRaw ? normalizeInteractionOutcome(outcomeRaw) : null;
    const engagementScoreRaw = sanitizeStringValue(mapped.engagement_score);
    const engagementScore = engagementScoreRaw ? normalizeEngagementScore(engagementScoreRaw) : null;

    if (leadId) uniqueLeadIds.add(leadId);
    if (campaignId) uniqueCampaignIds.add(campaignId);

    parsedRows.push({
      rowNumber,
      original,
      mapped,
      baseErrors,
      leadId,
      timestamp,
      interactionType,
      campaignId,
      channelRaw,
      channel,
      outcomeRaw,
      outcome,
      engagementScoreRaw,
      engagementScore,
    });
  }

  const existingLeadIds = new Set(
    (await FunnelLead.find({ workspace_id: params.workspaceId, lead_id: { $in: Array.from(uniqueLeadIds) } }).select('lead_id').lean())
      .map((lead) => String(lead.lead_id))
  );

  const existingCampaignIds = new Set(
    (await Campaign.find({ project_id: params.workspaceId, campaign_id: { $in: Array.from(uniqueCampaignIds) } }).select('campaign_id').lean())
      .map((campaign) => String(campaign.campaign_id))
  );

  const existingInteractionKeys = new Set<string>();
  const duplicateCandidates = parsedRows
    .filter((row) => row.leadId && row.timestamp && row.interactionType)
    .map((row) => ({
      workspace_id: params.workspaceId,
      lead_id: row.leadId,
      timestamp: row.timestamp,
      interaction_type: row.interactionType,
    }));

  if (duplicateCandidates.length > 0) {
    const existingInteractions = await Interaction.find({ $or: duplicateCandidates }).select('lead_id timestamp interaction_type').lean();
    for (const existing of existingInteractions) {
      existingInteractionKeys.add(`${String(existing.lead_id)}::${new Date(existing.timestamp).toISOString()}::${String(existing.interaction_type)}`);
    }
  }

  const rowResults: Array<{
    rowNumber: number;
    original: Record<string, string>;
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
    mappedRow?: Record<string, unknown>;
  }> = [];

  for (const parsedRow of parsedRows) {
    const errors: Array<{ field: string; message: string }> = [...parsedRow.baseErrors];
    const warnings: Array<{ field: string; message: string }> = [];
    const { rowNumber, original, leadId, timestamp, interactionType, campaignId, channelRaw, channel, outcomeRaw, outcome, engagementScoreRaw, engagementScore } = parsedRow;

    if (!leadId) errors.push({ field: 'lead_id', message: 'lead_id is missing.' });
    if (!timestamp) errors.push({ field: 'timestamp', message: 'timestamp must be a valid date.' });
    if (!interactionType) errors.push({ field: 'interaction_type', message: `interaction_type must be one of ${Array.from(INTERACTION_TYPES).join(', ')}.` });
    if (channelRaw && !channel) errors.push({ field: 'channel', message: `channel must be one of ${Array.from(INTERACTION_CHANNELS).join(', ')}.` });
    if (outcomeRaw && !outcome) errors.push({ field: 'outcome', message: `outcome must be one of ${Array.from(INTERACTION_OUTCOMES).join(', ')}.` });
    if (engagementScoreRaw && engagementScore === null) errors.push({ field: 'engagement_score', message: 'engagement_score must be between 1 and 10.' });

    if (leadId && !existingLeadIds.has(leadId)) errors.push({ field: 'lead_id', message: 'lead_id does not exist in funnel leads.' });
    if (campaignId && !existingCampaignIds.has(campaignId)) errors.push({ field: 'campaign_id', message: 'campaign_id does not exist in campaigns.' });
    if (leadId && timestamp && interactionType) {
      const existingKey = `${leadId}::${timestamp.toISOString()}::${interactionType}`;
      if (existingInteractionKeys.has(existingKey) && params.duplicateMode === 'skip_duplicates') {
        warnings.push({ field: 'interaction_type', message: 'A matching interaction already exists and will be skipped.' });
      }
    }

    const rowResult: {
      rowNumber: number;
      original: Record<string, string>;
      valid: boolean;
      errors: Array<{ field: string; message: string }>;
      warnings: Array<{ field: string; message: string }>;
      mappedRow?: Record<string, unknown>;
    } = { rowNumber, original, valid: errors.length === 0, errors, warnings };
    if (errors.length === 0) {
      rowResult.mappedRow = {
        interaction_id: sanitizeStringValue(parsedRow.mapped.interaction_id),
        lead_id: leadId,
        timestamp,
        interaction_type: interactionType,
        channel,
        campaign_id: campaignId,
        outcome,
        engagement_score: engagementScore,
        notes: sanitizeStringValue(parsedRow.mapped.notes),
      };
    }
    rowResults.push(rowResult);
  }

  return {
    ok: true as const,
    rowResults,
    summary: {
      checkedRows: rowResults.length,
      validRows: rowResults.filter((row) => row.valid).length,
      invalidRows: rowResults.filter((row) => !row.valid).length,
      warningRows: rowResults.filter((row) => row.warnings.length > 0).length,
    },
  };
}

export async function validateInteractionUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!body.csv || typeof body.csv !== 'string') return res.status(400).json({ error: 'csv required' });
    if(!body.map || typeof body.map !== 'object') return res.status(400).json({ error: 'map required' });
    const validation = await validateInteractionRows({
      workspaceId,
      csv: body.csv,
      map: body.map,
      startRow: body.startRow,
      endRow: body.endRow,
      duplicateMode: body.duplicateMode,
    });
    return res.json(validation);
  }catch(e){
    if (e instanceof Error && ['start_row_invalid', 'end_row_before_start', 'end_row_exceeds_total'].includes(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[m07.validateInteractionUpload]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m07/interactions/upload/commit
export async function commitInteractionUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const duplicateMode = body.duplicateMode || 'skip_duplicates';
    const allowPartial = body.allowPartial === true;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    let rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0 && body.csv && body.map) {
      const validation = await validateInteractionRows({
        workspaceId,
        csv: String(body.csv),
        map: body.map,
        startRow: body.startRow,
        endRow: body.endRow,
        duplicateMode,
      });
      if (validation.summary.invalidRows > 0 && !allowPartial) {
        return res.status(400).json({ error: 'invalid_rows_present', summary: validation.summary, rowResults: validation.rowResults });
      }
      rows = validation.rowResults.filter((row) => row.valid).map((row) => row.mappedRow);
    }

    if(!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows required' });

    const warnings: string[] = [];
    let imported = 0; let skipped = 0; let updated = 0;

    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const leadId = sanitizeStringValue(r.lead_id);
      const timestamp = parseDateValue(r.timestamp || r.time);
      const itype = normalizeInteractionType(r.interaction_type || r.type);
      if(!leadId){ skipped++; warnings.push(`Row ${i+1}: missing lead_id`); continue; }
      if(!itype){ skipped++; warnings.push(`Row ${i+1}: missing interaction_type`); continue; }
      if(!timestamp){ skipped++; warnings.push(`Row ${i+1}: invalid timestamp`); continue; }
      const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
      if(!lead){ skipped++; warnings.push(`Row ${i+1}: referenced lead not found`); continue; }
      const campaignId = sanitizeStringValue(r.campaign_id || r.campaign);
      if (campaignId) {
        const campaign = await Campaign.findOne({ project_id: workspaceId, campaign_id: campaignId }).select('_id').lean();
        if (!campaign) { skipped++; warnings.push(`Row ${i+1}: referenced campaign not found`); continue; }
      }
      const channel = (r.channel !== undefined || r.medium !== undefined) ? normalizeInteractionChannel(r.channel || r.medium) : null;
      if ((r.channel !== undefined || r.medium !== undefined) && !channel) { skipped++; warnings.push(`Row ${i+1}: invalid channel`); continue; }
      const outcome = r.outcome !== undefined ? normalizeInteractionOutcome(r.outcome) : null;
      if (r.outcome !== undefined && !outcome) { skipped++; warnings.push(`Row ${i+1}: invalid outcome`); continue; }
      const engagementScore = normalizeEngagementScore(r.engagement_score);
      if (r.engagement_score !== undefined && engagementScore === null) { skipped++; warnings.push(`Row ${i+1}: engagement_score must be between 1 and 10`); continue; }

      const payload:any = {
        workspace_id: workspaceId,
        interaction_id: sanitizeStringValue(r.interaction_id),
        lead_id: leadId,
        timestamp,
        interaction_type: itype,
        channel,
        campaign_id: campaignId,
        outcome,
        engagement_score: engagementScore,
        notes: sanitizeStringValue(r.notes),
      };

      const filter = { workspace_id: workspaceId, lead_id: leadId, timestamp: timestamp, interaction_type: payload.interaction_type } as any;
      const existing = await Interaction.findOne(filter).lean();
      if(existing){
        if(duplicateMode === 'skip_duplicates'){ skipped++; continue; }
        await Interaction.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } }); updated++;
      } else {
        await Interaction.create(payload); imported++;
      }
    }

    return res.json({ ok: true, importedCount: imported, updatedCount: updated, skippedCount: skipped, warnings });
  }catch(e){ console.error('[m07.commitInteractionUpload]', e); return res.status(500).json({ error: 'internal' }); }
}

// GET /m07/interactions - list with filters
export async function listInteractions(req: Request, res: Response){
  try{
    const workspace = String(req.query.workspaceId || req.query.workspace || ''); if(!workspace) return res.status(400).json({ error: 'workspaceId required' });
    const page = Math.max(1, parseInt(String(req.query.page || '1'),10)); const pageSize = Math.min(200, Math.max(5, parseInt(String(req.query.pageSize || '25'),10)));
    const filter:any = { workspace_id: workspace };
    if(req.query.leadId) filter.lead_id = String(req.query.leadId);
    if(req.query.interactionType) filter.interaction_type = String(req.query.interactionType);
    if(req.query.channel) filter.channel = String(req.query.channel);
    if(req.query.campaignId) filter.campaign_id = String(req.query.campaignId);
    if(req.query.includeArchived !== '1' && req.query.includeArchived !== 'true') filter.is_archived = { $ne: true };
    if(req.query.timestampFrom || req.query.timestampTo){ filter.timestamp = {}; if(req.query.timestampFrom) filter.timestamp.$gte = new Date(String(req.query.timestampFrom)); if(req.query.timestampTo) filter.timestamp.$lte = new Date(String(req.query.timestampTo)); }
    const total = await Interaction.countDocuments(filter);
    const items = await Interaction.find(filter).sort({ timestamp: -1 }).skip((page-1)*pageSize).limit(pageSize).lean();
    return res.json({ ok: true, items, total, page, pageSize });
  }catch(e){ console.error('[m07.listInteractions]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function getInteraction(req: Request, res: Response){
  try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); const doc = await Interaction.findById(id).lean(); if(!doc) return res.status(404).json({ error: 'not found' }); return res.json({ ok: true, item: doc }); }catch(e){ console.error('[m07.getInteraction]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function updateInteraction(req: Request, res: Response){
  try{
    const id = String(req.params.id || '');
    if(!id) return res.status(400).json({ error: 'id required' });
    const doc = await Interaction.findById(id).lean();
    if(!doc) return res.status(404).json({ error: 'not found' });
    const body:any = req.body || {};
    const update:any = {};
    if(Object.prototype.hasOwnProperty.call(body, 'timestamp')){
      const timestamp = parseDateValue(body.timestamp);
      if(!timestamp) return res.status(400).json({ error: 'timestamp required and must be a valid date' });
      update.timestamp = timestamp;
    }
    if(Object.prototype.hasOwnProperty.call(body, 'interaction_type')){
      const interactionType = normalizeInteractionType(body.interaction_type);
      if(!interactionType) return res.status(400).json({ error: 'invalid interaction_type', allowed: Array.from(INTERACTION_TYPES) });
      update.interaction_type = interactionType;
    }
    if(Object.prototype.hasOwnProperty.call(body, 'channel')){
      const channel = sanitizeStringValue(body.channel);
      if (channel) {
        const normalizedChannel = normalizeInteractionChannel(channel);
        if (!normalizedChannel) return res.status(400).json({ error: 'invalid channel', allowed: Array.from(INTERACTION_CHANNELS) });
        update.channel = normalizedChannel;
      } else {
        update.channel = null;
      }
    }
    if(Object.prototype.hasOwnProperty.call(body, 'campaign_id')){
      const campaignId = sanitizeStringValue(body.campaign_id);
      if (campaignId) {
        const campaign = await Campaign.findOne({ project_id: doc.workspace_id, campaign_id: campaignId }).select('_id').lean();
        if (!campaign) return res.status(400).json({ error: 'referenced campaign not found' });
      }
      update.campaign_id = campaignId;
    }
    if(Object.prototype.hasOwnProperty.call(body, 'outcome')){
      const outcome = sanitizeStringValue(body.outcome);
      if (outcome) {
        const normalizedOutcome = normalizeInteractionOutcome(outcome);
        if (!normalizedOutcome) return res.status(400).json({ error: 'invalid outcome', allowed: Array.from(INTERACTION_OUTCOMES) });
        update.outcome = normalizedOutcome;
      } else {
        update.outcome = null;
      }
    }
    if(Object.prototype.hasOwnProperty.call(body, 'engagement_score')){
      const engagementScore = normalizeEngagementScore(body.engagement_score);
      if (body.engagement_score !== undefined && engagementScore === null) return res.status(400).json({ error: 'engagement_score must be between 1 and 10' });
      update.engagement_score = engagementScore;
    }
    if(Object.prototype.hasOwnProperty.call(body, 'notes')) update.notes = sanitizeStringValue(body.notes);
    update.updated_at = new Date();
    await Interaction.updateOne({ _id: id }, { $set: update });
    const next = await Interaction.findById(id).lean();
    return res.json({ ok: true, item: next });
  }catch(e){ console.error('[m07.updateInteraction]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function archiveInteraction(req: Request, res: Response){ try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await Interaction.updateOne({ _id: id }, { $set: { is_archived: true, updated_at: new Date() } }); return res.json({ ok: true }); }catch(e){ console.error('[m07.archiveInteraction]', e); return res.status(500).json({ error: 'internal' }); } }

export async function deleteInteractionPermanent(req: Request, res: Response){ try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await Interaction.deleteOne({ _id: id }); return res.json({ ok: true }); }catch(e){ console.error('[m07.deleteInteractionPermanent]', e); return res.status(500).json({ error: 'internal' }); } }


// ------------------ STAGE HISTORY CONTROLLERS ------------------

// POST /m07/stages - create single stage history record
export async function createStage(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const leadId = sanitizeStringValue(body.lead_id);
    const stageName = normalizeStageName(body.stage_name);
    const enteredAt = parseDateValue(body.entered_at);
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!leadId) return res.status(400).json({ error: 'lead_id required' });
    if(!stageName) return res.status(400).json({ error: 'stage_name required' });
    if(!enteredAt) return res.status(400).json({ error: 'entered_at required and must be a valid date' });
    // ensure lead exists
    const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
    if(!lead) return res.status(400).json({ error: 'referenced lead not found' });
    const exitedAt = body.exited_at ? parseDateValue(body.exited_at) : null;
    if (body.exited_at && !exitedAt) return res.status(400).json({ error: 'exited_at must be a valid date' });
    if (exitedAt && exitedAt.getTime() < enteredAt.getTime()) return res.status(400).json({ error: 'exited_at before entered_at' });
    const stageStatus = normalizeStageStatus(body.stage_status);
    if (!stageStatus) return res.status(400).json({ error: 'invalid stage_status', allowed: Array.from(STAGE_STATUSES) });
    const nextStage = body.next_stage !== undefined ? normalizeStageName(body.next_stage) : null;
    if (body.next_stage !== undefined && sanitizeStringValue(body.next_stage) && !nextStage) {
      return res.status(400).json({ error: 'invalid next_stage', allowed: STAGE_SEQUENCE });
    }
    const exitReason = sanitizeStringValue(body.exit_reason);
    const stageFlowErrors = validateStageFlowRules({ stageName, stageStatus, enteredAt, exitedAt, nextStage, exitReason });
    if (stageFlowErrors.length > 0) return res.status(400).json({ error: 'invalid_stage_flow', details: stageFlowErrors });
    // create or overwrite duplicate
    const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
    const payload: any = {
      workspace_id: workspaceId,
      lead_id: leadId,
      stage_name: stageName,
      entered_at: enteredAt,
      exited_at: exitedAt,
      stage_status: stageStatus,
      next_stage: nextStage,
      exit_reason: exitReason,
      notes: sanitizeStringValue(body.notes),
    };
    // overwrite existing if found
    const existing = await StageHistory.findOne(filter).lean();
    if(existing){ await StageHistory.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } }); return res.json({ ok: true, updated: true }); }
    const doc = await StageHistory.create(payload);
    return res.json({ ok: true, item: doc });
  }catch(e){ console.error('[m07.createStage]', e); return res.status(500).json({ error: 'internal' }); }
}

async function validateStageRows(params: {
  workspaceId: string;
  csv: string;
  map: Record<string, string | null | undefined>;
  startRow?: number;
  endRow?: number;
  overwriteMode?: 'overwrite_existing' | 'skip_duplicates';
}) {
  const records = parseCsvRecords(params.csv);
  if (records.length === 0) {
    return {
      ok: true as const,
      rowResults: [],
      summary: { checkedRows: 0, validRows: 0, invalidRows: 0, warningRows: 0 },
    };
  }

  const header = (records[0] || []).map((column) => String(column || '').trim());
  const dataRows = records.slice(1);
  const totalRows = dataRows.length;
  const safeStart = Number.isInteger(params.startRow) ? Math.max(1, Number(params.startRow)) : 1;
  const safeEnd = Number.isInteger(params.endRow) ? Number(params.endRow) : totalRows;
  if (safeStart < 1) throw new Error('start_row_invalid');
  if (safeEnd < safeStart) throw new Error('end_row_before_start');
  if (safeEnd > totalRows) throw new Error('end_row_exceeds_total');

  const headerIndex = new Map<string, number>();
  header.forEach((column, index) => headerIndex.set(normalizeHeaderValue(column), index));

  const parsedRows: Array<{
    rowNumber: number;
    original: Record<string, string>;
    mapped: Record<string, string | null>;
    baseErrors: Array<{ field: string; message: string }>;
    leadId: string | null;
    stageName: string | null;
    enteredAt: Date | null;
    exitedAtRaw: string | null;
    exitedAt: Date | null;
    stageStatus: string | null;
    nextStageRaw: string | null;
    nextStage: string | null;
    exitReason: string | null;
  }> = [];
  const uniqueLeadIds = new Set<string>();
  const uniqueStageNames = new Set<string>();
  let minEnteredAt: Date | null = null;
  let maxEnteredAt: Date | null = null;

  for (let offset = safeStart - 1; offset < safeEnd; offset += 1) {
    const csvRow = dataRows[offset] || [];
    const rowNumber = offset + 1;
    const original = buildOriginalRow(header, csvRow);
    const baseErrors: Array<{ field: string; message: string }> = [];
    const mapped: Record<string, string | null> = {};
    const usedHeaders = new Set<string>();

    for (const field of ['lead_id', 'stage_name', 'entered_at']) {
      if (!sanitizeStringValue(params.map[field])) baseErrors.push({ field, message: `${field} is missing from the mapping.` });
    }

    for (const [field, mappedHeaderRaw] of Object.entries(params.map || {})) {
      const mappedHeader = sanitizeStringValue(mappedHeaderRaw);
      if (!mappedHeader) continue;
      const normalizedHeader = normalizeHeaderValue(mappedHeader);
      if (usedHeaders.has(normalizedHeader)) {
        baseErrors.push({ field, message: `${mappedHeader} is mapped more than once.` });
        continue;
      }
      usedHeaders.add(normalizedHeader);
      const index = headerIndex.get(normalizedHeader);
      if (index === undefined) {
        baseErrors.push({ field, message: `${mappedHeader} was not found in the uploaded CSV headers.` });
        continue;
      }
      mapped[field] = String(csvRow[index] ?? '').trim();
    }

    const leadId = sanitizeStringValue(mapped.lead_id);
    const stageNameRaw = sanitizeStringValue(mapped.stage_name);
    const stageName = stageNameRaw ? normalizeStageName(stageNameRaw) : null;
    const enteredAt = parseDateValue(mapped.entered_at);
    const exitedAtRaw = sanitizeStringValue(mapped.exited_at);
    const exitedAt = exitedAtRaw ? parseDateValue(exitedAtRaw) : null;
    const stageStatus = normalizeStageStatus(mapped.stage_status);
    const nextStageRaw = sanitizeStringValue(mapped.next_stage);
    const nextStage = nextStageRaw ? normalizeStageName(nextStageRaw) : null;
    const exitReason = sanitizeStringValue(mapped.exit_reason);

    if (leadId) uniqueLeadIds.add(leadId);
    if (stageName) uniqueStageNames.add(stageName);
    if (leadId && stageName && enteredAt) {
      if (!minEnteredAt || enteredAt < minEnteredAt) minEnteredAt = enteredAt;
      if (!maxEnteredAt || enteredAt > maxEnteredAt) maxEnteredAt = enteredAt;
    }

    parsedRows.push({
      rowNumber,
      original,
      mapped,
      baseErrors,
      leadId,
      stageName,
      enteredAt,
      exitedAtRaw,
      exitedAt,
      stageStatus,
      nextStageRaw,
      nextStage,
      exitReason,
    });
  }

  const existingLeadIds = new Set(
    (await FunnelLead.find({ workspace_id: params.workspaceId, lead_id: { $in: Array.from(uniqueLeadIds) } }).select('lead_id').lean())
      .map((lead) => String(lead.lead_id))
  );

  const existingStageKeys = new Set<string>();
  if (uniqueLeadIds.size > 0 && uniqueStageNames.size > 0 && minEnteredAt && maxEnteredAt) {
    const existingStages = await StageHistory.find({
      workspace_id: params.workspaceId,
      lead_id: { $in: Array.from(uniqueLeadIds) },
      stage_name: { $in: Array.from(uniqueStageNames) },
      entered_at: { $gte: minEnteredAt, $lte: maxEnteredAt },
    }).select('lead_id stage_name entered_at').lean();

    for (const stage of existingStages) {
      existingStageKeys.add(`${String(stage.lead_id)}::${String(stage.stage_name)}::${new Date(stage.entered_at).toISOString()}`);
    }
  }

  const rowResults: Array<{
    rowNumber: number;
    original: Record<string, string>;
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
    mappedRow?: Record<string, unknown>;
  }> = [];

  for (const parsedRow of parsedRows) {
    const errors: Array<{ field: string; message: string }> = [...parsedRow.baseErrors];
    const warnings: Array<{ field: string; message: string }> = [];
    const { rowNumber, original, leadId, stageName, enteredAt, exitedAtRaw, exitedAt, stageStatus, nextStageRaw, nextStage, exitReason } = parsedRow;

    if (!leadId) errors.push({ field: 'lead_id', message: 'lead_id is missing.' });
    if (!sanitizeStringValue(parsedRow.mapped.stage_name)) errors.push({ field: 'stage_name', message: 'stage_name is missing.' });
    if (sanitizeStringValue(parsedRow.mapped.stage_name) && !stageName) errors.push({ field: 'stage_name', message: `stage_name must be one of ${STAGE_SEQUENCE.join(', ')}.` });
    if (!enteredAt) errors.push({ field: 'entered_at', message: 'entered_at must be a valid date.' });
    if (exitedAtRaw && !exitedAt) errors.push({ field: 'exited_at', message: 'exited_at must be a valid date.' });
    if (enteredAt && exitedAt && exitedAt.getTime() < enteredAt.getTime()) errors.push({ field: 'exited_at', message: 'exited_at cannot be earlier than entered_at.' });
    if (!stageStatus) errors.push({ field: 'stage_status', message: `stage_status must be one of ${Array.from(STAGE_STATUSES).join(', ')}.` });
    if (nextStageRaw && !nextStage) errors.push({ field: 'next_stage', message: `next_stage must be one of ${STAGE_SEQUENCE.join(', ')}.` });
    errors.push(...validateStageFlowRules({ stageName, stageStatus, enteredAt, exitedAt, nextStage, exitReason }));

    if (leadId) {
      if (!existingLeadIds.has(leadId)) errors.push({ field: 'lead_id', message: 'lead_id does not exist in funnel leads.' });
    }

    if (leadId && stageName && enteredAt) {
      const existingKey = `${leadId}::${stageName}::${enteredAt.toISOString()}`;
      if (existingStageKeys.has(existingKey) && params.overwriteMode === 'skip_duplicates') warnings.push({ field: 'stage_name', message: 'A matching record already exists and will be skipped.' });
    }

    const rowResult: {
      rowNumber: number;
      original: Record<string, string>;
      valid: boolean;
      errors: Array<{ field: string; message: string }>;
      warnings: Array<{ field: string; message: string }>;
      mappedRow?: Record<string, unknown>;
    } = {
      rowNumber,
      original,
      valid: errors.length === 0,
      errors,
      warnings,
    };
    if (errors.length === 0) {
      rowResult.mappedRow = {
        lead_id: leadId,
        stage_name: stageName,
        entered_at: enteredAt,
        exited_at: exitedAt,
        stage_status: stageStatus,
        next_stage: nextStage,
        exit_reason: exitReason,
        notes: sanitizeStringValue(parsedRow.mapped.notes),
      };
    }
    rowResults.push(rowResult);
  }

  return {
    ok: true as const,
    rowResults,
    summary: {
      checkedRows: rowResults.length,
      validRows: rowResults.filter((row) => row.valid).length,
      invalidRows: rowResults.filter((row) => !row.valid).length,
      warningRows: rowResults.filter((row) => row.warnings.length > 0).length,
    },
  };
}

// POST /m07/stages/upload/preview - parse CSV and return columns+preview+warnings
export async function previewStageUpload(req: Request, res: Response){
  try{
    const file: any = (req as any).file;
    const body: any = (req as any).body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    let text = '';
    if(file && file.buffer) text = file.buffer.toString('utf8');
    else if(body.csvText) text = String(body.csvText);
    else return res.status(400).json({ error: 'file required' });
    const records = parse(text, { bom: true, relax_column_count: true });
    if(!records || records.length === 0) return res.json({ ok: true, columns: [], previewRows: [], warnings: [] });
    const header = records[0].map((c: any) => String(c || '').trim());
    const previewRows = records.slice(1, 21).map((r: any) => r.map((c: any) => (c == null ? '' : String(c))));
    return res.json({ ok: true, columns: header, previewRows, warnings: [] });
  }catch(e){ console.error('[m07.previewStageUpload]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function validateStageUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!body.csv || typeof body.csv !== 'string') return res.status(400).json({ error: 'csv required' });
    if(!body.map || typeof body.map !== 'object') return res.status(400).json({ error: 'map required' });
    const validation = await validateStageRows({
      workspaceId,
      csv: body.csv,
      map: body.map,
      startRow: body.startRow,
      endRow: body.endRow,
      overwriteMode: body.overwriteMode,
    });
    return res.json(validation);
  }catch(e){
    if (e instanceof Error && ['start_row_invalid', 'end_row_before_start', 'end_row_exceeds_total'].includes(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    console.error('[m07.validateStageUpload]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m07/stages/upload/commit - accept mapped rows and insert/update into funnel_stage_history
export async function commitStageUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const overwriteMode = body.overwriteMode || 'overwrite_existing';
    const allowPartial = body.allowPartial === true;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    let rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0 && body.csv && body.map) {
      const validation = await validateStageRows({
        workspaceId,
        csv: String(body.csv),
        map: body.map,
        startRow: body.startRow,
        endRow: body.endRow,
        overwriteMode,
      });
      if (validation.summary.invalidRows > 0 && !allowPartial) {
        return res.status(400).json({ error: 'invalid_rows_present', summary: validation.summary, rowResults: validation.rowResults });
      }
      rows = validation.rowResults.filter((row) => row.valid).map((row) => row.mappedRow);
    }

    if(!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows required' });

    let importedCount = 0; let updatedCount = 0; let skippedCount = 0;
    const warnings: string[] = [];

    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const leadId = sanitizeStringValue(r.lead_id);
      const stageName = normalizeStageName(r.stage_name);
      const enteredRaw = r.entered_at || r.enteredAt || r.entered || null;
      const enteredAt = parseDateValue(enteredRaw);
      if(!leadId){ skippedCount++; warnings.push(`Row ${i+1}: missing lead_id`); continue; }
      if(!stageName){ skippedCount++; warnings.push(`Row ${i+1}: missing stage_name`); continue; }
      if(!enteredAt){ skippedCount++; warnings.push(`Row ${i+1}: invalid entered_at`); continue; }
      // check lead exists
      const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
      if(!lead){ skippedCount++; warnings.push(`Row ${i+1}: referenced lead not found`); continue; }
      // date integrity
      const exitedAt = r.exited_at ? parseDateValue(r.exited_at) : null;
      if(r.exited_at && !exitedAt){ skippedCount++; warnings.push(`Row ${i+1}: invalid exited_at`); continue; }
      if(exitedAt && exitedAt.getTime() < enteredAt.getTime()){ skippedCount++; warnings.push(`Row ${i+1}: exited_at before entered_at`); continue; }
      const stageStatus = normalizeStageStatus(r.stage_status);
      if(!stageStatus){ skippedCount++; warnings.push(`Row ${i+1}: invalid stage_status`); continue; }
      const nextStage = r.next_stage !== undefined ? normalizeStageName(r.next_stage) : null;
      if (r.next_stage !== undefined && sanitizeStringValue(r.next_stage) && !nextStage) { skippedCount++; warnings.push(`Row ${i+1}: invalid next_stage`); continue; }
      const exitReason = sanitizeStringValue(r.exit_reason);
      const stageFlowErrors = validateStageFlowRules({ stageName, stageStatus, enteredAt, exitedAt, nextStage, exitReason });
      if (stageFlowErrors.length > 0) { skippedCount++; warnings.push(`Row ${i+1}: ${stageFlowErrors[0]?.message || 'invalid stage flow'}`); continue; }

      const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
      const payload: any = {
        workspace_id: workspaceId,
        lead_id: leadId,
        stage_name: stageName,
        entered_at: enteredAt,
        exited_at: exitedAt || null,
        stage_status: stageStatus,
        next_stage: nextStage,
        exit_reason: exitReason,
        notes: sanitizeStringValue(r.notes),
      };

      const existing = await StageHistory.findOne(filter).lean();
      if(existing){
        if(overwriteMode === 'skip_duplicates'){ skippedCount++; warnings.push(`Row ${i+1}: duplicate skipped`); continue; }
        await StageHistory.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } });
        updatedCount++;
      } else {
        await StageHistory.create(payload);
        importedCount++;
      }
    }

    return res.json({ ok: true, importedCount, updatedCount, skippedCount, warnings });
  }catch(e){ console.error('[m07.commitStageUpload]', e); return res.status(500).json({ error: 'internal' }); }
}

// GET /m07/stages - list with filters
export async function listStages(req: Request, res: Response){
  try{
    const workspace = String(req.query.workspaceId || req.query.workspace || '');
    if(!workspace) return res.status(400).json({ error: 'workspaceId required' });
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(200, Math.max(5, parseInt(String(req.query.pageSize || '25'), 10)));
    const filter: any = { workspace_id: workspace };
    if(req.query.leadId) filter.lead_id = String(req.query.leadId);
    if(req.query.stageName) filter.stage_name = String(req.query.stageName);
    if(req.query.status) filter.stage_status = String(req.query.status);
    if(req.query.includeArchived !== '1' && req.query.includeArchived !== 'true') filter.is_archived = { $ne: true };
    if(req.query.enteredFrom || req.query.enteredTo){ filter.entered_at = {}; if(req.query.enteredFrom) filter.entered_at.$gte = new Date(String(req.query.enteredFrom)); if(req.query.enteredTo) filter.entered_at.$lte = new Date(String(req.query.enteredTo)); }
    if(req.query.exitedFrom || req.query.exitedTo){ filter.exited_at = {}; if(req.query.exitedFrom) filter.exited_at.$gte = new Date(String(req.query.exitedFrom)); if(req.query.exitedTo) filter.exited_at.$lte = new Date(String(req.query.exitedTo)); }
    const total = await StageHistory.countDocuments(filter);
    const items = await StageHistory.find(filter).sort({ entered_at: -1 }).skip((page-1)*pageSize).limit(pageSize).lean();
    return res.json({ ok: true, items, total, page, pageSize });
  }catch(e){ console.error('[m07.listStages]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function getStage(req: Request, res: Response){
  try{
    const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' });
    const doc = await StageHistory.findById(id).lean(); if(!doc) return res.status(404).json({ error: 'not found' });
    return res.json({ ok: true, item: doc });
  }catch(e){ console.error('[m07.getStage]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function updateStage(req: Request, res: Response){
  try{
    const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' });
    const existing = await StageHistory.findById(id).lean();
    if(!existing) return res.status(404).json({ error: 'not found' });
    const body: any = req.body || {};
    const update: any = {};
    if(Object.prototype.hasOwnProperty.call(body,'stage_name')){
      const stageName = normalizeStageName(body.stage_name);
      if(!stageName) return res.status(400).json({ error: 'stage_name required' });
      update.stage_name = stageName;
    }
    if(Object.prototype.hasOwnProperty.call(body,'entered_at')){
      const enteredAt = parseDateValue(body.entered_at);
      if(!enteredAt) return res.status(400).json({ error: 'entered_at required and must be a valid date' });
      update.entered_at = enteredAt;
    }
    if(Object.prototype.hasOwnProperty.call(body,'exited_at')){
      if (body.exited_at) {
        const exitedAt = parseDateValue(body.exited_at);
        if(!exitedAt) return res.status(400).json({ error: 'exited_at must be a valid date' });
        update.exited_at = exitedAt;
      } else {
        update.exited_at = null;
      }
    }
    if(Object.prototype.hasOwnProperty.call(body,'stage_status')){
      const stageStatus = normalizeStageStatus(body.stage_status);
      if(!stageStatus) return res.status(400).json({ error: 'invalid stage_status', allowed: Array.from(STAGE_STATUSES) });
      update.stage_status = stageStatus;
    }
    if(Object.prototype.hasOwnProperty.call(body,'next_stage')){
      const nextStageRaw = sanitizeStringValue(body.next_stage);
      if (nextStageRaw) {
        const nextStage = normalizeStageName(nextStageRaw);
        if (!nextStage) return res.status(400).json({ error: 'invalid next_stage', allowed: STAGE_SEQUENCE });
        update.next_stage = nextStage;
      } else {
        update.next_stage = null;
      }
    }
    if(Object.prototype.hasOwnProperty.call(body,'exit_reason')) update.exit_reason = sanitizeStringValue(body.exit_reason);
    if(Object.prototype.hasOwnProperty.call(body,'notes')) update.notes = sanitizeStringValue(body.notes);
    const enteredAt = update.entered_at || existing.entered_at;
    const exitedAt = Object.prototype.hasOwnProperty.call(update, 'exited_at') ? update.exited_at : existing.exited_at;
    if(exitedAt && enteredAt && new Date(exitedAt).getTime() < new Date(enteredAt).getTime()) return res.status(400).json({ error: 'exited_at before entered_at' });
    const stageName = update.stage_name || existing.stage_name;
    const stageStatus = update.stage_status || existing.stage_status;
    const nextStage = Object.prototype.hasOwnProperty.call(update, 'next_stage') ? update.next_stage : existing.next_stage;
    const exitReason = Object.prototype.hasOwnProperty.call(update, 'exit_reason') ? update.exit_reason : existing.exit_reason;
    const stageFlowErrors = validateStageFlowRules({
      stageName,
      stageStatus,
      enteredAt: enteredAt ? new Date(enteredAt) : null,
      exitedAt: exitedAt ? new Date(exitedAt) : null,
      nextStage,
      exitReason,
    });
    if (stageFlowErrors.length > 0) return res.status(400).json({ error: 'invalid_stage_flow', details: stageFlowErrors });
    update.updated_at = new Date();
    await StageHistory.updateOne({ _id: id }, { $set: update });
    const doc = await StageHistory.findById(id).lean();
    return res.json({ ok: true, item: doc });
  }catch(e){ console.error('[m07.updateStage]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function archiveStage(req: Request, res: Response){
  try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await StageHistory.updateOne({ _id: id }, { $set: { is_archived: true, updated_at: new Date() } }); return res.json({ ok: true }); }catch(e){ console.error('[m07.archiveStage]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function deleteStagePermanent(req: Request, res: Response){
  try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await StageHistory.deleteOne({ _id: id }); return res.json({ ok: true }); }catch(e){ console.error('[m07.deleteStagePermanent]', e); return res.status(500).json({ error: 'internal' }); }
}
