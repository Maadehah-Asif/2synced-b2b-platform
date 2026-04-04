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

function normalizeStageStatus(value: unknown, fallback = 'active'): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  return STAGE_STATUSES.has(normalized) ? normalized : null;
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
    const engagementScore = normalizeEngagementScore(body.engagement_score);
    if (body.engagement_score !== undefined && engagementScore === null) return res.status(400).json({ error: 'engagement_score must be between 1 and 10' });

    const payload: any = {
      workspace_id: workspaceId,
      interaction_id: sanitizeStringValue(body.interaction_id),
      lead_id: leadId,
      timestamp,
      interaction_type: interactionType,
      channel: sanitizeStringValue(body.channel || body.medium),
      campaign_id: campaignId,
      outcome: sanitizeStringValue(body.outcome),
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

// POST /m07/interactions/upload/commit
export async function commitInteractionUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const rows = body.rows || [];
    const duplicateMode = body.duplicateMode || 'skip_duplicates';
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

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
      const engagementScore = normalizeEngagementScore(r.engagement_score);
      if (r.engagement_score !== undefined && engagementScore === null) { skipped++; warnings.push(`Row ${i+1}: engagement_score must be between 1 and 10`); continue; }

      const payload:any = {
        workspace_id: workspaceId,
        interaction_id: sanitizeStringValue(r.interaction_id),
        lead_id: leadId,
        timestamp,
        interaction_type: itype,
        channel: sanitizeStringValue(r.channel || r.medium),
        campaign_id: campaignId,
        outcome: sanitizeStringValue(r.outcome),
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
    if(Object.prototype.hasOwnProperty.call(body, 'channel')) update.channel = sanitizeStringValue(body.channel);
    if(Object.prototype.hasOwnProperty.call(body, 'campaign_id')){
      const campaignId = sanitizeStringValue(body.campaign_id);
      if (campaignId) {
        const campaign = await Campaign.findOne({ project_id: doc.workspace_id, campaign_id: campaignId }).select('_id').lean();
        if (!campaign) return res.status(400).json({ error: 'referenced campaign not found' });
      }
      update.campaign_id = campaignId;
    }
    if(Object.prototype.hasOwnProperty.call(body, 'outcome')) update.outcome = sanitizeStringValue(body.outcome);
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
    const stageName = sanitizeStringValue(body.stage_name);
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
    // create or overwrite duplicate
    const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
    const payload: any = {
      workspace_id: workspaceId,
      lead_id: leadId,
      stage_name: stageName,
      entered_at: enteredAt,
      exited_at: exitedAt,
      stage_status: stageStatus,
      next_stage: sanitizeStringValue(body.next_stage),
      exit_reason: sanitizeStringValue(body.exit_reason),
      notes: sanitizeStringValue(body.notes),
    };
    // overwrite existing if found
    const existing = await StageHistory.findOne(filter).lean();
    if(existing){ await StageHistory.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } }); return res.json({ ok: true, updated: true }); }
    const doc = await StageHistory.create(payload);
    return res.json({ ok: true, item: doc });
  }catch(e){ console.error('[m07.createStage]', e); return res.status(500).json({ error: 'internal' }); }
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

// POST /m07/stages/upload/commit - accept mapped rows and insert/update into funnel_stage_history
export async function commitStageUpload(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const rows = body.rows || [];
    const overwriteMode = body.overwriteMode || 'overwrite_existing';
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

    let importedCount = 0; let updatedCount = 0; let skippedCount = 0;
    const warnings: string[] = [];

    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const leadId = sanitizeStringValue(r.lead_id);
      const stageName = sanitizeStringValue(r.stage_name);
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

      const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
      const payload: any = {
        workspace_id: workspaceId,
        lead_id: leadId,
        stage_name: stageName,
        entered_at: enteredAt,
        exited_at: exitedAt || null,
        stage_status: stageStatus,
        next_stage: sanitizeStringValue(r.next_stage),
        exit_reason: sanitizeStringValue(r.exit_reason),
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
      const stageName = sanitizeStringValue(body.stage_name);
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
    if(Object.prototype.hasOwnProperty.call(body,'next_stage')) update.next_stage = sanitizeStringValue(body.next_stage);
    if(Object.prototype.hasOwnProperty.call(body,'exit_reason')) update.exit_reason = sanitizeStringValue(body.exit_reason);
    if(Object.prototype.hasOwnProperty.call(body,'notes')) update.notes = sanitizeStringValue(body.notes);
    const enteredAt = update.entered_at || existing.entered_at;
    const exitedAt = Object.prototype.hasOwnProperty.call(update, 'exited_at') ? update.exited_at : existing.exited_at;
    if(exitedAt && enteredAt && new Date(exitedAt).getTime() < new Date(enteredAt).getTime()) return res.status(400).json({ error: 'exited_at before entered_at' });
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
