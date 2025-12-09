import mongoose from 'mongoose';
import { Campaign } from './models/Campaign.js';
import Lead from '../m01/models/Lead.js';
import { Module6Lead } from './models/Module6Lead.js';
import { CHANNEL_SET, TOUCH_TYPE_SET, parseDate } from './constants.js';
import { CampaignTouch } from './models/CampaignTouch.js';

interface MappingConfig {
  lead: string; // header name for lead identifier (currently by lead_id numeric or email if provided in data)
  campaign: string; // header name for campaign identifier (name or campaign_id)
  channel?: string;
  type: string;
  touched_at: string;
  // metadata: collect all remaining (optional)
}

interface ImportOptions {
  projectId: string;
  csv: string;
  map: MappingConfig;
  startRow?: number;
  endRow?: number;
  leadIdentifier?: 'id' | 'email'; // future: email not currently in Lead schema here; using id
  campaignIdentifier?: 'name' | 'campaign_id';
  duplicatePolicy?: 'skip' | 'allow';
}

export interface FailedRow {
  row: number;
  error: string;
  raw?: string;
  campaign?: string | undefined;
  lead?: string | undefined;
  type?: string | undefined;
  normalized_type?: string | undefined;
  error_message?: string | undefined;
}
export interface ImportSummary { processed: number; inserted: number; failed: number; failedRows: FailedRow[]; duplicates: number; }

// Resolve campaign by name or campaign_id within project, with simple in-memory cache
export async function resolveCampaignCached(value: string, projectOid: mongoose.Types.ObjectId, mode: 'name' | 'campaign_id', cache: Record<string, any>) {
  const key = `${mode}:${value}`;
  if(cache[key]) return cache[key];
  const q = mode === 'name' ? { project_id: projectOid, name: value } : { project_id: projectOid, campaign_id: value };
  const found = await Campaign.findOne(q).lean();
  if(found) { cache[key] = found; return found; }
  return null;
}

// Resolve lead by numeric id (from Lead.lead_id or _id fallback)
export async function resolveLeadCached(value: string, projectOid: mongoose.Types.ObjectId, cache: Record<string, any>, leadIdentifier: 'id'|'email' = 'id') {
  const key = `lead:${leadIdentifier}:${value}`;
  if(cache[key]) return cache[key];
  let found: any = null;

  const tryNumeric = async () => {
    // prefer module6 leads by lead_id string
    found = await Module6Lead.findOne({ project_id: projectOid, lead_id: value }).lean();
    if(found) return;
    // legacy numeric lead_id
    if(/^[0-9]+$/.test(value)) {
      found = await Lead.findOne({ lead_id: Number(value) }).lean();
    }
  };

  const tryObjectId = async () => {
    if(!mongoose.isValidObjectId(value)) return;
    found = await Module6Lead.findOne({ _id: value, project_id: projectOid }).lean();
    if(found) return;
    found = await Lead.findById(value).lean();
  };

  const tryEmail = async () => {
    if(!value.includes('@')) return;
    const emailRegex = new RegExp(`^${value.replace(/[-/\\^$*+?.()|[\\]{}]/g,'\\$&')}$`, 'i');
    found = await Module6Lead.findOne({ project_id: projectOid, email: emailRegex }).lean();
    if(found) return;
    found = await Lead.findOne({ Email: emailRegex }).lean();
  };

  if(leadIdentifier === 'email') {
    await tryEmail();
    if(!found) await tryObjectId();
    if(!found) await tryNumeric();
  } else {
    // id-first strategy
    await tryNumeric();
    if(!found) await tryObjectId();
    if(!found) await tryEmail();
  }

  if(found) { cache[key] = found; return found; }
  return null;
}

