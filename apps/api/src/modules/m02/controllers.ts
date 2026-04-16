import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse } from 'csv-parse';
import MergedFile from '../m01/models/MergedFile.js';
import IntentRun from './models/IntentRun.js';
import fs from 'fs';
import { Readable } from 'stream';
import { CampaignTouch } from '../m06/models/CampaignTouch.js';
import M2LeadIntentSummary from './models/M2LeadIntentSummary.js';
import M2LeadBehaviorEvent from './models/M2LeadBehaviorEvent.js';
import { getM02ForecastFilters, runM02DatasetForecast } from './forecasting.js';

type IntentSegment = 'COLD' | 'WARM' | 'HOT' | 'BLAZING';
type BehaviorEventType = 'email_open' | 'email_click' | 'reply' | 'website_visit' | 'linkedin_view' | 'call' | 'demo_request';

// GET /m02/lead-score-files?workspace=
export async function listLeadScoreFiles(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    if (workspace && !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
    const filter: any = workspace ? { workspace } : {};
    // For now, reuse MergedFile list (these are merged leadscore CSVs)
    const items = await MergedFile.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error('[m02.listLeadScoreFiles]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

function clamp(n:number, a=0, b=100){ return Math.max(a, Math.min(b, n)); }

// POST /m02/generate-intent
// body: { leadScoreFileId }
export async function generateIntent(req: Request, res: Response) {
  try {
    const leadScoreFileId = String(req.body.leadScoreFileId || '');
    const workspace = (req.body.workspace as string) || null;
    if (!mongoose.isValidObjectId(leadScoreFileId)) return res.status(400).json({ error: 'invalid leadScoreFileId' });
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace is required' });

    const mf = await MergedFile.findById(leadScoreFileId).lean();
    if (!mf) return res.status(404).json({ error: 'lead score file not found' });

    const db = mongoose.connection.db as any;
    if (!db) return res.status(500).json({ error: 'db not ready' });

    // Create an IntentRun record in processing state
    const run = await IntentRun.create({ leadScoreFile: leadScoreFileId, workspace, status: 'processing', filename: '', rowCountBefore: 0 });

    // process synchronously: read from GridFS bucket 'm01_merged' and write to 'm02_intent'
    const inBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm01_merged' });
    const outBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });

    const downloadStream = inBucket.openDownloadStream(mf.fileId);
    const ts = Date.now();
    const outFilename = `intent_${mf.filename || mf.name || leadScoreFileId}_${ts}.csv`;
    const uploadStream = outBucket.openUploadStream(outFilename, { contentType: 'text/csv', metadata: { sourceMergedId: leadScoreFileId, workspace } });

    let header: string[] = [];
    let wroteHeader = false;
    let rowCount = 0;

    const parser = parse({ bom: true });
    parser.on('readable', async () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        if (!header || header.length === 0) {
          header = rec.map(c => String(c || '').trim());
          // extend header with intent columns
          const newHeader = header.concat(['IntentScore','ShortTermIntent','MediumTermIntent','LongTermIntent','IntentCategory']);
          uploadStream.write((newHeader.map(escapeCsv).join(',') + '\n'));
          wroteHeader = true;
          continue;
        }
        // produce intent values
        const obj:any = {};
        for (let i=0;i<header.length;i++){
          const key = header[i]; if (!key) continue;
          obj[String(key)] = (rec[i] ?? '');
        }
        const leadScoreRaw = obj['LeadScore'] ?? obj['lead_score'] ?? obj['leadScore'] ?? obj['leadscore'] ?? '';
        let leadScore = parseFloat(String(leadScoreRaw || '').replace(/,/g, ''));
        if (isNaN(leadScore)) leadScore = 0;
        // simple proxy: scale leadScore to intent (this should be replaced with real model invocation)
        let intent = clamp(leadScore * 1.1, 0, 100);
        const shortTerm = intent >= 70 ? 'High' : (intent >= 35 ? 'Medium' : 'Low');
        const mediumTerm = intent >= 60 ? 'High' : (intent >= 30 ? 'Medium' : 'Low');
        const longTerm = intent >= 50 ? 'High' : (intent >= 25 ? 'Medium' : 'Low');
        const category = intent >= 70 ? 'High' : (intent >= 35 ? 'Medium' : 'Low');

        const outRow = header.map((h) => escapeCsv(String(obj[h] ?? ''))).concat([
          escapeCsv(String(intent.toFixed(2))), escapeCsv(shortTerm), escapeCsv(mediumTerm), escapeCsv(longTerm), escapeCsv(category)
        ]).join(',') + '\n';
        uploadStream.write(outRow);
        rowCount += 1;
      }
    });
    parser.on('error', async (err:any) => {
      console.error('[m02.generateIntent] parse error', err);
      try { uploadStream.end(); } catch(_){}
      await IntentRun.findByIdAndUpdate(run._id, { status: 'error', warnings: { parseError: String(err) } });
    });
    parser.on('end', async () => {
      try {
        uploadStream.end();
      } catch(_){}
      // finalize run
      await IntentRun.findByIdAndUpdate(run._id, { status: 'success', filename: outFilename, fileId: uploadStream.id, rowCountBefore: rowCount, rowCountAfter: rowCount });
      return;
    });

    // helper to escape CSV cells
    function escapeCsv(s:string){
      if (s == null) return '';
      const needs = /[",\n,]/.test(s);
      if (needs) return '"' + String(s).replace(/"/g, '""') + '"';
      return String(s);
    }

    // pipe download stream into parser
    downloadStream.pipe(parser);

    return res.json({ ok: true, intentRunId: run._id });
  } catch (e) {
    console.error('[m02.generateIntent] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/intent-runs/:id/preview
export async function previewIntentRun(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    const perPage = parseInt(String(req.query.perPage || '20'), 10) || 20;
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const run = await IntentRun.findById(id).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'not found or not ready' });
    const db = mongoose.connection.db as any;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    const downloadStream = bucket.openDownloadStream(run.fileId);
    const RECORD_LIMIT = 500;
    const parser = parse({ bom: true });
    const bufferRecords: string[][] = [];
    let handled = false;
    const processRecords = () => {
      if (handled) return; handled = true;
      const header = bufferRecords[0] || [];
      const dataRecords = bufferRecords.slice(1);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const rowsOut = dataRecords.slice(start, end);
      return res.json({ ok: true, header, rows: rowsOut, page, perPage, hasMore: dataRecords.length > end });
    };
    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        bufferRecords.push(rec);
        if (bufferRecords.length >= RECORD_LIMIT) {
          try { downloadStream.destroy(); } catch(_){}
          try { parser.destroy(); } catch(_){}
          processRecords();
          return;
        }
      }
    });
    parser.on('end', () => { processRecords(); });
    parser.on('error', (err:any) => { console.error('[m02.preview] parse error', err); if (!handled) return res.status(500).json({ error: 'parse error' }); });
    downloadStream.on('error', (err:any) => { console.error('[m02.preview] download error', err); if (!handled) return res.status(500).json({ error: 'download error' }); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error('[m02.previewIntentRun] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/intent-runs?workspace=
export async function listIntentRuns(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    if (workspace && !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
    const filter: any = workspace ? { workspace } : {};
    const runs = await IntentRun.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ ok: true, runs });
  } catch (e) {
    console.error('[m02.listIntentRuns]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/run-data/:id - aggregated metrics + sample rows for prioritization
export async function getRunData(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const run = await IntentRun.findById(id).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'not found or not ready' });
    const db = mongoose.connection.db as any;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    const downloadStream = bucket.openDownloadStream(run.fileId);

    const parser = parse({ bom: true });
    let header: string[] = [];
    let total = 0;
    let sumLead = 0;
    let sumIntent = 0;
    const intentCategoryCounts: any = { High: 0, Medium: 0, Low: 0 };
    const quadrantCounts: any = { hot: 0, highIntentLowFit: 0, nurture: 0, cold: 0 };
    const samples: string[][] = [];
    const SAMPLE_LIMIT = 5000; // max points for scatter/sample

    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        if (!header || header.length === 0) { header = rec.map(c => String(c || '').trim()); continue; }
        total += 1;
        const obj:any = {};
        for (let i=0;i<header.length;i++){ const key = header[i]; if (!key) continue; obj[String(key)] = (rec[i] ?? ''); }
        const leadScoreRaw = obj['LeadScore'] ?? obj['lead_score'] ?? obj['leadscore'] ?? '';
        const intentRaw = obj['IntentScore'] ?? obj['intent_score'] ?? obj['intentscore'] ?? '';
        let ls = parseFloat(String(leadScoreRaw || '').replace(/,/g, ''));
        let iscore = parseFloat(String(intentRaw || '').replace(/,/g, ''));
        if (isNaN(ls)) ls = 0; if (isNaN(iscore)) iscore = 0;
        sumLead += ls; sumIntent += iscore;
        const cat = String(obj['IntentCategory'] || '').trim() || (iscore >= 70 ? 'High' : (iscore >=35 ? 'Medium' : 'Low'));
        if (!intentCategoryCounts[cat]) intentCategoryCounts[cat] = 0; intentCategoryCounts[cat] += 1;
        // quadrant thresholds default 70
        const leadThresh = 70, intentThresh = 70;
        if (ls >= leadThresh && iscore >= intentThresh) quadrantCounts.hot += 1;
        else if (ls < leadThresh && iscore >= intentThresh) quadrantCounts.highIntentLowFit += 1;
        else if (ls >= leadThresh && iscore < intentThresh) quadrantCounts.nurture += 1;
        else quadrantCounts.cold += 1;
        if (samples.length < SAMPLE_LIMIT) {
          samples.push([String(obj['lead_id']||''), String(obj['name']||obj['Name']||''), String(obj['email']||''), String(ls), String(iscore), String(cat)]);
        }
      }
    });
    parser.on('end', () => {
      const avgLead = total ? (sumLead/total) : 0;
      const avgIntent = total ? (sumIntent/total) : 0;
      return res.json({ ok: true, meta: { total, avgLead, avgIntent, intentCategoryCounts, quadrantCounts }, header, samples, run });
    });
    parser.on('error', (err:any) => { console.error('[m02.runData] parse error', err); return res.status(500).json({ error: 'parse error' }); });
    downloadStream.on('error', (err:any) => { console.error('[m02.runData] download error', err); return res.status(500).json({ error: 'download error' }); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error('[m02.getRunData] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/intent-runs/:id/download - stream the CSV
export async function downloadRunCsv(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const run = await IntentRun.findById(id).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'not found or not ready' });
    const db = mongoose.connection.db as any;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${run.filename || 'intent_run.csv'}"`);
    const downloadStream = bucket.openDownloadStream(run.fileId);
    downloadStream.pipe(res);
  } catch (e) {
    console.error('[m02.downloadRunCsv] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/run-lead/:runId/:leadId - return the CSV row for a given lead in a run
export async function getLeadFromRun(req: Request, res: Response) {
  try {
    const runId = String(req.params.runId || '');
    const leadId = String(req.params.leadId || '');
    if (!mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'invalid run id' });
    if (!leadId) return res.status(400).json({ error: 'lead id required' });
    const run = await IntentRun.findById(runId).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'run not found or not ready' });
    const db = mongoose.connection.db as any;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    const downloadStream = bucket.openDownloadStream(run.fileId);
    const parser = parse({ bom: true });
    let header: string[] = [];
    let found = false;
    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        if (!header || header.length === 0) { header = rec.map(c => String(c || '').trim()); continue; }
        const obj: any = {};
        for (let i = 0; i < header.length; i++){ const key = header[i]; if (!key) continue; obj[String(key)] = (rec[i] ?? ''); }
        // try matching against common lead id columns
        const candidates = ['lead_id','LeadID','leadId','id','leadid'];
        const match = candidates.some(k => {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) return false;
          const v = String(obj[k] ?? '').trim();
          return v === leadId || v === String(Number(leadId));
        });
        if (match) {
          found = true;
          downloadStream.destroy();
          try { parser.destroy(); } catch(_){}
          return res.json({ ok: true, header, row: obj, run });
        }
      }
    });
    parser.on('end', () => {
      if (!found) return res.status(404).json({ error: 'lead not found in run' });
    });
    parser.on('error', (err:any) => { console.error('[m02.getLeadFromRun] parse error', err); if (!res.headersSent) return res.status(500).json({ error: 'parse error' }); });
    downloadStream.on('error', (err:any) => { console.error('[m02.getLeadFromRun] download error', err); if (!res.headersSent) return res.status(500).json({ error: 'download error' }); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error('[m02.getLeadFromRun] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/segment-behavior - aggregate touches for segments in a run
export async function getSegmentBehavior(req: Request, res: Response) {
  try {
    const runId = String(req.query.runId || '');
    const segmentType = String(req.query.segmentType || 'priority'); // priority|intentCategory|leadScoreBand
    const segmentValue = req.query.segmentValue ?? null; // optional to focus on one
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : new Date();
    const channels = req.query.channels ? String(req.query.channels).split(',').map(s=>s.trim()).filter(Boolean) : [];
    const eventTypes = req.query.eventTypes ? String(req.query.eventTypes).split(',').map(s=>s.trim()).filter(Boolean) : [];
    const bucket = String(req.query.bucket || 'day'); // day|week|month

    if (!mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'invalid run id' });
    const run = await IntentRun.findById(runId).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'run not found or not ready' });

    const db = mongoose.connection.db as any;
    const bucketFs = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    const downloadStream = bucketFs.openDownloadStream(run.fileId);
    const parser = parse({ bom: true });

    const header: string[] = [];
    const leadMap: Map<string, any> = new Map(); // leadId -> { leadScore, intent, intentCategory, priorityTier }
    const leadIds: string[] = [];

    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        if (header.length === 0) {
          for (let i=0;i<rec.length;i++) header.push(String(rec[i]||'').trim());
          continue;
        }
        const obj: any = {};
        for (let i=0;i<header.length;i++){ const key = header[i]; if (!key) continue; obj[String(key)] = (rec[i] ?? ''); }
        const leadId = String(obj['lead_id'] ?? obj['LeadID'] ?? obj['leadId'] ?? obj['id'] ?? obj['lead'] ?? '').trim();
        if (!leadId) continue;
        const leadScore = parseFloat(String(obj['LeadScore']||obj['lead_score']||obj['leadscore']||'') || '0') || 0;
        const intent = parseFloat(String(obj['IntentScore']||obj['intent_score']||obj['intentscore']||'') || '0') || 0;
        const intentCategory = String(obj['IntentCategory'] || obj['Intent'] || (intent>=70?'High':(intent>=35?'Medium':'Low')));
        // priority tiers by LeadScore bands
        let priorityTier = 'P4';
        if (leadScore >= 70) priorityTier = 'P1'; else if (leadScore >= 50) priorityTier = 'P2'; else if (leadScore >= 35) priorityTier = 'P3';
        leadMap.set(leadId, { leadId, leadScore, intent, intentCategory, priorityTier, row: obj });
        leadIds.push(leadId);
      }
    });

    parser.on('end', async () => {
      // Build segment groups
      const groups: Record<string, { leadIds: string[]; totalLeads:number; avgIntent:number; avgLead:number }> = {};
      for (const [lid, info] of Array.from(leadMap.entries())) {
        let key = 'unknown';
        if (segmentType === 'priority') key = info.priorityTier;
        else if (segmentType === 'intentCategory') key = info.intentCategory;
        else if (segmentType === 'leadScoreBand') {
          const ls = info.leadScore; if (ls>=70) key='70-100'; else if (ls>=40) key='40-69'; else key='0-39';
        }
        if (segmentValue && String(segmentValue) !== String(key)) continue;
        if (!groups[key]) groups[key] = { leadIds: [], totalLeads:0, avgIntent:0, avgLead:0 };
        const g = groups[key]!;
        g.leadIds.push(lid);
        g.totalLeads += 1;
        g.avgIntent += info.intent;
        g.avgLead += info.leadScore;
      }
      for (const k of Object.keys(groups)) {
        const g = groups[k]!;
        g.avgIntent = g.totalLeads ? (g.avgIntent / g.totalLeads) : 0;
        g.avgLead = g.totalLeads ? (g.avgLead / g.totalLeads) : 0;
      }

      // prepare date buckets
      const s = start ? new Date(start) : new Date(Date.now() - 30*24*3600*1000);
      const e = end ? new Date(end) : new Date();
      if (s > e) return res.status(400).json({ error: 'start must be <= end' });
      // generate bucket keys
      const buckets: string[] = [];
      const cur = new Date(s);
      while (cur <= e) {
        if (bucket === 'month') buckets.push(`${cur.getFullYear()}-${(cur.getMonth()+1).toString().padStart(2,'0')}`);
        else if (bucket === 'week') {
          const wk = getWeekKey(cur);
          buckets.push(wk);
        } else buckets.push(`${cur.getFullYear()}-${(cur.getMonth()+1).toString().padStart(2,'0')}-${cur.getDate().toString().padStart(2,'0')}`);
        // advance
        if (bucket === 'month') cur.setMonth(cur.getMonth()+1);
        else cur.setDate(cur.getDate()+1);
      }

      // query campaign touches for these lead ids
      const touchFilter: any = { lead_id: { $in: Array.from(leadMap.keys()) } };
      if (start) touchFilter.touched_at = touchFilter.touched_at || {}; if (start) touchFilter.touched_at.$gte = start; if (end) touchFilter.touched_at.$lte = end;
      if (channels && channels.length) touchFilter.channel = { $in: channels };
      if (eventTypes && eventTypes.length) touchFilter.type = { $in: eventTypes };
      const touches = await CampaignTouch.find(touchFilter).lean();

      // aggregate
      const timeseries: Record<string, Record<string, number>> = {}; // segment -> bucketKey -> count
      const channelBreakdown: Record<string, Record<string, number>> = {}; // segment -> channel -> count
      for (const seg of Object.keys(groups)) { timeseries[seg] = {}; channelBreakdown[seg] = {}; for (const b of buckets) (timeseries[seg] as Record<string, number>)[b]=0; }

      for (const t of touches) {
        const lid = String(t.lead_id);
        const info = leadMap.get(lid) || leadMap.get(String(Number(lid))) || null;
        if (!info) continue;
        let segKey = 'unknown';
        if (segmentType === 'priority') segKey = info.priorityTier;
        else if (segmentType === 'intentCategory') segKey = info.intentCategory;
        else if (segmentType === 'leadScoreBand') {
          const ls = info.leadScore; if (ls>=70) segKey='70-100'; else if (ls>=40) segKey='40-69'; else segKey='0-39';
        }
        if (segmentValue && String(segmentValue) !== String(segKey)) continue;
        const d = new Date(t.touched_at || t.createdAt || Date.now());
        let key = '';
        if (bucket === 'month') key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
        else if (bucket === 'week') key = getWeekKey(d);
        else key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        if (!timeseries[segKey]) timeseries[segKey] = {};
        const tsSeg = timeseries[segKey] as Record<string, number>;
        tsSeg[key] = (tsSeg[key] || 0) + 1;
        if (!channelBreakdown[segKey]) channelBreakdown[segKey] = {};
        const chSeg = channelBreakdown[segKey] as Record<string, number>;
        chSeg[t.channel || 'other'] = (chSeg[t.channel || 'other'] || 0) + 1;
      }

      // top leads per segment
      const topLeads: Record<string, any[]> = {};
      for (const seg of Object.keys(groups)) {
        const lids = (groups[seg] && groups[seg].leadIds) || [];
        const leadInfos = lids.map(l => leadMap.get(l)).filter(Boolean).sort((a:any,b:any)=> (b.intent - a.intent)).slice(0,10);
        topLeads[seg] = leadInfos;
      }

      return res.json({ ok: true, meta: { runId, segmentType, buckets }, groups, timeseries, channelBreakdown, topLeads });
    });

    parser.on('error', (err:any) => { console.error('[m02.segmentBehavior] parse error', err); return res.status(500).json({ error: 'parse error' }); });
    downloadStream.on('error', (err:any) => { console.error('[m02.segmentBehavior] download error', err); return res.status(500).json({ error: 'download error' }); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error('[m02.getSegmentBehavior] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

function getWeekKey(d:Date){
  const y = d.getFullYear();
  const onejan = new Date(y,0,1);
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay()+1)/7);
  return `${y}-W${String(week).padStart(2,'0')}`;
}

// POST /m02/intent-forecast - agent-backed forecasting (simple heuristic implementation)
export async function intentForecast(req: Request, res: Response) {
  try {
    const runId = String(req.body.runId || '');
    const scope = req.body.scope || { type: 'all', value: null }; // {type: 'segment'|'all', value: 'P1' }
    const horizons = Array.isArray(req.body.horizons) ? req.body.horizons.map(Number) : [7,30,90];
    const userQuery = String(req.body.query || '').trim();
    if (!mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'invalid run id' });
    const run = await IntentRun.findById(runId).lean();
    if (!run || !run.fileId) return res.status(404).json({ error: 'run not found or not ready' });

    // Build historical daily avg IntentScore for the requested scope
    const db = mongoose.connection.db as any;
    const bucketFs = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });
    const downloadStream = bucketFs.openDownloadStream(run.fileId);
    const parser = parse({ bom: true });
    const header: string[] = [];
    const daily: Record<string, { sum:number; count:number }> = {};
    const leadMap: Map<string, any> = new Map();

    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        if (header.length === 0) { for (let i=0;i<rec.length;i++) header.push(String(rec[i]||'').trim()); continue; }
        const obj:any = {};
        for (let i=0;i<header.length;i++){ const key = header[i]; if (!key) continue; obj[String(key)] = (rec[i] ?? ''); }
        const leadId = String(obj['lead_id'] ?? obj['LeadID'] ?? obj['leadId'] ?? obj['id'] ?? '').trim();
        if (!leadId) continue;
        const intent = parseFloat(String(obj['IntentScore']||obj['intent_score']||'')||'0') || 0;
        const leadScore = parseFloat(String(obj['LeadScore']||'')||'0') || 0;
        const intentCategory = String(obj['IntentCategory'] || (intent>=70?'High':(intent>=35?'Medium':'Low')));
        let matchesScope = false;
        if (scope.type === 'all') matchesScope = true;
        else if (scope.type === 'segment') {
          if (scope.by === 'priority') {
            let p='P4'; if (leadScore>=70) p='P1'; else if (leadScore>=50) p='P2'; else if (leadScore>=35) p='P3'; if (String(scope.value)===p) matchesScope = true;
          } else if (scope.by === 'intentCategory') { if (String(scope.value) === intentCategory) matchesScope = true; }
        }
        if (!matchesScope) continue;
        const createdAt = obj['created_at'] ? new Date(obj['created_at']) : null;
        // for historical timeline prefer using createdAt if present else use run createdAt
        const d = createdAt || new Date(run.createdAt || Date.now());
        const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        if (!daily[key]) daily[key] = { sum:0, count:0 };
        daily[key].sum += intent; daily[key].count += 1;
        leadMap.set(leadId, { leadId, leadScore, intent });
      }
    });

    parser.on('end', async () => {
      // convert to sorted arrays
      const keys = Object.keys(daily).sort();
      const historical = keys.map(k => ({ date: k, avgIntent: (daily[k] && daily[k].count) ? (daily[k].sum/daily[k].count) : 0 }));
      // simple linear trend forecast using last 7 days slope
      const lastN = 7;
      const recent = historical.slice(-lastN);
      let slope = 0;
      if (recent.length >= 2) {
        const x = recent.map((_,i)=>i);
        const xm = x.reduce((a,b)=>a+b,0)/x.length;
        const ym = recent.reduce((a,b)=>a + (b.avgIntent || 0),0)/recent.length;
        let num = 0;
        for (let i=0;i<recent.length;i++){ const xi = i; const entry:any = recent[i]; const yi = (entry && typeof entry.avgIntent === 'number') ? entry.avgIntent : 0; num += (xi - xm) * (yi - ym); }
        const den = x.reduce((acc,xi)=> acc + ((xi-xm)**2), 0) || 1;
        slope = num/den;
      }
      // baseline last value
      const lastVal = historical.length ? historical[historical.length-1]!.avgIntent : 0;
      const forecast:any[] = [];
      for (const h of horizons) {
        const pred = lastVal + slope * (h/7); // scale slope per week
        const lower = Math.max(0, pred - Math.abs(pred)*0.1);
        const upper = Math.min(100, pred + Math.abs(pred)*0.1);
        forecast.push({ horizonDays: h, predictedAvg: Number(pred.toFixed(2)), lower: Number(lower.toFixed(2)), upper: Number(upper.toFixed(2)) });
      }

      // assemble explanation (agent-like text) - keep simple and deterministic
      let trend = 'stable';
      if (forecast[0] && forecast[0].predictedAvg > lastVal + 1) trend = 'rising';
      else if (forecast[0] && forecast[0].predictedAvg < lastVal - 1) trend = 'falling';
      const explanation = `Forecast generated for scope=${JSON.stringify(scope)}. Historical avg intent across ${historical.length} days is ${ (historical.reduce((a,b)=>a+b.avgIntent,0)/(historical.length||1)).toFixed(2) }. Recent trend appears ${trend}. ${ userQuery ? 'User query: ' + userQuery : '' }`;

      return res.json({ ok: true, runId, scope, historical, forecast, explanation, topLeads: Array.from(leadMap.values()).sort((a:any,b:any)=> b.intent - a.intent).slice(0,10) });
    });

    parser.on('error', (err:any) => { console.error('[m02.intentForecast] parse error', err); return res.status(500).json({ error: 'parse error' }); });
    downloadStream.on('error', (err:any) => { console.error('[m02.intentForecast] download error', err); return res.status(500).json({ error: 'download error' }); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error('[m02.intentForecast] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m02/seed-demo - create a small demo intent run + touches for UI testing
export async function seedDemo(req: Request, res: Response) {
  try {
    const workspaceRaw = req.body.workspace || req.query.workspace || null;
    const workspaceId = (workspaceRaw && mongoose.isValidObjectId(String(workspaceRaw))) ? new mongoose.Types.ObjectId(String(workspaceRaw)) : new mongoose.Types.ObjectId();

    const db = mongoose.connection.db as any;
    const outBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'm02_intent' });

    // create 6 demo leads with object ids
    const leads = Array.from({ length: 6 }).map(()=> new mongoose.Types.ObjectId());
    const header = ['lead_id','name','email','LeadScore','IntentScore','IntentCategory'];
    const rows: string[][] = [];
    const now = Date.now();
    for (let i=0;i<leads.length;i++){
      const lid = leads[i]!.toHexString();
      const name = `Demo Lead ${i+1}`;
      const email = `demo${i+1}@example.com`;
      const ls = Math.floor(30 + Math.random()*70);
      const intent = Math.min(100, Math.round((ls * (0.8 + Math.random()*0.6))*100)/100);
      const cat = intent >= 70 ? 'High' : (intent >= 35 ? 'Medium' : 'Low');
      rows.push([lid, name, email, String(ls), String(intent), cat]);
    }

    const filename = `demo_intent_${Date.now()}.csv`;
    const uploadStream = outBucket.openUploadStream(filename, { contentType: 'text/csv', metadata: { demo: true, workspace: workspaceId.toHexString() } });
    // write header
    uploadStream.write(header.join(',') + '\n');
    for (const r of rows) uploadStream.write(r.map(c => { if (/[",\n]/.test(c)) return '"'+String(c).replace(/"/g,'""')+'"'; return String(c); }).join(',') + '\n');
    uploadStream.end();

    uploadStream.once('finish', async ()=>{
      try{
        // create IntentRun doc
        const run = await IntentRun.create({ leadScoreFile: new mongoose.Types.ObjectId(), workspace: workspaceId, status: 'success', filename, fileId: uploadStream.id, rowCountBefore: rows.length, rowCountAfter: rows.length });

        // create a few touches per lead
        const touchDocs:any[] = [];
        const channels = ['email','ads','linkedin','webinar','other'];
        const types = ['email_open','ad_click','webinar','email_click','form_submit','other'];
        for (let i=0;i<leads.length;i++){
          const lid = leads[i];
          const count = 2 + Math.floor(Math.random()*4);
            for (let j=0;j<count;j++){
              const when = new Date(now - Math.floor(Math.random()*30)*24*3600*1000 - Math.floor(Math.random()*86400000));
              touchDocs.push({ project_id: workspaceId, lead_id: leads[i], campaign_id: new mongoose.Types.ObjectId(), channel: channels[Math.floor(Math.random()*channels.length)], type: types[Math.floor(Math.random()*types.length)], touched_at: when, status: 'active' });
            }
        }
        await CampaignTouch.insertMany(touchDocs);

        return res.json({ ok: true, runId: run._id, filename, rows: rows.length });
      }catch(err){
        console.error('[m02.seedDemo] error post-upload', err);
        return res.status(500).json({ error: 'seed write failed' });
      }
    });

  } catch (e) {
    console.error('[m02.seedDemo] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// ---------------------------------------------------------------------------
// New M02 CSV ingest + prioritization + timeline
// ---------------------------------------------------------------------------
const toNumber = (v: any) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const toBoolean = (v: any) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return false;
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  return false;
};
const toDateSafe = (v: any) => {
  if (!v && v !== 0) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const normSegment = (v: any): IntentSegment => {
  const s = String(v ?? '').toUpperCase();
  if (s === 'HOT' || s === 'WARM' || s === 'COLD' || s === 'BLAZING') return s as IntentSegment;
  return 'COLD';
};
const normEventType = (v: any): BehaviorEventType | null => {
  const s = String(v ?? '').toLowerCase().trim();
  const map: Record<string, BehaviorEventType> = {
    email_open: 'email_open',
    open: 'email_open',
    email_click: 'email_click',
    click: 'email_click',
    reply: 'reply',
    website_visit: 'website_visit',
    visit: 'website_visit',
    linkedin_view: 'linkedin_view',
    linkedin: 'linkedin_view',
    call: 'call',
    demo_request: 'demo_request',
    demo: 'demo_request',
  };
  return map[s] || null;
};

async function parseCsvBuffer(buffer: Buffer, onRow: (row: Record<string, any>) => void, required: string[]) {
  return new Promise<void>((resolve, reject) => {
    const parser = parse({ bom: true, columns: true, trim: true, skip_empty_lines: true });
    let validated = false;
    parser.on('readable', () => {
      let rec: any;
      while ((rec = parser.read()) !== null) {
        if (!validated) {
          validated = true;
          const headers = Object.keys(rec || {});
          for (const r of required) {
            if (!headers.includes(r)) {
              parser.destroy(new Error(`missing required column: ${r}`));
              return;
            }
          }
        }
        onRow(rec);
      }
    });
    parser.on('end', () => resolve());
    parser.on('error', (err) => reject(err));
    parser.write(buffer);
    parser.end();
  });
}

// POST /m02/upload/leads-intent
export async function uploadLeadsIntent(req: Request, res: Response) {
  try {
    const workspaceId = (req.body.workspaceId as string) || (req.query.workspaceId as string) || null;
    const file: any = (req as any).file;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspaceId_required' });
    if (!file || !file.buffer) return res.status(400).json({ error: 'file_required' });

    const docs: any[] = [];
    let skipped = 0;
    const warnings: string[] = [];
    await parseCsvBuffer(file.buffer, (row) => {
      const leadId = String(row['lead_id'] ?? '').trim();
      if (!leadId) { skipped += 1; return; }
      const intentScore = toNumber(row['intent_score']);
      if (intentScore === null) { skipped += 1; return; }
      const intentSegment = normSegment(row['intent_segment']);
      const doc: any = {
        workspaceId,
        leadId,
        fullName: row['full_name'] || [row['first_name'], row['last_name']].filter(Boolean).join(' ').trim() || null,
        firstName: row['first_name'] || null,
        lastName: row['last_name'] || null,
        jobTitle: row['job_title'] || null,
        headline: row['headline'] || null,
        company: row['company'] || null,
        companyDomain: row['company_domain'] || null,
        location: row['location'] || null,
        workEmail: row['work_email'] || null,
        intentScore,
        intentSegment,
        engagementScoreRecent: toNumber(row['engagement_score_recent']),
        engagementScore: toNumber(row['engagement_score']),
        salesPressureIndex: toNumber(row['sales_pressure_index']),
        isUrgentEscalation: toBoolean(row['is_urgent_escalation']),
        repPriorityBucket: toNumber(row['rep_priority_bucket']),
        escalationRiskScore: toNumber(row['escalation_risk_score']),
        accountActivityIndex: toNumber(row['account_activity_index']),
        daysSinceLastAction: toNumber(row['days_since_last_action']),
        lastActionTaken: row['last_action_taken'] || null,
        lastActionDate: toDateSafe(row['last_action_date']),
        openRate: toNumber(row['open_rate']),
        clickRate: toNumber(row['click_rate']),
        unsubscribeRate: toNumber(row['unsubscribe_rate']),
        totalEmailsSent: toNumber(row['total_emails_sent']),
        totalOpenCount: toNumber(row['total_open_count']),
        totalClickCount: toNumber(row['total_click_count']),
        totalReplyCount: toNumber(row['total_reply_count']),
        totalActions: toNumber(row['total_actions']),
        channelCall: toNumber(row['channel_call']),
        channelEmail: toNumber(row['channel_email']),
        channelLinkedin: toNumber(row['channel_linkedin']),
        predictedClass: row['predicted_class'] || null,
        predictedLabel: row['predicted_label'] || null,
        confidence: toNumber(row['confidence']),
        pLow: toNumber(row['p_low']),
        pMedium: toNumber(row['p_medium']),
        pHigh: toNumber(row['p_high']),
      };
      const reserved = new Set(Object.keys(doc));
      const raw: Record<string, unknown> = {};
      Object.keys(row || {}).forEach((k) => {
        if (!reserved.has(k) && typeof row[k] !== 'undefined') raw[k] = row[k];
      });
      if (Object.keys(raw).length) doc.raw = raw;
      docs.push(doc);
    }, ['lead_id', 'intent_score', 'intent_segment']);

    await M2LeadIntentSummary.deleteMany({ workspaceId });
    if (docs.length) await M2LeadIntentSummary.insertMany(docs, { ordered: false });

    return res.json({ ok: true, workspaceId, importedCount: docs.length, skippedCount: skipped, warnings });
  } catch (e:any) {
    console.error('[m02.uploadLeadsIntent]', e);
    const msg = e?.message?.includes('missing required column') ? e.message : 'upload_failed';
    return res.status(400).json({ error: msg });
  }
}

// POST /m02/upload/behaviors
export async function uploadBehaviors(req: Request, res: Response) {
  try {
    const workspaceId = (req.body.workspaceId as string) || (req.query.workspaceId as string) || null;
    const file: any = (req as any).file;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspaceId_required' });
    if (!file || !file.buffer) return res.status(400).json({ error: 'file_required' });

    const docs: any[] = [];
    let skipped = 0;
    const warnings: string[] = [];
    await parseCsvBuffer(file.buffer, (row) => {
      const leadId = String(row['lead_id'] ?? '').trim();
      const ts = toDateSafe(row['timestamp']);
      const et = normEventType(row['event_type']);
      if (!leadId || !ts || !et) { skipped += 1; return; }
      docs.push({
        workspaceId,
        leadId,
        timestamp: ts,
        eventType: et,
        engagementScore: toNumber(row['engagement_score']),
        recencyDays: toNumber(row['recency_days']),
        velocity: toNumber(row['velocity']),
        spikeFlag: toBoolean(row['spike_flag']),
        dropFlag: toBoolean(row['drop_flag']),
        intentSegment: normSegment(row['intent_segment']),
        intentScore: toNumber(row['intent_score']),
      });
    }, ['lead_id', 'timestamp', 'event_type']);

    await M2LeadBehaviorEvent.deleteMany({ workspaceId });
    if (docs.length) await M2LeadBehaviorEvent.insertMany(docs, { ordered: false });

    return res.json({ ok: true, workspaceId, importedCount: docs.length, skippedCount: skipped, warnings });
  } catch (e:any) {
    console.error('[m02.uploadBehaviors]', e);
    const msg = e?.message?.includes('missing required column') ? e.message : 'upload_failed';
    return res.status(400).json({ error: msg });
  }
}

function summarizeDrivers(input: {
  intentSegment?: IntentSegment;
  intentScore?: number | null;
  eventsLast30d: number;
  topTypes: string[];
  spikeCount: number;
  dropCount: number;
}) {
  const { intentSegment, intentScore, eventsLast30d, topTypes, spikeCount, dropCount } = input;
  const seg = intentSegment || 'COLD';
  let parts: string[] = [];
  if (seg === 'BLAZING' || (intentScore ?? 0) >= 80) parts.push('Blazing intent');
  else if (seg === 'HOT' || (intentScore ?? 0) >= 60) parts.push('High intent');
  else if (seg === 'WARM') parts.push('Warm intent');
  else parts.push('Cold intent');

  if (eventsLast30d > 15) parts.push('heavy recent activity');
  else if (eventsLast30d > 5) parts.push('steady recent activity');
  else parts.push('light recent activity');

  if (topTypes.length) parts.push(`mostly ${topTypes.slice(0,2).join(', ')}`);
  if (spikeCount > 0) parts.push(`${spikeCount} spikes`);
  if (dropCount > 0) parts.push(`${dropCount} drops`);

  return parts.join('; ');
}

// GET /m02/prioritization
export async function getPrioritization(req: Request, res: Response) {
  try {
    const workspaceId = (req.query.workspaceId as string) || (req.query.workspace as string) || null;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspaceId_required' });
    const segment = (req.query.segment as string) || '';
    const minIntent = Number(req.query.minIntent ?? 0);
    const maxIntent = Number(req.query.maxIntent ?? 100);
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 25)));

    const filter: any = { workspaceId };
    if (segment && segment !== 'ALL') filter.intentSegment = segment;
    filter.intentScore = { $gte: minIntent, $lte: maxIntent };

    const total = await M2LeadIntentSummary.countDocuments(filter);
    const intents = await M2LeadIntentSummary.find(filter).sort({ intentScore: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();

    const leadIds = intents.map((i: any) => i.leadId);
    let behaviorMap: Record<string, any> = {};
    if (leadIds.length) {
      const agg = await M2LeadBehaviorEvent.aggregate([
        { $match: { workspaceId, leadId: { $in: leadIds } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$leadId',
            eventsTotal: { $sum: 1 },
            eventsLast30d: { $sum: { $cond: [{ $gte: ['$timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }, 1, 0] } },
            lastEventDate: { $first: '$timestamp' },
            lastEventType: { $first: '$eventType' },
            spikeCount: { $sum: { $cond: ['$spikeFlag', 1, 0] } },
            dropCount: { $sum: { $cond: ['$dropFlag', 1, 0] } },
            types: { $push: '$eventType' },
          }
        }
      ]).exec();
      behaviorMap = {};
      agg.forEach((a: any) => { behaviorMap[a._id] = a; });
    }

    const rows = intents.map((i: any) => {
      const b = behaviorMap[i.leadId] || {};
      const typeCounts: Record<string, number> = {};
      (b.types || []).forEach((t: string) => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
      const topTypes = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
      const topDriverSummary = summarizeDrivers({
        intentSegment: i.intentSegment as IntentSegment,
        intentScore: i.intentScore,
        eventsLast30d: b.eventsLast30d || 0,
        topTypes,
        spikeCount: b.spikeCount || 0,
        dropCount: b.dropCount || 0,
      });
      return {
        leadId: i.leadId,
        fullName: i.fullName,
        jobTitle: i.jobTitle,
        company: i.company,
        location: i.location,
        intentScore: i.intentScore,
        intentSegment: i.intentSegment,
        engagementScoreRecent: i.engagementScoreRecent,
        engagementScore: i.engagementScore,
        salesPressureIndex: i.salesPressureIndex,
        isUrgentEscalation: i.isUrgentEscalation,
        accountActivityIndex: i.accountActivityIndex,
        daysSinceLastAction: i.daysSinceLastAction,
        lastActionTaken: i.lastActionTaken,
        lastActionDate: i.lastActionDate,
        eventsLast30d: b.eventsLast30d || 0,
        lastEventDate: b.lastEventDate || null,
        lastEventType: b.lastEventType || null,
        spikeCount: b.spikeCount || 0,
        dropCount: b.dropCount || 0,
        topDriverSummary,
      };
    });

    return res.json({ ok: true, total, page, pageSize, rows });
  } catch (e) {
    console.error('[m02.getPrioritization]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/behaviors/timeline
export async function getBehaviorTimeline(req: Request, res: Response) {
  try {
    const workspaceId = (req.query.workspaceId as string) || null;
    const leadId = (req.query.leadId as string) || null;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspaceId_required' });
    if (!leadId) return res.status(400).json({ error: 'leadId_required' });

    const events = await M2LeadBehaviorEvent.find({ workspaceId, leadId }).sort({ timestamp: 1 }).lean();
    const byDayMap: Record<string, { total: number; sumEng: number }> = {};
    const typeMap: Record<string, number> = {};
    events.forEach((e) => {
      const d = new Date(e.timestamp);
      const day = d.toISOString().slice(0,10);
      if (!byDayMap[day]) byDayMap[day] = { total: 0, sumEng: 0 };
      byDayMap[day].total += 1;
      byDayMap[day].sumEng += Number(e.engagementScore || 0);
      typeMap[e.eventType] = (typeMap[e.eventType] || 0) + 1;
    });
    const series = {
      byDay: Object.entries(byDayMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({ date, totalEvents: v.total, avgEngagement: v.total ? v.sumEng / v.total : 0 })),
      byEventType: Object.entries(typeMap).map(([eventType,count])=>({ eventType, count })),
    };
    const totalEvents = events.length;
    const eventsLast30d = events.filter(e=> new Date(e.timestamp).getTime() >= Date.now() - 30*24*60*60*1000).length;
    const avgEngagement = totalEvents ? events.reduce((s,e)=>s+Number(e.engagementScore||0),0)/totalEvents : 0;
    const spikeCount = events.filter(e=>e.spikeFlag).length;
    const dropCount = events.filter(e=>e.dropFlag).length;
    let behaviorNarrative = 'No behavior events uploaded for this lead yet.';
    if (totalEvents > 0) {
      const first = events[0]!;
      const last = events[events.length-1]!;
      const spanDays = Math.max(1, Math.round((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000*60*60*24)));
      if (avgEngagement >= 0.6 || spikeCount > 2) {
        behaviorNarrative = `High engagement over ${spanDays} days with spikes and recent activity (${eventsLast30d} in last 30 days).`;
      } else if (dropCount > spikeCount) {
        behaviorNarrative = `Engagement softening with ${dropCount} drop signals across ${spanDays} days.`;
      } else {
        behaviorNarrative = `Moderate engagement across ${spanDays} days; ${eventsLast30d} recent events.`;
      }
    }

    return res.json({ ok: true, events, series, summary: { totalEvents, eventsLast30d, avgEngagement, spikeCount, dropCount }, behaviorNarrative });
  } catch (e) {
    console.error('[m02.getBehaviorTimeline]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m02/leads/:leadId/behavior-timeline
export async function getBehaviorTimelineByLead(req: Request, res: Response) {
  try {
    const leadId = (req.params.leadId as string) || null;
    const workspaceId = (req.query.workspaceId as string) || (req.query.workspace as string) || null;
    if (!leadId) return res.status(400).json({ ok: false, error: 'leadId_required' });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ ok: false, error: 'workspaceId_required' });

    const startDateStr = (req.query.startDate as string) || '';
    const endDateStr = (req.query.endDate as string) || '';
    const eventTypesStr = (req.query.eventTypes as string) || '';
    const match: any = { workspaceId, leadId };
    if (startDateStr) match.timestamp = { ...(match.timestamp || {}), $gte: new Date(startDateStr) };
    if (endDateStr) match.timestamp = { ...(match.timestamp || {}), $lte: new Date(endDateStr) };
    if (eventTypesStr) {
      const types = eventTypesStr.split(',').map(s => s.trim()).filter(Boolean);
      if (types.length) match.eventType = { $in: types };
    }

    const lead = await M2LeadIntentSummary.findOne({ workspaceId, leadId }).lean();
    if (!lead) return res.status(404).json({ ok: false, error: 'lead_not_found' });

    const events = await M2LeadBehaviorEvent.find(match).sort({ timestamp: 1 }).lean();
    const payloadLead = {
      lead_id: lead.leadId,
      first_name: lead.firstName || '',
      last_name: lead.lastName || '',
      company: lead.company || '',
      title: lead.jobTitle || '',
      intent_score: lead.intentScore ?? null,
      intent_segment: lead.intentSegment || null,
    } as any;
    const payloadEvents = (events || []).map((e:any) => ({
      timestamp: e.timestamp?.toISOString?.() || new Date(e.timestamp).toISOString(),
      event_type: e.eventType,
      engagement_score: Number(e.engagementScore ?? 0),
      recency_days: Number(e.recencyDays ?? 0),
      velocity: Number(e.velocity ?? 0),
      spike_flag: e.spikeFlag ? 1 : 0,
      drop_flag: e.dropFlag ? 1 : 0,
    }));

    return res.json({ ok: true, lead: payloadLead, events: payloadEvents });
  } catch (e:any) {
    console.error('[m02.getBehaviorTimelineByLead]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

export async function getForecastDatasetOptions(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, ...getM02ForecastFilters() });
  } catch (e) {
    console.error('[m02.getForecastDatasetOptions]', e);
    return res.status(500).json({ error: 'forecast_options_failed' });
  }
}

export async function intentForecastDataset(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const segment = typeof body.segment === 'string' && body.segment.trim() ? body.segment.trim() : undefined;
    const industry = typeof body.industry === 'string' && body.industry.trim() ? body.industry.trim() : undefined;
    const horizonMonths = Number.isFinite(Number(body.horizonMonths)) ? Number(body.horizonMonths) : 3;
    const request = {
      ...(segment ? { segment } : {}),
      ...(industry ? { industry } : {}),
      horizonMonths,
    };
    return res.json(runM02DatasetForecast(request));
  } catch (e: any) {
    console.error('[m02.intentForecastDataset]', e);
    const message = typeof e?.message === 'string' ? e.message : 'internal';
    if (message.startsWith('missing_dataset:')) {
      return res.status(400).json({ error: 'missing_dataset', path: message.replace('missing_dataset:', '') });
    }
    return res.status(500).json({ error: 'forecast_failed' });
  }
}
