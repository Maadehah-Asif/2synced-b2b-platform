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
export interface ValidationIssue { field: string; message: string; }
export interface ValidationRowResult {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, unknown>;
  action: 'insert';
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean;
}
export interface ValidationSummary {
  header: string[];
  selectedRange: { startRow: number; endRow: number; totalRows: number; selectedRows: number; };
  summary: { checkedRows: number; validRows: number; invalidRows: number; warningRows: number; };
  rowResults: ValidationRowResult[];
  validRows: ValidationRowResult[];
  invalidRows: ValidationRowResult[];
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

async function preloadCampaignLookup(projectId: string, values: string[], mode: 'name' | 'campaign_id') {
  const lookup = new Map<string, any>();
  const uniqueValues = uniqueNonEmpty(values);
  if (uniqueValues.length === 0) return lookup;

  const query = mode === 'name'
    ? { project_id: projectId, name: { $in: uniqueValues } }
    : { project_id: projectId, campaign_id: { $in: uniqueValues } };

  const docs = await Campaign.find(query).lean();
  for (const doc of docs) {
    const key = String(mode === 'name' ? doc.name : doc.campaign_id);
    if (!lookup.has(key)) lookup.set(key, doc);
  }
  return lookup;
}

async function preloadLeadLookup(projectId: string, values: string[], leadIdentifier: 'id' | 'email') {
  const lookup = new Map<string, any>();
  const uniqueValues = uniqueNonEmpty(values);
  if (uniqueValues.length === 0) return lookup;

  const normalizedValues = uniqueValues.map((value) => value.toLowerCase());

  if (leadIdentifier === 'email') {
    const module6Docs = await Module6Lead.find({
      project_id: projectId,
      email: { $in: uniqueValues },
    }).lean();

    for (const doc of module6Docs) {
      const key = String(doc.email || '').toLowerCase();
      if (key && !lookup.has(key)) lookup.set(key, doc);
    }

    const missingEmails = normalizedValues.filter((value) => !lookup.has(value));
    if (missingEmails.length > 0) {
      const legacyDocs = await Lead.find({
        Email: { $in: missingEmails },
      }).lean();
      for (const doc of legacyDocs) {
        const key = String((doc as any).Email || '').toLowerCase();
        if (key && !lookup.has(key)) lookup.set(key, doc);
      }
    }

    return lookup;
  }

  const moduleLeadIds = uniqueValues.filter((value) => !/^[a-fA-F0-9]{24}$/.test(value));
  const moduleObjectIds = uniqueValues.filter((value) => /^[a-fA-F0-9]{24}$/.test(value));
  const numericLeadIds = uniqueValues.filter((value) => /^[0-9]+$/.test(value)).map((value) => Number(value));

  const moduleLeadDocs = await Module6Lead.find({
    project_id: projectId,
    $or: [
      ...(moduleLeadIds.length > 0 ? [{ lead_id: { $in: moduleLeadIds } }] : []),
      ...(moduleObjectIds.length > 0 ? [{ _id: { $in: moduleObjectIds } }] : []),
    ],
  }).lean();

  for (const doc of moduleLeadDocs) {
    const leadKey = String(doc.lead_id || '');
    const objectIdKey = String(doc._id || '');
    if (leadKey && !lookup.has(leadKey)) lookup.set(leadKey, doc);
    if (objectIdKey && !lookup.has(objectIdKey)) lookup.set(objectIdKey, doc);
  }

  const unresolvedNumericIds = numericLeadIds.filter((value) => !lookup.has(String(value)));
  if (unresolvedNumericIds.length > 0) {
    const legacyNumericDocs = await Lead.find({ lead_id: { $in: unresolvedNumericIds } }).lean();
    for (const doc of legacyNumericDocs) {
      const key = String((doc as any).lead_id || '');
      if (key && !lookup.has(key)) lookup.set(key, doc);
    }
  }

  const unresolvedObjectIds = moduleObjectIds.filter((value) => !lookup.has(value));
  if (unresolvedObjectIds.length > 0) {
    const legacyObjectDocs = await Lead.find({ _id: { $in: unresolvedObjectIds } }).lean();
    for (const doc of legacyObjectDocs) {
      const key = String((doc as any)._id || '');
      if (key && !lookup.has(key)) lookup.set(key, doc);
    }
  }

  return lookup;
}

// Resolve campaign by name or campaign_id within project, with simple in-memory cache
export async function resolveCampaignCached(value: string, projectId: string, mode: 'name' | 'campaign_id', cache: Record<string, any>) {
  const key = `${mode}:${value}`;
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
  const q = mode === 'name' ? { project_id: projectId, name: value } : { project_id: projectId, campaign_id: value };
  const found = await Campaign.findOne(q).lean();
  cache[key] = found || null;
  return cache[key];
}

// Resolve lead by numeric id (from Lead.lead_id or _id fallback)
export async function resolveLeadCached(value: string, projectId: string, cache: Record<string, any>, leadIdentifier: 'id'|'email' = 'id') {
  const key = `lead:${leadIdentifier}:${value}`;
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
  let found: any = null;

  const tryNumeric = async () => {
    // prefer module6 leads by lead_id string
    found = await Module6Lead.findOne({ project_id: projectId, lead_id: value }).lean();
    if(found) return;
    // legacy numeric lead_id
    if(/^[0-9]+$/.test(value)) {
      found = await Lead.findOne({ lead_id: Number(value) }).lean();
    }
  };

  const tryObjectId = async () => {
    found = await Module6Lead.findOne({ _id: value, project_id: projectId }).lean();
    if(found) return;
    if (/^[a-fA-F0-9]{24}$/.test(value)) found = await Lead.findById(value).lean();
  };

  const tryEmail = async () => {
    if(!value.includes('@')) return;
    const emailRegex = new RegExp(`^${value.replace(/[-/\\^$*+?.()|[\\]{}]/g,'\\$&')}$`, 'i');
    found = await Module6Lead.findOne({ project_id: projectId, email: emailRegex }).lean();
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

  cache[key] = found || null;
  return cache[key];
}

export async function importCampaignTouchesCSV(opts: ImportOptions): Promise<ImportSummary> {
  const { projectId, duplicatePolicy = 'skip' } = opts;
  const validation = await validateCampaignTouchesCSV(opts);
  const cacheCampaign: Record<string, any> = {};
  const cacheLead: Record<string, any> = {};
  const failedRows: FailedRow[] = validation.invalidRows.map((row) => ({
    row: row.rowNumber,
    error: row.errors.map((issue) => issue.message).join('; '),
    raw: JSON.stringify(row.original),
  }));
  let inserted = 0;
  let duplicates = 0;

  for (const row of validation.validRows) {
    const leadVal = String(row.mapped.lead_id || '');
    const campVal = String(row.mapped.campaign_lookup_value || '');
    const finalType = String(row.mapped.type || 'other');
    const touchedAt = row.mapped.touched_at as Date;
    const finalChannel = String(row.mapped.channel || 'other');
    const metadataObj = row.mapped.metadata as Record<string, unknown> | undefined;
    const campaignIdentifier = row.mapped.campaign_identifier_mode as 'name' | 'campaign_id';
    const leadIdentifier = row.mapped.lead_identifier_mode as 'id' | 'email';
    const campDoc = await resolveCampaignCached(campVal, projectId, campaignIdentifier, cacheCampaign);
    const leadDoc = await resolveLeadCached(leadVal, projectId, cacheLead, leadIdentifier);
    if (!campDoc || !leadDoc) {
      failedRows.push({ row: row.rowNumber, error: !campDoc ? 'campaign_not_found' : 'lead_not_found', raw: JSON.stringify(row.original) });
      continue;
    }
    if(duplicatePolicy === 'skip') {
      const dup = await CampaignTouch.findOne({ lead_id: leadDoc.lead_id, campaign_id: campDoc.campaign_id, type: finalType, touched_at: touchedAt }).lean();
      if(dup) { duplicates++; continue; }
    }
    try {
      await CampaignTouch.create({
        project_id: projectId,
        lead_id: leadDoc.lead_id,
        campaign_id: campDoc.campaign_id,
        channel: finalChannel as any,
        type: finalType as any,
        touched_at: touchedAt,
        status: String(row.mapped.status || 'active') as any,
        metadata: metadataObj || null,
      });
      inserted++;
    } catch (e:any) {
      failedRows.push({ row: row.rowNumber, error: e?.message || 'insert_error', raw: JSON.stringify(row.original) });
    }
  }

  return { processed: validation.summary.checkedRows, inserted, failed: failedRows.length, failedRows, duplicates };
}

export async function validateCampaignTouchesCSV(opts: ImportOptions): Promise<ValidationSummary> {
  const { projectId, csv, map, startRow = 1, endRow, campaignIdentifier = 'name', leadIdentifier = 'id' } = opts;
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if(lines.length < 2) {
    return {
      header: [],
      selectedRange: { startRow: 1, endRow: 0, totalRows: 0, selectedRows: 0 },
      summary: { checkedRows: 0, validRows: 0, invalidRows: 0, warningRows: 0 },
      rowResults: [],
      validRows: [],
      invalidRows: [],
    };
  }
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
    return {
      header,
      selectedRange: { startRow: 1, endRow: 0, totalRows: lines.length - 1, selectedRows: 0 },
      summary: { checkedRows: 0, validRows: 0, invalidRows: 0, warningRows: 0 },
      rowResults: [],
      validRows: [],
      invalidRows: [],
    };
  }

  const lastDataRow = typeof endRow === 'number' ? Math.min(endRow, lines.length - 1) : lines.length - 1;
  const selectedLines = lines.slice(startRow, lastDataRow + 1);
  const selectedColumns = selectedLines.map((raw) => raw.split(',').map(c => c.trim()));
  const preloadCampaignValues = selectedColumns.map((cols) => cols[campIdx] || '');
  const preloadLeadValues = selectedColumns.map((cols) => cols[leadIdx] || '');
  const campaignLookup = await preloadCampaignLookup(projectId, preloadCampaignValues, campaignIdentifier);
  const leadLookup = await preloadLeadLookup(projectId, preloadLeadValues, leadIdentifier);
  const rowResults: ValidationRowResult[] = [];
  for(let i = startRow; i <= lastDataRow; i++) {
    const rowNumber = i; 
    const raw = lines[i] ?? '';
    const cols = selectedColumns[i - startRow] || raw.split(',').map(c => c.trim());
    const leadVal = cols[leadIdx];
    const campVal = cols[campIdx];
    const channelValRaw = channelIdx >= 0 ? (cols[channelIdx] || '').toLowerCase() : '';
    const channelVal = CHANNEL_SET.has(channelValRaw as any) ? channelValRaw as any : 'other';
    const typeVal = cols[typeIdx];
    const touchedVal = cols[touchedIdx];

    const original = Object.fromEntries(header.map((key, index) => [key, cols[index] ?? '']));
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    if(!leadVal) errors.push({ field: 'lead_id', message: 'lead_id is missing' });
    if(!campVal) errors.push({ field: 'campaign_id', message: 'campaign_id is missing' });
    if(!typeVal) errors.push({ field: 'type', message: 'type is missing' });
    if(!touchedVal) errors.push({ field: 'touched_at', message: 'touched_at is missing' });
    const dt = parseDate(touchedVal);
    if(touchedVal && !dt) errors.push({ field: 'touched_at', message: 'touched_at must be a valid datetime' });
    const finalChannel = channelVal;
    const rawType = String(typeVal || '').trim();
    const normalizedType = rawType.toLowerCase().replace(/[\s\-]+/g, '_');
    const finalType = TOUCH_TYPE_SET.has(normalizedType as any) ? normalizedType as any : 'other';
    const metadataObj: any = finalType === 'other' && rawType && rawType !== 'other' ? { original_type: rawType } : undefined;
    if(!TOUCH_TYPE_SET.has(finalType as any) && finalType === 'other') warnings.push({ field: 'type', message: `Unknown type "${rawType}" will be imported as other` });
    const campaignLookupKey = String(campVal || '').trim();
    const leadLookupKey = leadIdentifier === 'email' ? String(leadVal || '').trim().toLowerCase() : String(leadVal || '').trim();
    const campDoc = campaignLookupKey ? campaignLookup.get(campaignLookupKey) || null : null;
    if(campVal && !campDoc) errors.push({ field: 'campaign_id', message: 'campaign_id does not exist' });
    const leadDoc = leadLookupKey ? leadLookup.get(leadLookupKey) || null : null;
    if(leadVal && !leadDoc) errors.push({ field: 'lead_id', message: 'lead_id does not exist' });

    rowResults.push({
      rowNumber,
      original,
      mapped: {
        lead_id: leadVal || null,
        campaign_lookup_value: campVal || null,
        campaign_identifier_mode: campaignIdentifier,
        lead_identifier_mode: leadIdentifier,
        channel: finalChannel || null,
        type: finalType,
        touched_at: dt || null,
        status: 'active',
        metadata: metadataObj,
      },
      action: 'insert',
      errors,
      warnings,
      valid: errors.length === 0,
    });
  }
  const invalidRows = rowResults.filter((row) => !row.valid);
  const validRows = rowResults.filter((row) => row.valid);
  const warningRows = rowResults.filter((row) => row.warnings.length > 0).length;
  return {
    header,
    selectedRange: { startRow, endRow: lastDataRow, totalRows: lines.length - 1, selectedRows: Math.max(0, lastDataRow - startRow + 1) },
    summary: { checkedRows: rowResults.length, validRows: validRows.length, invalidRows: invalidRows.length, warningRows },
    rowResults,
    validRows,
    invalidRows,
  };
}