export async function importCampaignTouchesCSV(opts: ImportOptions): Promise<ImportSummary> {
  const { projectId, csv, map, startRow = 1, endRow, campaignIdentifier = 'name', leadIdentifier = 'id', duplicatePolicy = 'skip' } = opts;
  const projectOid = new mongoose.Types.ObjectId(projectId);
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if(lines.length < 2) return { processed: 0, inserted: 0, failed: lines.length === 1 ? 1 : 0, failedRows: [{ row: 1, error: 'csv_no_rows'}], duplicates: 0 };
  const headerLine = lines[0] ?? '';
  const header = headerLine.split(',').map(h => h.trim());

  function colIndex(name: string): number {
    const idx = header.indexOf(name);
    return idx >= 0 ? idx : -1;
  }

  const leadIdx = colIndex(map.lead);
  const campIdx = colIndex(map.campaign);
  const channelIdx = map.channel ? colIndex(map.channel) : -1;
  const typeIdx = colIndex(map.type);
  const touchedIdx = colIndex(map.touched_at);
  if(leadIdx < 0 || campIdx < 0 || typeIdx < 0 || touchedIdx < 0) {
    return { processed: 0, inserted: 0, failed: 1, failedRows: [{ row: 0, error: 'required_mapping_missing'}], duplicates: 0 };
  }

  const lastDataRow = typeof endRow === 'number' ? Math.min(endRow, lines.length - 1) : lines.length - 1;
  const cacheCampaign: Record<string, any> = {};
  const cacheLead: Record<string, any> = {};
  const failedRows: FailedRow[] = [];
  let inserted = 0; let processed = 0; let duplicates = 0;

  for(let i = startRow; i <= lastDataRow; i++) {
    processed++;
    // Use the same numbering the frontend preview shows: data rows start at 1
    const rowNumber = i; 
    const raw = lines[i] ?? '';
    const cols = raw.split(',').map(c => c.trim());
    const leadVal = cols[leadIdx];
    const campVal = cols[campIdx];
    const channelValRaw = channelIdx >= 0 ? (cols[channelIdx] || '').toLowerCase() : '';
    const channelVal = CHANNEL_SET.has(channelValRaw as any) ? channelValRaw as any : 'other';
    const typeVal = cols[typeIdx];
    const touchedVal = cols[touchedIdx];

    if(!leadVal || !campVal || !typeVal || !touchedVal) {
      failedRows.push({ row: rowNumber, error: 'missing_required_field', raw, lead: leadVal, campaign: campVal, type: typeVal });
      continue;
    }
    const dt = parseDate(touchedVal);
    if(!dt) { failedRows.push({ row: rowNumber, error: 'invalid_datetime', raw, lead: leadVal, campaign: campVal, type: typeVal }); continue; }
    const finalChannel = channelVal;

    // Normalize incoming touch type to a canonical form (lowercase, underscores)
    const rawType = String(typeVal || '').trim();
    const normalizedType = rawType.toLowerCase().replace(/[\s\-]+/g, '_');
    const finalType = TOUCH_TYPE_SET.has(normalizedType as any) ? normalizedType as any : 'other';
    const metadataObj: any = finalType === 'other' && rawType && rawType !== 'other' ? { original_type: rawType } : undefined;

    // resolve campaign
    const campDoc = await resolveCampaignCached(campVal, projectOid, campaignIdentifier, cacheCampaign);
    if(!campDoc) { failedRows.push({ row: rowNumber, error: 'campaign_not_found', raw, lead: leadVal, campaign: campVal, type: rawType, normalized_type: normalizedType }); continue; }

    // resolve lead (pass hint for id vs email)
    const leadDoc = await resolveLeadCached(leadVal, projectOid, cacheLead, leadIdentifier);
    if(!leadDoc) { failedRows.push({ row: rowNumber, error: 'lead_not_found', raw, lead: leadVal, campaign: campVal, type: rawType, normalized_type: normalizedType }); continue; }

    // duplicate check
    if(duplicatePolicy === 'skip') {
      const dup = await CampaignTouch.findOne({ lead_id: leadDoc._id, campaign_id: campDoc._id, type: finalType, touched_at: dt }).lean();
      if(dup) { duplicates++; continue; }
    }

    try {
      await CampaignTouch.create({
        project_id: projectOid,
        lead_id: leadDoc._id,
        campaign_id: campDoc._id,
        channel: finalChannel as any,
        type: finalType as any,
        touched_at: dt,
        status: 'active',
        metadata: metadataObj,
      });
      inserted++;
    } catch(e:any) {
      failedRows.push({ row: rowNumber, error: 'insert_error', raw, lead: leadVal, campaign: campVal, type: rawType, normalized_type: normalizedType, error_message: e && e.message });
    }
  }

  return { processed, inserted, failed: failedRows.length, failedRows, duplicates };
}
