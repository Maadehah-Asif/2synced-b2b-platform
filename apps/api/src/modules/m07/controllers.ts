import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import FunnelLead from './models/FunnelLead.js';
import FunnelStageHistory from './models/StageHistory.js';
import StageHistory from './models/StageHistory.js';
import Interaction from './models/Interaction.js';

// POST /m07/leads - create single lead
export async function createLead(req: Request, res: Response) {
  try {
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const leadId = String(body.lead_id || body.leadId || '').trim();
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if (!leadId) return res.status(400).json({ error: 'lead_id required' });
    // upsert behavior: reject duplicates for manual adds
    const exists = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
    if (exists) return res.status(409).json({ error: 'Lead already exists in this workspace' });
    const doc = await FunnelLead.create({
      workspace_id: workspaceId,
      lead_id: leadId,
      full_name: body.full_name || null,
      company: body.company || null,
      source: body.source || null,
      owner: body.owner || null,
      industry: body.industry || null,
      region: body.region || null,
      lead_score: typeof body.lead_score === 'number' ? body.lead_score : (body.lead_score ? Number(body.lead_score) : null),
      intent_score: typeof body.intent_score === 'number' ? body.intent_score : (body.intent_score ? Number(body.intent_score) : null),
      email: body.email || null,
      job_title: body.job_title || null,
      segment: body.segment || null,
      raw: body.raw || null,
    });
    return res.json({ ok: true, lead: doc });
  } catch (e) {
    console.error('[m07.createLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m07/leads/upload/preview - parse CSV and return columns + preview rows
export async function previewUpload(req: Request, res: Response) {
  try {
    // multer should provide file buffer on req.file
    // accept JSON body with raw csv text if file missing (fallback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = (req as any).file;
    const body: any = (req as any).body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    let text = '';
    if (file && file.buffer) text = file.buffer.toString('utf8');
    else if (body.csvText) text = String(body.csvText);
    else return res.status(400).json({ error: 'file required' });

    const records = parse(text, { bom: true, relax_column_count: true });
    if (!records || records.length === 0) return res.json({ ok: true, columns: [], previewRows: [], warnings: [] });
    // detect header row: assume first row contains headers if contains any alpha strings
    const header = records[0].map((c: any) => String(c || '').trim());
    const previewRows = records.slice(1, 21).map((r: any) => r.map((c: any) => (c == null ? '' : String(c))));
    return res.json({ ok: true, columns: header, previewRows, warnings: [] });
  } catch (e) {
    console.error('[m07.previewUpload]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m07/leads/upload/commit - accept mapped rows and insert/update into funnel_leads
export async function commitUpload(req: Request, res: Response) {
  try {
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const rows = body.rows || [];
    const overwriteMode = body.overwriteMode || 'overwrite_existing';
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

    let importedCount = 0; let updatedCount = 0; let skippedCount = 0;
    const warnings: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const leadId = String(r.lead_id || '').trim();
      if (!leadId) { skippedCount++; warnings.push(`Row ${i + 1}: missing lead_id`); continue; }
      const filter = { workspace_id: workspaceId, lead_id: leadId };
      const existing = await FunnelLead.findOne(filter).lean();
      const payload: any = Object.assign({}, r);
      // normalize numeric fields
      if (payload.lead_score != null) payload.lead_score = Number(payload.lead_score) || null;
      if (payload.intent_score != null) payload.intent_score = Number(payload.intent_score) || null;
      payload.raw = payload.raw || null;

      if (existing) {
        if (overwriteMode === 'skip_duplicates') { skippedCount++; warnings.push(`Row ${i + 1}: duplicate lead_id skipped`); continue; }
        await FunnelLead.updateOne(filter, { $set: payload, $currentDate: { updated_at: true } });
        updatedCount++;
      } else {
        await FunnelLead.create(Object.assign({ workspace_id: workspaceId, lead_id: leadId }, payload));
        importedCount++;
      }
    }

    return res.json({ ok: true, importedCount, updatedCount, skippedCount, warnings });
  } catch (e) {
    console.error('[m07.commitUpload]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m07/leads - list with filters + paging
export async function listLeads(req: Request, res: Response) {
  try {
    const workspace = String(req.query.workspaceId || req.query.workspace || '');
    if (!workspace) return res.status(400).json({ error: 'workspaceId required' });
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(200, Math.max(5, parseInt(String(req.query.pageSize || '25'), 10)));
    const filter: any = { workspace_id: workspace };
    if (req.query.search) {
      const q = String(req.query.search);
      filter.$or = [ { lead_id: { $regex: q, $options: 'i' } }, { full_name: { $regex: q, $options: 'i' } }, { company: { $regex: q, $options: 'i' } } ];
    }
    if (req.query.includeArchived !== '1' && req.query.includeArchived !== 'true') filter.is_archived = { $ne: true };
    const total = await FunnelLead.countDocuments(filter);
    const items = await FunnelLead.find(filter).sort({ updated_at: -1 }).skip((page -1) * pageSize).limit(pageSize).lean();
    return res.json({ ok: true, items, total, page, pageSize });
  } catch (e) {
    console.error('[m07.listLeads]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function getLead(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    const doc = await FunnelLead.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[m07.getLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateLead(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    const body: any = req.body || {};
    const update: any = {};
    const allowed = ['full_name','first_name','last_name','company','source','owner','industry','region','lead_score','intent_score','email','job_title','segment','raw'];
    for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'no fields' });
    update.updated_at = new Date();
    await FunnelLead.updateOne({ _id: id }, { $set: update });
    const doc = await FunnelLead.findById(id).lean();
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[m07.updateLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveLead(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    await FunnelLead.updateOne({ _id: id }, { $set: { is_archived: true, updated_at: new Date() } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m07.archiveLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteLeadPermanent(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    // For safety, prevent deletion if related records exist - simple check omitted for FYP (archive recommended)
    await FunnelLead.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m07.deleteLeadPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// ------------------ INTERACTIONS CONTROLLERS ------------------

// POST /m07/interactions - create single interaction
export async function createInteraction(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const leadId = String(body.lead_id || '').trim();
    const tsRaw = body.timestamp || body.time || null;
    const interactionType = String(body.interaction_type || body.type || '').trim();
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!leadId) return res.status(400).json({ error: 'lead_id required' });
    if(!interactionType) return res.status(400).json({ error: 'interaction_type required' });
    const timestamp = tsRaw ? new Date(tsRaw) : null;
    if(!timestamp || Number.isNaN(timestamp.getTime())) return res.status(400).json({ error: 'timestamp required and must be a valid date' });
    const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
    if(!lead) return res.status(400).json({ error: 'referenced lead not found' });

    const normalizeType = (t: string)=>{
      if(!t) return 'other';
      const v = t.toLowerCase().replace(/[^a-z0-9_]/g,'_');
      const allowed = new Set(['email_sent','email_open','email_click','reply','call','meeting','demo_request','website_visit','webinar_attend','linkedin_message','linkedin_reply','other']);
      return allowed.has(v) ? v : 'other';
    };
    const normalizeChannel = (c: string)=>{
      if(!c) return null;
      const v = c.toLowerCase().replace(/[^a-z0-9_]/g,'_');
      const allowed = new Set(['email','call','linkedin','web','webinar','ads','other']);
      return allowed.has(v) ? v : 'other';
    };

    const payload: any = {
      workspace_id: workspaceId,
      interaction_id: body.interaction_id || null,
      lead_id: leadId,
      timestamp,
      interaction_type: normalizeType(interactionType),
      channel: normalizeChannel(body.channel || body.medium || ''),
      campaign_id: body.campaign_id || body.campaign || null,
      outcome: body.outcome || null,
      engagement_score: (body.engagement_score == null) ? null : (Number(body.engagement_score) || null),
      notes: body.notes || null,
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

    const normalizeType = (t:any)=>{ if(!t) return 'other'; const v=String(t).toLowerCase().replace(/[^a-z0-9_]/g,'_'); const allowed = new Set(['email_sent','email_open','email_click','reply','call','meeting','demo_request','website_visit','webinar_attend','linkedin_message','linkedin_reply','other']); return allowed.has(v)?v:'other'; };
    const normalizeChannel = (c:any)=>{ if(!c) return null; const v=String(c).toLowerCase().replace(/[^a-z0-9_]/g,'_'); const allowed=new Set(['email','call','linkedin','web','webinar','ads','other']); return allowed.has(v)?v:'other'; };

    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const leadId = String(r.lead_id || '').trim();
      const tsRaw = r.timestamp || r.time || null;
      const itype = String(r.interaction_type || r.type || '').trim();
      if(!leadId){ skipped++; warnings.push(`Row ${i+1}: missing lead_id`); continue; }
      if(!itype){ skipped++; warnings.push(`Row ${i+1}: missing interaction_type`); continue; }
      const timestamp = tsRaw ? new Date(tsRaw) : null;
      if(!timestamp || Number.isNaN(timestamp.getTime())){ skipped++; warnings.push(`Row ${i+1}: invalid timestamp`); continue; }
      const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
      if(!lead){ skipped++; warnings.push(`Row ${i+1}: referenced lead not found`); continue; }

      const payload:any = {
        workspace_id: workspaceId,
        interaction_id: r.interaction_id || null,
        lead_id: leadId,
        timestamp,
        interaction_type: normalizeType(itype),
        channel: normalizeChannel(r.channel || r.medium || ''),
        campaign_id: r.campaign_id || r.campaign || null,
        outcome: r.outcome || null,
        engagement_score: (r.engagement_score == null) ? null : (Number(r.engagement_score) || null),
        notes: r.notes || null,
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
  try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); const body:any = req.body || {}; const allowed = ['timestamp','interaction_type','channel','campaign_id','outcome','engagement_score','notes']; const update:any = {}; for(const k of allowed) if(Object.prototype.hasOwnProperty.call(body,k)) update[k] = body[k]; if(update.timestamp) update.timestamp = new Date(update.timestamp); if(update.engagement_score != null) update.engagement_score = Number(update.engagement_score) || null; update.updated_at = new Date(); await Interaction.updateOne({ _id: id }, { $set: update }); const doc = await Interaction.findById(id).lean(); return res.json({ ok: true, item: doc }); }catch(e){ console.error('[m07.updateInteraction]', e); return res.status(500).json({ error: 'internal' }); }
}

export async function archiveInteraction(req: Request, res: Response){ try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await Interaction.updateOne({ _id: id }, { $set: { is_archived: true, updated_at: new Date() } }); return res.json({ ok: true }); }catch(e){ console.error('[m07.archiveInteraction]', e); return res.status(500).json({ error: 'internal' }); } }

export async function deleteInteractionPermanent(req: Request, res: Response){ try{ const id = String(req.params.id || ''); if(!id) return res.status(400).json({ error: 'id required' }); await Interaction.deleteOne({ _id: id }); return res.json({ ok: true }); }catch(e){ console.error('[m07.deleteInteractionPermanent]', e); return res.status(500).json({ error: 'internal' }); } }


// ------------------ STAGE HISTORY CONTROLLERS ------------------

// POST /m07/stages - create single stage history record
export async function createStage(req: Request, res: Response){
  try{
    const body: any = req.body || {};
    const workspaceId = body.workspaceId || body.workspace || null;
    const leadId = String(body.lead_id || '').trim();
    const stageName = String(body.stage_name || '').trim();
    const enteredAt = body.entered_at ? new Date(body.entered_at) : null;
    if(!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if(!leadId) return res.status(400).json({ error: 'lead_id required' });
    if(!stageName) return res.status(400).json({ error: 'stage_name required' });
    if(!enteredAt || Number.isNaN(enteredAt.getTime())) return res.status(400).json({ error: 'entered_at required and must be a valid date' });
    // ensure lead exists
    const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
    if(!lead) return res.status(400).json({ error: 'referenced lead not found' });
    // create or overwrite duplicate
    const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
    const payload: any = {
      workspace_id: workspaceId,
      lead_id: leadId,
      stage_name: stageName,
      entered_at: enteredAt,
      exited_at: body.exited_at ? new Date(body.exited_at) : null,
      stage_status: body.stage_status || 'active',
      next_stage: body.next_stage || null,
      exit_reason: body.exit_reason || null,
      notes: body.notes || null,
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

    // simple allowed stages - for FYP keep small set
    const ALLOWED_STAGES = new Set(['New Lead','Marketing Qualified','Sales Contacted','Opportunity','Proposal','Won','Lost']);

    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const leadId = String(r.lead_id || '').trim();
      const stageName = String(r.stage_name || '').trim();
      const enteredRaw = r.entered_at || r.enteredAt || r.entered || null;
      const enteredAt = enteredRaw ? new Date(enteredRaw) : null;
      if(!leadId){ skippedCount++; warnings.push(`Row ${i+1}: missing lead_id`); continue; }
      if(!stageName){ skippedCount++; warnings.push(`Row ${i+1}: missing stage_name`); continue; }
      if(!enteredAt || Number.isNaN(enteredAt.getTime())){ skippedCount++; warnings.push(`Row ${i+1}: invalid entered_at`); continue; }
      // check lead exists
      const lead = await FunnelLead.findOne({ workspace_id: workspaceId, lead_id: leadId }).lean();
      if(!lead){ skippedCount++; warnings.push(`Row ${i+1}: referenced lead not found`); continue; }
      // stage validity
      if(!ALLOWED_STAGES.has(stageName)){ warnings.push(`Row ${i+1}: unknown stage '${stageName}' - skipped`); skippedCount++; continue; }
      // date integrity
      const exitedAt = r.exited_at ? new Date(r.exited_at) : null;
      if(exitedAt && enteredAt && exitedAt.getTime() < enteredAt.getTime()){ skippedCount++; warnings.push(`Row ${i+1}: exited_at before entered_at`); continue; }

      const filter = { workspace_id: workspaceId, lead_id: leadId, stage_name: stageName, entered_at: enteredAt } as any;
      const payload: any = {
        workspace_id: workspaceId,
        lead_id: leadId,
        stage_name: stageName,
        entered_at: enteredAt,
        exited_at: exitedAt || null,
        stage_status: r.stage_status || 'active',
        next_stage: r.next_stage || null,
        exit_reason: r.exit_reason || null,
        notes: r.notes || null,
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
    const body: any = req.body || {};
    const allowed = ['stage_name','entered_at','exited_at','stage_status','next_stage','exit_reason','notes'];
    const update: any = {};
    for(const k of allowed) if(Object.prototype.hasOwnProperty.call(body,k)) update[k] = body[k];
    if(update.entered_at) update.entered_at = new Date(update.entered_at);
    if(update.exited_at) update.exited_at = new Date(update.exited_at);
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
