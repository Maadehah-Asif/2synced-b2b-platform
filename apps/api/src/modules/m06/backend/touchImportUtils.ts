/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Backend
 * File: touchImportUtils.ts
 * Purpose: Supports the t ou ch Im po rt Ut il s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose from 'mongoose';
import { Campaign } from './models/Campaign.js';
import Lead from '../m01/models/Lead.js';
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

export interface FailedRow { row: number; error: string; raw?: string; }
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
export async function resolveLeadCached(value: string, cache: Record<string, any>) {
  const key = `lead:${value}`;
  if(cache[key]) return cache[key];
  let found = null;
  if(/^[0-9]+$/.test(value)) {
    found = await Lead.findOne({ lead_id: Number(value) }).lean();
  }
  if(!found) {
    // attempt direct _id if valid ObjectId
    if(mongoose.isValidObjectId(value)) found = await Lead.findById(value).lean();
  }
  if(found) { cache[key] = found; return found; }
  return null;
}

export async function importCampaignTouchesCSV(opts: ImportOptions): Promise<ImportSummary> {
  const { projectId, csv, map, startRow = 1, endRow, campaignIdentifier = 'name', duplicatePolicy = 'skip' } = opts;
  const projectOid = new mongoose.Types.ObjectId(projectId);
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if(lines.length < 2) return { processed: 0, inserted: 0, failed: lines.length === 1 ? 1 : 0, failedRows: [{ row: 1, error: 'csv_no_rows'}], duplicates: 0 };
  const header = lines[0].split(',').map(h => h.trim());

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
    const rowNumber = i + 1; // account for header line display
    const raw = lines[i];
    const cols = raw.split(',').map(c => c.trim());
    const leadVal = cols[leadIdx];
    const campVal = cols[campIdx];
    const channelVal = channelIdx >= 0 ? cols[channelIdx].toLowerCase() : '';
    const typeVal = cols[typeIdx];
    const touchedVal = cols[touchedIdx];

    if(!leadVal || !campVal || !typeVal || !touchedVal) {
      failedRows.push({ row: rowNumber, error: 'missing_required_field', raw });
      continue;
    }
    const dt = parseDate(touchedVal);
    if(!dt) { failedRows.push({ row: rowNumber, error: 'invalid_datetime', raw }); continue; }
    const finalChannel = CHANNEL_SET.has(channelVal) ? channelVal : 'other';
    if(!TOUCH_TYPE_SET.has(typeVal)) { failedRows.push({ row: rowNumber, error: 'invalid_touch_type', raw }); continue; }

    // resolve campaign
    const campDoc = await resolveCampaignCached(campVal, projectOid, campaignIdentifier, cacheCampaign);
    if(!campDoc) { failedRows.push({ row: rowNumber, error: 'campaign_not_found', raw }); continue; }

    // resolve lead
    const leadDoc = await resolveLeadCached(leadVal, cacheLead);
    if(!leadDoc) { failedRows.push({ row: rowNumber, error: 'lead_not_found', raw }); continue; }

    // duplicate check
    if(duplicatePolicy === 'skip') {
      const dup = await CampaignTouch.findOne({ lead_id: leadDoc._id, campaign_id: campDoc._id, type: typeVal, touched_at: dt }).lean();
      if(dup) { duplicates++; continue; }
    }

    try {
      await CampaignTouch.create({
        project_id: projectOid,
        lead_id: leadDoc._id,
        campaign_id: campDoc._id,
        channel: finalChannel as any,
        type: typeVal as any,
        touched_at: dt,
        status: 'active',
      });
      inserted++;
    } catch(e:any) {
      failedRows.push({ row: rowNumber, error: 'insert_error', raw });
    }
  }

  return { processed, inserted, failed: failedRows.length, failedRows, duplicates };
}
