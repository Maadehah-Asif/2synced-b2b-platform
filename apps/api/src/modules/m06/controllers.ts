import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse as parseCsv } from 'csv-parse/sync';
import { Deal } from './models/Deal.js';
import { Campaign } from './models/Campaign.js';
import { CampaignTouch } from './models/CampaignTouch.js';
import { importCampaignTouchesCSV, validateCampaignTouchesCSV } from './touchImportUtils.js';
import { AttributionRun } from './models/AttributionRun.js';
import { AttributionResult } from './models/AttributionResult.js';
import { CampaignSpend } from './models/CampaignSpend.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';
import Lead from '../m01/models/Lead.js';
import { CHANNEL_SET } from './constants.js';
import { Module6Lead } from './models/Module6Lead.js';
import FunnelLead from '../m07/models/FunnelLead.js';
import { getForecastChannels, runForecast } from './forecasting.js';
import { invokePythonAgent, invokePythonAgentByChannel, type ForecastResult as AgentForecastResult } from './pythonAgentInvoker.js';

// Helper: get project id from query/body (accept projectId or workspace/workspaceId)
function getProjectId(req: Request) {
  const q = (req.query.projectId as string)
    || (req.query.workspaceId as string)
    || (req.query.workspace as string)
    || (req.body && (req.body.projectId as string))
    || null;
  return q;
}

const MAX_ALLOCATIONS_LIMIT = 100;

function sanitizeRegex(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function parseDateInput(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function requireStringId(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  return text || null;
}

function sanitizeStringValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function sanitizeNumberValue(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeBooleanValue(value: unknown): boolean | null {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => sanitizeStringValue(item)).filter(Boolean) as string[];
}

type BusinessIdEntity = 'lead' | 'campaign' | 'deal';

function isObjectRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const CAMPAIGN_CHANNELS = new Set(['email', 'ads', 'linkedin', 'webinar', 'other']);
const CAMPAIGN_STATUSES = new Set(['active', 'archived']);
const TOUCH_CHANNELS = new Set(['email', 'ads', 'linkedin', 'webinar', 'other']);
const TOUCH_TYPES = new Set(['email_open', 'ad_click', 'webinar', 'email_click', 'form_submit', 'other']);
const TOUCH_STATUSES = new Set(['active', 'archived']);
const DEAL_CURRENCIES = new Set(['USD', 'PKR', 'EUR']);
const LEAD_SOURCES = new Set(['ads', 'linkedin', 'email', 'referral', 'webinar']);
const LEAD_OWNERS = new Set(['rep a', 'rep b', 'rep c']);
const LEAD_INDUSTRIES = new Set(['it', 'finance', 'healthcare', 'retail', 'education']);
const LEAD_REGIONS = new Set(['us', 'uk', 'uae', 'pk', 'ca']);
const LEAD_SEGMENTS = new Set(['smb', 'mid-market', 'enterprise']);
const LEAD_IMPORT_FIELDS = ['lead_id', 'full_name', 'first_name', 'last_name', 'company', 'source', 'owner', 'industry', 'region', 'lead_score', 'intent_score', 'email', 'job_title', 'segment'] as const;
const LEAD_REQUIRED_FIELDS = ['lead_id'] as const;
const CAMPAIGN_IMPORT_FIELDS = ['campaign_id', 'name', 'channel', 'description', 'tags', 'start_date', 'end_date', 'status', 'spend'] as const;
const CAMPAIGN_REQUIRED_FIELDS = ['campaign_id', 'name', 'channel', 'spend'] as const;
const DEAL_IMPORT_FIELDS = ['deal_id', 'lead_id', 'revenue', 'currency', 'closed_won', 'closed_at'] as const;
const DEAL_REQUIRED_FIELDS = ['deal_id', 'lead_id', 'revenue', 'closed_won'] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEnumValue(value: unknown, allowed: Set<string>, fallback: string | null = null): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  return allowed.has(normalized) ? normalized : null;
}

function normalizeCurrency(value: unknown): string | null {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  const normalized = text.toUpperCase();
  return DEAL_CURRENCIES.has(normalized) ? normalized : null;
}

function deriveFullName(parts: { full_name?: unknown; first_name?: unknown; last_name?: unknown }) {
  const full = sanitizeStringValue(parts.full_name);
  if (full) return full;
  const first = sanitizeStringValue(parts.first_name);
  const last = sanitizeStringValue(parts.last_name);
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return combined || null;
}

function normalizeMappingHeader(value: unknown) {
  const text = sanitizeStringValue(value);
  if (!text) return null;
  return text.toLowerCase().replace(/[\s_-]+/g, '');
}

function getDateRangeBounds(value: unknown) {
  const key = sanitizeStringValue(value)?.toLowerCase();
  if (!key || key === 'all') return null;

  const now = new Date();
  const end = new Date(now);
  let start: Date | null = null;

  if (key === '30d') {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
  } else if (key === '90d') {
    start = new Date(now);
    start.setDate(start.getDate() - 90);
  } else if (key === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return start ? { start, end } : null;
}

function getRequestedChannels(value: unknown) {
  const raw = sanitizeStringValue(value);
  if (!raw) return null;
  const channels = raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  return channels.length > 0 ? new Set(channels) : null;
}

async function findCrossEntityBusinessIdConflicts(projectId: string, entity: BusinessIdEntity, value: string) {
  const businessId = sanitizeStringValue(value);
  if (!businessId) return [] as BusinessIdEntity[];

  const checks: Array<Promise<BusinessIdEntity | null>> = [];
  if (entity !== 'lead') {
    checks.push(
      Module6Lead.findOne({ project_id: projectId, lead_id: businessId }).select('_id').lean()
        .then((doc) => (doc ? 'lead' : null))
    );
  }
  if (entity !== 'campaign') {
    checks.push(
      Campaign.findOne({ project_id: projectId, campaign_id: businessId }).select('_id').lean()
        .then((doc) => (doc ? 'campaign' : null))
    );
  }
  if (entity !== 'deal') {
    checks.push(
      Deal.findOne({ project_id: projectId, deal_id: businessId }).select('_id').lean()
        .then((doc) => (doc ? 'deal' : null))
    );
  }

  const results = await Promise.all(checks);
  return results.filter((result): result is BusinessIdEntity => result !== null);
}

function appendCrossEntityConflictError(
  errors: Array<{ field: string; message: string }>,
  field: string,
  value: string | null | undefined,
  conflicts: BusinessIdEntity[],
) {
  if (!value || conflicts.length === 0) return;
  const labels = conflicts.map((conflict) => `${conflict}_id`).join(', ');
  errors.push({ field, message: `${field} must be unique across leads, campaigns, and deals; value is already used as ${labels}` });
}

function parseLeadCsvText(csv: string) {
  const rows = parseCsv(csv, {
    columns: false,
    relax_column_count: true,
    skip_empty_lines: false,
    trim: true,
  }) as string[][];

  const normalizedRows = rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
  const nonEmptyRows = normalizedRows.filter((row) => row.some((cell) => cell.length > 0));
  if (nonEmptyRows.length < 2) {
    throw new Error('csv_no_rows');
  }

  const header = (nonEmptyRows[0] || []).map((cell) => cell.trim());
  const records = nonEmptyRows.slice(1);
  return { header, records };
}

function parseFlatCsvText(csv: string) {
  const rows = parseCsv(csv, {
    columns: false,
    relax_column_count: true,
    skip_empty_lines: false,
    trim: true,
  }) as string[][];

  const normalizedRows = rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
  const nonEmptyRows = normalizedRows.filter((row) => row.some((cell) => cell.length > 0));
  if (nonEmptyRows.length < 2) {
    throw new Error('csv_no_rows');
  }

  const header = (nonEmptyRows[0] || []).map((cell) => cell.trim());
  const records = nonEmptyRows.slice(1);
  return { header, records };
}

function buildLeadHeaderIndex(header: string[]) {
  const exact = new Map<string, number>();
  const normalized = new Map<string, number>();
  header.forEach((value, index) => {
    exact.set(value, index);
    const normalizedKey = normalizeMappingHeader(value);
    if (normalizedKey && !normalized.has(normalizedKey)) normalized.set(normalizedKey, index);
  });
  return { exact, normalized };
}

function buildCampaignPayload(input: Record<string, unknown>) {
  const campaignId = requireStringId(input.campaign_id ?? input.campaignId);
  const name = sanitizeStringValue(input.name);
  const channel = normalizeEnumValue(input.channel, CAMPAIGN_CHANNELS);
  const description = sanitizeStringValue(input.description);
  const tagsValue = input.tags;
  const tags = Array.isArray(tagsValue)
    ? sanitizeStringArray(tagsValue)
    : sanitizeStringValue(tagsValue)
      ? String(tagsValue).split(/[|,]/).map((item) => item.trim()).filter(Boolean)
      : [];
  const startDateRaw = input.start_date ?? input.startDate ?? null;
  const endDateRaw = input.end_date ?? input.endDate ?? null;
  const startDate = parseDateInput(typeof startDateRaw === 'string' ? startDateRaw : sanitizeStringValue(startDateRaw));
  const endDate = parseDateInput(typeof endDateRaw === 'string' ? endDateRaw : sanitizeStringValue(endDateRaw));
  const statusProvided = input.status !== undefined;
  const status = statusProvided ? normalizeEnumValue(input.status, CAMPAIGN_STATUSES) : 'active';
  const spend = sanitizeNumberValue(input.spend);

  return {
    campaign_id: campaignId,
    name,
    channel,
    description,
    tags,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    status,
    spend,
  };
}

function validateCampaignValueFields(input: Record<string, unknown>) {
  const payload = buildCampaignPayload(input);
  const errors: Array<{ field: string; message: string }> = [];
  if (!payload.campaign_id) errors.push({ field: 'campaign_id', message: 'campaign_id is required' });
  if (!payload.name) errors.push({ field: 'name', message: 'name is required' });
  if (!payload.channel) errors.push({ field: 'channel', message: `channel must be one of ${Array.from(CAMPAIGN_CHANNELS).join(', ')}` });
  if (payload.spend === null || payload.spend < 0) errors.push({ field: 'spend', message: 'spend must be a number greater than or equal to 0' });
  if ((input.start_date !== undefined || input.startDate !== undefined) && !payload.start_date) errors.push({ field: 'start_date', message: 'start_date must be a valid date' });
  if ((input.end_date !== undefined || input.endDate !== undefined) && !payload.end_date) errors.push({ field: 'end_date', message: 'end_date must be a valid date' });
  if (input.status !== undefined && !payload.status) errors.push({ field: 'status', message: `status must be one of ${Array.from(CAMPAIGN_STATUSES).join(', ')}` });
  if (payload.start_date && payload.end_date && payload.end_date.getTime() < payload.start_date.getTime()) {
    errors.push({ field: 'end_date', message: 'end_date cannot be earlier than start_date' });
  }
  return { payload, errors };
}

function buildDealPayload(input: Record<string, unknown>) {
  const dealId = requireStringId(input.deal_id ?? input.dealId);
  const leadId = requireStringId(input.lead_id ?? input.leadId);
  const revenue = sanitizeNumberValue(input.revenue ?? input.amount);
  const currency = input.currency === undefined || input.currency === null || input.currency === ''
    ? null
    : normalizeCurrency(input.currency);
  const closedWon = sanitizeBooleanValue(input.closed_won);
  const closedAtRaw = input.closed_at;
  const closedAt = closedAtRaw ? parseDateInput(String(closedAtRaw)) : null;

  return {
    deal_id: dealId,
    lead_id: leadId,
    revenue,
    currency,
    closed_won: closedWon,
    closed_at: closedAt,
  };
}

function validateDealValueFields(input: Record<string, unknown>) {
  const payload = buildDealPayload(input);
  const errors: Array<{ field: string; message: string }> = [];
  if (!payload.deal_id) errors.push({ field: 'deal_id', message: 'deal_id is required' });
  if (!payload.lead_id) errors.push({ field: 'lead_id', message: 'lead_id is required' });
  if (payload.revenue === null || payload.revenue < 0) errors.push({ field: 'revenue', message: 'revenue must be a number greater than or equal to 0' });
  if (payload.currency === null && input.currency !== undefined && input.currency !== null && input.currency !== '') {
    errors.push({ field: 'currency', message: `currency must be one of ${Array.from(DEAL_CURRENCIES).join(', ')}` });
  }
  if (payload.closed_won === null) errors.push({ field: 'closed_won', message: 'closed_won is required and must be true or false' });
  if (input.closed_at !== undefined && input.closed_at !== null && input.closed_at !== '' && !payload.closed_at) {
    errors.push({ field: 'closed_at', message: 'closed_at must be a valid date' });
  }
  if (payload.closed_won === true) {
    if (!payload.closed_at) errors.push({ field: 'closed_at', message: 'closed_at is required when closed_won is true' });
    if ((payload.revenue || 0) <= 0) errors.push({ field: 'revenue', message: 'closed deals must have a non-zero revenue' });
  }
  return { payload, errors };
}

function resolveDealMappingIndexes(header: string[], map: Record<string, unknown> | null | undefined) {
  const mapping = map && typeof map === 'object' ? map : {};
  const headerIndex = buildLeadHeaderIndex(header);
  const indexes: Record<string, number | null> = {};
  for (const field of DEAL_IMPORT_FIELDS) {
    const mapped = mapping[field] ?? (field === 'lead_id' ? mapping.lead : field === 'revenue' ? mapping.amount : undefined);
    const exactKey = sanitizeStringValue(mapped);
    if (exactKey && headerIndex.exact.has(exactKey)) {
      indexes[field] = headerIndex.exact.get(exactKey) ?? null;
      continue;
    }
    const normalizedKey = normalizeMappingHeader(mapped);
    indexes[field] = normalizedKey && headerIndex.normalized.has(normalizedKey)
      ? (headerIndex.normalized.get(normalizedKey) ?? null)
      : null;
  }
  return indexes as Record<(typeof DEAL_IMPORT_FIELDS)[number], number | null>;
}

async function validateDealsCsvImport(options: {
  projectId: string;
  csv: string;
  map?: Record<string, unknown> | null;
  startRow?: number;
  endRow?: number;
  duplicatePolicy?: 'skip' | 'allow';
}) {
  const { projectId, csv, map } = options;
  const { header, records } = parseFlatCsvText(csv);
  const indexes = resolveDealMappingIndexes(header, map);
  const missingMappings = DEAL_REQUIRED_FIELDS.filter((field) => indexes[field] === null);
  if (missingMappings.length) return { ok: false, error: 'required_mapping_missing', header, missingMappings };

  const requestedStart = options.startRow === undefined ? 1 : Number(options.startRow);
  const requestedEnd = options.endRow === undefined ? records.length : Number(options.endRow);
  if (!Number.isInteger(requestedStart) || !Number.isInteger(requestedEnd) || requestedStart < 1 || requestedEnd < requestedStart || requestedEnd > records.length) {
    return { ok: false, error: 'invalid_row_range', header, totalRows: records.length };
  }

  const selectedRows = records.slice(requestedStart - 1, requestedEnd);
  const candidateDealIds = new Set<string>();
  const duplicateSelection = new Map<string, number[]>();
  const candidateLeadIds = new Set<string>();
  selectedRows.forEach((row, index) => {
    const rowNumber = requestedStart + index;
    const dealValue = indexes.deal_id === null ? null : sanitizeStringValue(row[indexes.deal_id] ?? '');
    const leadValue = indexes.lead_id === null ? null : sanitizeStringValue(row[indexes.lead_id] ?? '');
    if (dealValue) {
      candidateDealIds.add(dealValue);
      const key = dealValue.toLowerCase();
      const rowsForKey = duplicateSelection.get(key) || [];
      rowsForKey.push(rowNumber);
      duplicateSelection.set(key, rowsForKey);
    }
    if (leadValue) candidateLeadIds.add(leadValue);
  });

  const existingDeals = await Deal.find({ project_id: projectId, deal_id: { $in: Array.from(candidateDealIds) } }).select('deal_id').lean();
  const existingDealIds = new Set(existingDeals.map((deal) => String(deal.deal_id).toLowerCase()));
  const existingLeads = await Module6Lead.find({ project_id: projectId, lead_id: { $in: Array.from(candidateLeadIds) } }).select('lead_id').lean();
  const existingLeadIds = new Set(existingLeads.map((lead) => String(lead.lead_id).toLowerCase()));
  const conflictingLeadIds = new Set(
    (await Module6Lead.find({ project_id: projectId, lead_id: { $in: Array.from(candidateDealIds) } }).select('lead_id').lean())
      .map((lead) => String(lead.lead_id).toLowerCase())
  );
  const conflictingCampaignIds = new Set(
    (await Campaign.find({ project_id: projectId, campaign_id: { $in: Array.from(candidateDealIds) } }).select('campaign_id').lean())
      .map((campaign) => String(campaign.campaign_id).toLowerCase())
  );

  const rowResults = selectedRows.map((row, index) => {
    const rowNumber = requestedStart + index;
    const original = Object.fromEntries(header.map((column, columnIndex) => [column, row[columnIndex] ?? '']));
    const validation = validateDealValueFields({
      deal_id: indexes.deal_id !== null ? row[indexes.deal_id] : null,
      lead_id: indexes.lead_id !== null ? row[indexes.lead_id] : null,
      revenue: indexes.revenue !== null ? row[indexes.revenue] : null,
      currency: indexes.currency !== null ? row[indexes.currency] : null,
      closed_won: indexes.closed_won !== null ? row[indexes.closed_won] : null,
      closed_at: indexes.closed_at !== null ? row[indexes.closed_at] : null,
    });
    const errors = [...validation.errors];
    const warnings: Array<{ field: string; message: string }> = [];
    const dealKey = validation.payload.deal_id?.toLowerCase() || null;
    const leadKey = validation.payload.lead_id?.toLowerCase() || null;
    if (dealKey && (duplicateSelection.get(dealKey)?.length || 0) > 1) {
      errors.push({ field: 'deal_id', message: 'deal_id appears multiple times in this upload selection' });
    }
    if (dealKey) {
      appendCrossEntityConflictError(
        errors,
        'deal_id',
        validation.payload.deal_id,
        [
          ...(conflictingLeadIds.has(dealKey) ? ['lead' as const] : []),
          ...(conflictingCampaignIds.has(dealKey) ? ['campaign' as const] : []),
        ],
      );
    }
    if (leadKey && !existingLeadIds.has(leadKey)) {
      errors.push({ field: 'lead_id', message: 'lead_id does not exist' });
    }
    const action = dealKey && existingDealIds.has(dealKey) ? 'update' : 'insert';
    if (action === 'update' && options.duplicatePolicy === 'skip') {
      warnings.push({ field: 'deal_id', message: `deal_id ${validation.payload.deal_id} already exists and will be skipped on import` });
    } else if (action === 'update') {
      errors.push({ field: 'deal_id', message: 'deal_id already exists' });
    }
    return {
      rowNumber,
      original,
      mapped: validation.payload,
      action,
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });

  const invalidRows = rowResults.filter((row) => !row.valid);
  const validRows = rowResults.filter((row) => row.valid);
  const warningRows = rowResults.filter((row) => row.warnings.length > 0).length;
  return {
    ok: true,
    header,
    mapping: indexes,
    selectedRange: { startRow: requestedStart, endRow: requestedEnd, totalRows: records.length, selectedRows: selectedRows.length },
    summary: { checkedRows: rowResults.length, validRows: validRows.length, invalidRows: invalidRows.length, warningRows },
    rowResults,
    validRows,
    invalidRows,
  };
}

function resolveCampaignMappingIndexes(header: string[], map: Record<string, unknown> | null | undefined) {
  const mapping = map && typeof map === 'object' ? map : {};
  const headerIndex = buildLeadHeaderIndex(header);
  const indexes: Record<string, number | null> = {};

  for (const field of CAMPAIGN_IMPORT_FIELDS) {
    const mapped = mapping[field];
    const exactKey = sanitizeStringValue(mapped);
    if (exactKey && headerIndex.exact.has(exactKey)) {
      indexes[field] = headerIndex.exact.get(exactKey) ?? null;
      continue;
    }
    const normalizedKey = normalizeMappingHeader(mapped);
    indexes[field] = normalizedKey && headerIndex.normalized.has(normalizedKey)
      ? (headerIndex.normalized.get(normalizedKey) ?? null)
      : null;
  }

  return indexes as Record<(typeof CAMPAIGN_IMPORT_FIELDS)[number], number | null>;
}

async function validateCampaignsCsvImport(options: {
  projectId: string;
  csv: string;
  map?: Record<string, unknown> | null;
  startRow?: number;
  endRow?: number;
}) {
  const { projectId, csv, map } = options;
  const { header, records } = parseFlatCsvText(csv);
  const indexes = resolveCampaignMappingIndexes(header, map);
  const missingMappings = CAMPAIGN_REQUIRED_FIELDS.filter((field) => indexes[field] === null);
  if (missingMappings.length) {
    return { ok: false, error: 'required_mapping_missing', header, missingMappings };
  }

  const requestedStart = options.startRow === undefined ? 1 : Number(options.startRow);
  const requestedEnd = options.endRow === undefined ? records.length : Number(options.endRow);
  if (!Number.isInteger(requestedStart) || !Number.isInteger(requestedEnd) || requestedStart < 1 || requestedEnd < requestedStart || requestedEnd > records.length) {
    return { ok: false, error: 'invalid_row_range', header, totalRows: records.length };
  }

  const selectedRows = records.slice(requestedStart - 1, requestedEnd);
  const candidateIds = new Set<string>();
  const selectedIds = new Map<string, number[]>();
  selectedRows.forEach((row, index) => {
    const rowNumber = requestedStart + index;
    const value = indexes.campaign_id === null ? null : sanitizeStringValue(row[indexes.campaign_id] ?? '');
    if (!value) return;
    const key = value.toLowerCase();
    const matches = selectedIds.get(key) || [];
    matches.push(rowNumber);
    selectedIds.set(key, matches);
    candidateIds.add(value);
  });

  const existingCampaigns = await Campaign.find({ project_id: projectId, campaign_id: { $in: Array.from(candidateIds) } }).select('campaign_id').lean();
  const existingIds = new Set(existingCampaigns.map((campaign) => String(campaign.campaign_id).toLowerCase()));
  const conflictingLeadIds = new Set(
    (await Module6Lead.find({ project_id: projectId, lead_id: { $in: Array.from(candidateIds) } }).select('lead_id').lean())
      .map((lead) => String(lead.lead_id).toLowerCase())
  );
  const conflictingDealIds = new Set(
    (await Deal.find({ project_id: projectId, deal_id: { $in: Array.from(candidateIds) } }).select('deal_id').lean())
      .map((deal) => String(deal.deal_id).toLowerCase())
  );

  const rowResults = selectedRows.map((row, index) => {
    const rowNumber = requestedStart + index;
    const original = Object.fromEntries(header.map((column, columnIndex) => [column, row[columnIndex] ?? '']));
    const input = {
      campaign_id: indexes.campaign_id !== null ? row[indexes.campaign_id] : null,
      name: indexes.name !== null ? row[indexes.name] : null,
      channel: indexes.channel !== null ? row[indexes.channel] : null,
      description: indexes.description !== null ? row[indexes.description] : null,
      tags: indexes.tags !== null ? row[indexes.tags] : null,
      start_date: indexes.start_date !== null ? row[indexes.start_date] : null,
      end_date: indexes.end_date !== null ? row[indexes.end_date] : null,
      status: indexes.status !== null ? row[indexes.status] : null,
      spend: indexes.spend !== null ? row[indexes.spend] : null,
    };
    const validation = validateCampaignValueFields(input);
    const errors = [...validation.errors];
    const warnings: Array<{ field: string; message: string }> = [];
    const campaignKey = validation.payload.campaign_id?.toLowerCase() || null;
    if (campaignKey && (selectedIds.get(campaignKey)?.length || 0) > 1) {
      errors.push({ field: 'campaign_id', message: 'campaign_id appears multiple times in this upload selection' });
    }
    if (campaignKey) {
      appendCrossEntityConflictError(
        errors,
        'campaign_id',
        validation.payload.campaign_id,
        [
          ...(conflictingLeadIds.has(campaignKey) ? ['lead' as const] : []),
          ...(conflictingDealIds.has(campaignKey) ? ['deal' as const] : []),
        ],
      );
    }
    const action = campaignKey && existingIds.has(campaignKey) ? 'update' : 'insert';
    if (action === 'update' && validation.payload.campaign_id) {
      warnings.push({ field: 'campaign_id', message: `campaign_id ${validation.payload.campaign_id} already exists and will be updated` });
    }

    return {
      rowNumber,
      original,
      mapped: validation.payload,
      action,
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });

  const invalidRows = rowResults.filter((row) => !row.valid);
  const warningRows = rowResults.filter((row) => row.warnings.length > 0).length;
  const validRows = rowResults.filter((row) => row.valid);

  return {
    ok: true,
    header,
    mapping: indexes,
    selectedRange: {
      startRow: requestedStart,
      endRow: requestedEnd,
      totalRows: records.length,
      selectedRows: selectedRows.length,
    },
    summary: {
      checkedRows: rowResults.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      warningRows,
    },
    rowResults,
    validRows,
    invalidRows,
  };
}

function resolveLeadMappingIndexes(header: string[], map: Record<string, unknown> | null | undefined) {
  const mapping = map && typeof map === 'object' ? map : {};
  const headerIndex = buildLeadHeaderIndex(header);
  const indexes: Record<string, number | null> = {};

  for (const field of LEAD_IMPORT_FIELDS) {
    const mapped = mapping[field];
    const exactKey = sanitizeStringValue(mapped);
    if (exactKey && headerIndex.exact.has(exactKey)) {
      indexes[field] = headerIndex.exact.get(exactKey) ?? null;
      continue;
    }
    const normalizedKey = normalizeMappingHeader(mapped);
    indexes[field] = normalizedKey && headerIndex.normalized.has(normalizedKey)
      ? (headerIndex.normalized.get(normalizedKey) ?? null)
      : null;
  }

  return indexes as Record<(typeof LEAD_IMPORT_FIELDS)[number], number | null>;
}

function validateLeadValueFields(input: Record<string, unknown>) {
  const errors: Array<{ field: string; message: string }> = [];

  const leadId = sanitizeStringValue(input.lead_id ?? input.leadId);
  if (!leadId) errors.push({ field: 'lead_id', message: 'lead_id is required' });

  const rowNumberRaw = input.row_number;
  const rowNumberProvided = rowNumberRaw !== undefined && rowNumberRaw !== null && rowNumberRaw !== '';
  const rowNumber = rowNumberProvided ? sanitizeNumberValue(rowNumberRaw) : null;
  if (rowNumberProvided) {
    if (rowNumber === null || !Number.isInteger(rowNumber) || rowNumber < 1) {
      errors.push({ field: 'row_number', message: 'row_number must be a positive integer' });
    }
  }

  const leadScoreRaw = input.lead_score;
  if (leadScoreRaw !== undefined && leadScoreRaw !== null && leadScoreRaw !== '' && sanitizeNumberValue(leadScoreRaw) === null) {
    errors.push({ field: 'lead_score', message: 'lead_score must be a number' });
  }

  const intentScoreRaw = input.intent_score;
  if (intentScoreRaw !== undefined && intentScoreRaw !== null && intentScoreRaw !== '' && sanitizeNumberValue(intentScoreRaw) === null) {
    errors.push({ field: 'intent_score', message: 'intent_score must be a number' });
  }

  const email = sanitizeStringValue(input.email);
  if (email && !EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'email must be a valid email address' });
  }

  const categoricalRules: Array<{
    field: 'source' | 'owner' | 'industry' | 'region' | 'segment';
    allowed: Set<string>;
    message: string;
  }> = [
    { field: 'source', allowed: LEAD_SOURCES, message: `source must be one of ${Array.from(LEAD_SOURCES).join(', ')}` },
    { field: 'owner', allowed: LEAD_OWNERS, message: `owner must be one of ${Array.from(LEAD_OWNERS).join(', ')}` },
    { field: 'industry', allowed: LEAD_INDUSTRIES, message: `industry must be one of ${Array.from(LEAD_INDUSTRIES).join(', ')}` },
    { field: 'region', allowed: LEAD_REGIONS, message: `region must be one of ${Array.from(LEAD_REGIONS).join(', ')}` },
    { field: 'segment', allowed: LEAD_SEGMENTS, message: `segment must be one of ${Array.from(LEAD_SEGMENTS).join(', ')}` },
  ];

  for (const rule of categoricalRules) {
    const value = sanitizeStringValue(input[rule.field]);
    if (!value) continue;
    if (!rule.allowed.has(value.toLowerCase())) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }

  return {
    errors,
    leadId,
    rowNumber,
    payload: buildModule6LeadPayload(input as Record<string, any>),
  };
}

async function validateModule6LeadCsvImport(options: {
  projectId: string;
  csv: string;
  map?: Record<string, unknown> | null;
  startRow?: number;
  endRow?: number;
}) {
  const { projectId, csv, map } = options;
  const { header, records } = parseLeadCsvText(csv);
  const indexes = resolveLeadMappingIndexes(header, map);
  const missingMappings = LEAD_REQUIRED_FIELDS.filter((field) => indexes[field] === null);

  if (missingMappings.length) {
    return {
      ok: false,
      error: 'required_mapping_missing',
      header,
      missingMappings,
    };
  }

  const requestedStart = options.startRow === undefined ? 1 : Number(options.startRow);
  const requestedEnd = options.endRow === undefined ? records.length : Number(options.endRow);
  if (!Number.isInteger(requestedStart) || !Number.isInteger(requestedEnd) || requestedStart < 1 || requestedEnd < requestedStart || requestedEnd > records.length) {
    return {
      ok: false,
      error: 'invalid_row_range',
      header,
      totalRows: records.length,
    };
  }

  const selectedRows = records.slice(requestedStart - 1, requestedEnd);
  const selectedLeadIds = new Map<string, number[]>();
  const candidateIds = new Set<string>();

  selectedRows.forEach((row, idx) => {
    const rowNumber = requestedStart + idx;
    const leadIdIdx = indexes.lead_id;
    const leadId = leadIdIdx === null ? null : sanitizeStringValue(row[leadIdIdx] ?? '');
    if (!leadId) return;
    const key = leadId.toLowerCase();
    const matches = selectedLeadIds.get(key) || [];
    matches.push(rowNumber);
    selectedLeadIds.set(key, matches);
    candidateIds.add(leadId);
  });

  const existingLeads = await Module6Lead.find({ project_id: projectId, lead_id: { $in: Array.from(candidateIds) } }).select('lead_id').lean();
  const existingLeadIds = new Set(existingLeads.map((lead) => String(lead.lead_id).toLowerCase()));
  const conflictingCampaignIds = new Set(
    (await Campaign.find({ project_id: projectId, campaign_id: { $in: Array.from(candidateIds) } }).select('campaign_id').lean())
      .map((campaign) => String(campaign.campaign_id).toLowerCase())
  );
  const conflictingDealIds = new Set(
    (await Deal.find({ project_id: projectId, deal_id: { $in: Array.from(candidateIds) } }).select('deal_id').lean())
      .map((deal) => String(deal.deal_id).toLowerCase())
  );

  const rowResults = selectedRows.map((row, idx) => {
    const rowNumber = requestedStart + idx;
    const original = Object.fromEntries(header.map((column, columnIndex) => [column, row[columnIndex] ?? '']));
    const input = {
      lead_id: indexes.lead_id !== null ? row[indexes.lead_id] : null,
      full_name: indexes.full_name !== null ? row[indexes.full_name] : null,
      first_name: indexes.first_name !== null ? row[indexes.first_name] : null,
      last_name: indexes.last_name !== null ? row[indexes.last_name] : null,
      company: indexes.company !== null ? row[indexes.company] : null,
      source: indexes.source !== null ? row[indexes.source] : null,
      owner: indexes.owner !== null ? row[indexes.owner] : null,
      industry: indexes.industry !== null ? row[indexes.industry] : null,
      region: indexes.region !== null ? row[indexes.region] : null,
      lead_score: indexes.lead_score !== null ? row[indexes.lead_score] : null,
      intent_score: indexes.intent_score !== null ? row[indexes.intent_score] : null,
      email: indexes.email !== null ? row[indexes.email] : null,
      job_title: indexes.job_title !== null ? row[indexes.job_title] : null,
      segment: indexes.segment !== null ? row[indexes.segment] : null,
      raw: original,
      row_number: rowNumber,
    };

    const validation = validateLeadValueFields(input);
    const errors = [...validation.errors];
    const warnings: Array<{ field: string; message: string }> = [];
    const leadIdKey = validation.leadId ? validation.leadId.toLowerCase() : null;
    if (leadIdKey && (selectedLeadIds.get(leadIdKey)?.length || 0) > 1) {
      errors.push({ field: 'lead_id', message: 'lead_id appears multiple times in this upload selection' });
    }
    if (leadIdKey) {
      appendCrossEntityConflictError(
        errors,
        'lead_id',
        validation.leadId,
        [
          ...(conflictingCampaignIds.has(leadIdKey) ? ['campaign' as const] : []),
          ...(conflictingDealIds.has(leadIdKey) ? ['deal' as const] : []),
        ],
      );
    }

    const action = leadIdKey && existingLeadIds.has(leadIdKey) ? 'update' : 'insert';
    if (action === 'update' && validation.leadId) {
      warnings.push({ field: 'lead_id', message: `lead_id ${validation.leadId} already exists and will be updated` });
    }

    return {
      rowNumber,
      original,
      mapped: {
        lead_id: validation.leadId,
        ...validation.payload,
        row_number: validation.rowNumber,
      },
      action,
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });

  const invalidRows = rowResults.filter((row) => !row.valid);
  const warningRows = rowResults.filter((row) => row.warnings.length > 0).length;
  const validRows = rowResults.filter((row) => row.valid);

  return {
    ok: true,
    header,
    mapping: indexes,
    selectedRange: {
      startRow: requestedStart,
      endRow: requestedEnd,
      totalRows: records.length,
      selectedRows: selectedRows.length,
    },
    summary: {
      checkedRows: rowResults.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      warningRows,
    },
    rowResults,
    validRows,
    invalidRows,
  };
}

function buildModule6LeadPayload(input: Record<string, any>) {
  const fullName = deriveFullName(input);
  const firstName = sanitizeStringValue(input.first_name);
  const lastName = sanitizeStringValue(input.last_name);
  return {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    company: sanitizeStringValue(input.company),
    source: sanitizeStringValue(input.source),
    owner: sanitizeStringValue(input.owner),
    industry: sanitizeStringValue(input.industry),
    region: sanitizeStringValue(input.region),
    lead_score: sanitizeNumberValue(input.lead_score),
    intent_score: sanitizeNumberValue(input.intent_score),
    email: sanitizeStringValue(input.email),
    job_title: sanitizeStringValue(input.job_title),
    segment: sanitizeStringValue(input.segment),
    is_archived: input.is_archived === undefined ? undefined : sanitizeBooleanValue(input.is_archived),
    raw: isObjectRecord(input.raw) ? input.raw : null,
  };
}

function serializeModule6Lead(lead: any) {
  return {
    _id: String(lead._id),
    project_id: String(lead.project_id),
    row_number: lead.row_number ?? null,
    lead_id: lead.lead_id,
    full_name: lead.full_name || null,
    first_name: lead.first_name || null,
    last_name: lead.last_name || null,
    company: lead.company || null,
    source: lead.source || null,
    owner: lead.owner || null,
    industry: lead.industry || null,
    region: lead.region || null,
    lead_score: lead.lead_score ?? null,
    intent_score: lead.intent_score ?? null,
    email: lead.email || null,
    job_title: lead.job_title || null,
    segment: lead.segment || null,
    is_archived: !!lead.is_archived,
    raw: lead.raw || null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

async function syncModule6LeadToFunnelLead(projectId: string, lead: any) {
  const payload = {
    full_name: lead.full_name || null,
    first_name: lead.first_name || null,
    last_name: lead.last_name || null,
    company: lead.company || null,
    source: lead.source || null,
    owner: lead.owner || null,
    industry: lead.industry || null,
    region: lead.region || null,
    lead_score: lead.lead_score ?? null,
    intent_score: lead.intent_score ?? null,
    email: lead.email || null,
    job_title: lead.job_title || null,
    segment: lead.segment || null,
    is_archived: !!lead.is_archived,
    raw: lead.raw || null,
  };

  await FunnelLead.updateOne(
    { workspace_id: projectId, lead_id: lead.lead_id },
    {
      $set: payload,
      $setOnInsert: {
        workspace_id: projectId,
        lead_id: lead.lead_id,
      },
      $currentDate: { updated_at: true },
    },
    { upsert: true }
  );
}

async function loadLeadSummariesByObjectIds(ids: string[]) {
  const summaries: Record<string, { name: string | null; email: string | null; company: string | null; lead_id: string | null }> = {};
  if (!ids.length) return summaries;

  const objectIds = ids.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return summaries;

  const [legacyDocs, module6Docs] = await Promise.all([
    Lead.find({ _id: { $in: objectIds } }).select('First_Name Last_Name Email Company lead_id').lean(),
    Module6Lead.find({ _id: { $in: objectIds } }).select('lead_id full_name first_name last_name email company').lean(),
  ]);

  for (const doc of legacyDocs) {
    summaries[String(doc._id)] = {
      name: `${doc.First_Name || ''} ${doc.Last_Name || ''}`.trim() || null,
      email: (doc as any).Email || null,
      company: (doc as any).Company || null,
      lead_id: doc.lead_id != null ? String(doc.lead_id) : null,
    };
  }

  for (const doc of module6Docs) {
    summaries[String(doc._id)] = {
      name: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || null,
      email: doc.email || null,
      company: doc.company || null,
      lead_id: doc.lead_id || null,
    };
  }

  return summaries;
}

async function resolveLeadObjectId(
  projectId: string,
  rawValue: string,
  cache: Record<string, string>
): Promise<string | null> {
  const value = (rawValue || '').trim();
  if (!value) return null;
  const cacheKey = value.toLowerCase();
  if (cache[cacheKey]) return cache[cacheKey];

  const remember = (doc: { _id: mongoose.Types.ObjectId } | null | undefined) => {
    if (!doc) return null;
    const id = String(doc._id);
    cache[cacheKey] = id;
    return id;
  };

  if (mongoose.isValidObjectId(value)) {
    const direct = await Module6Lead.findOne({ _id: value, project_id: projectId }).select('_id').lean();
    if (remember(direct)) return cache[cacheKey] ?? null;
    const legacy = await Lead.findById(value).select('_id').lean();
    if (remember(legacy)) return cache[cacheKey] ?? null;
  }

  const directLead = await Module6Lead.findOne({ project_id: projectId, lead_id: value }).select('_id').lean();
  if (remember(directLead)) return cache[cacheKey] ?? null;

  if (/^\d+$/.test(value)) {
    const legacyNumeric = await Lead.findOne({ lead_id: Number(value) }).select('_id').lean();
    if (remember(legacyNumeric)) return cache[cacheKey] ?? null;
  }

  if (value.includes('@')) {
    const emailRegex = new RegExp(`^${sanitizeRegex(value)}$`, 'i');
    const moduleByEmail = await Module6Lead.findOne({ project_id: projectId, email: emailRegex }).select('_id').lean();
    if (remember(moduleByEmail)) return cache[cacheKey] ?? null;
    const legacyByEmail = await Lead.findOne({ Email: emailRegex }).select('_id').lean();
    if (remember(legacyByEmail)) return cache[cacheKey] ?? null;
  }

  const nameRegex = new RegExp(sanitizeRegex(value), 'i');
  const moduleByName = await Module6Lead.findOne({
    project_id: projectId,
    $or: [{ full_name: nameRegex }, { first_name: nameRegex }, { last_name: nameRegex }],
  }).select('_id').lean();
  if (remember(moduleByName)) return cache[cacheKey] ?? null;

  return null;
}

type AllocationPipelineOptions = {
  projectId: string;
  runId: string;
  minShare?: number | undefined;
  channel?: string | null | undefined;
  closedFrom?: Date | undefined;
  closedTo?: Date | undefined;
  leadRegex?: RegExp | null | undefined;
  minDealAmount?: number | undefined;
  maxDealAmount?: number | undefined;
  status?: 'closed_won' | 'all' | 'open' | undefined;
};

function buildAllocationBasePipeline(options: AllocationPipelineOptions, initialMatch: Record<string, any> = {}) {
  const baseMatch: Record<string, any> = {
    project_id: options.projectId,
    run_id: options.runId,
    ...initialMatch,
  };

  if (options.minShare !== undefined && !Number.isNaN(options.minShare)) {
    baseMatch.revenue_share = { $gte: options.minShare };
  }

  const pipeline: any[] = [
    { $match: baseMatch },
    { $lookup: { from: 'deals', localField: 'deal_id', foreignField: 'deal_id', as: 'deal' } },
    { $unwind: '$deal' },
    { $lookup: { from: 'campaigns', localField: 'campaign_id', foreignField: 'campaign_id', as: 'campaign' } },
    { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        campaign_channel: {
          $toLower: {
            $ifNull: ['$campaign.channel', 'other']
          }
        }
      }
    }
  ];

  if (options.closedFrom || options.closedTo) {
    const closedMatch: Record<string, Date> = {};
    if (options.closedFrom) closedMatch.$gte = options.closedFrom;
    if (options.closedTo) closedMatch.$lte = options.closedTo;
    pipeline.push({ $match: { 'deal.closed_at': closedMatch } });
  }

  if (options.minDealAmount !== undefined && !Number.isNaN(options.minDealAmount)) {
    pipeline.push({ $match: { 'deal.revenue': { $gte: options.minDealAmount } } });
  }

  if (options.maxDealAmount !== undefined && !Number.isNaN(options.maxDealAmount)) {
    pipeline.push({ $match: { 'deal.revenue': { $lte: options.maxDealAmount } } });
  }

  if (options.status && options.status !== 'all') {
    if (options.status === 'closed_won') pipeline.push({ $match: { 'deal.closed_won': true } });
    else if (options.status === 'open') pipeline.push({ $match: { 'deal.closed_won': false } });
  }

  if (options.channel) {
    pipeline.push({ $match: { campaign_channel: options.channel } });
  }

  pipeline.push(
    { $lookup: { from: 'leads', localField: 'deal.lead_id', foreignField: '_id', as: 'lead_legacy' } },
    { $lookup: { from: 'm06_leads', localField: 'deal.lead_id', foreignField: 'lead_id', as: 'lead_module6' } },
    {
      $addFields: {
        lead: {
          $cond: [
            { $gt: [{ $size: '$lead_legacy' }, 0] },
            { $first: '$lead_legacy' },
            {
              $cond: [
                { $gt: [{ $size: '$lead_module6' }, 0] },
                { $first: '$lead_module6' },
                null
              ]
            }
          ]
        }
      }
    },
    { $project: { lead_legacy: 0, lead_module6: 0 } },
    { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } }
  );

  if (options.leadRegex) {
    pipeline.push({
      $match: {
        $or: [
          { 'lead.First_Name': options.leadRegex },
          { 'lead.Last_Name': options.leadRegex },
          { 'lead.Email': options.leadRegex },
          { 'lead.Company': options.leadRegex }
        ]
      }
    });
  }

  return pipeline;
}

// Drill-down: deals for a specific campaign within a run
export async function allocationDealsForCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!campaignId) return res.status(400).json({ error: 'campaignId_required' });

    const pipeline = buildAllocationBasePipeline({ projectId, runId }, { campaign_id: campaignId });
    pipeline.push({ $limit: MAX_ALLOCATIONS_LIMIT });

    const rows = await AttributionResult.aggregate(pipeline).exec();
    const out = rows.map((r: any) => ({
      deal_id: String(r.deal.deal_id || r.deal_id),
      deal_amount: r.deal.revenue || 0,
      revenue_share: r.revenue_share || 0,
      closed_at: r.deal.closed_at,
      lead_name: r.lead ? ((`${r.lead.First_Name || ''} ${r.lead.Last_Name || ''}`.trim()) || r.lead.name || null) : null,
      lead_email: r.lead ? (r.lead.Email || r.lead.email || null) : null,
    }));

    return res.json({ ok: true, allocations: out });
  } catch (e) {
    console.error('[m06/allocationDealsForCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Drill-down: campaigns for a specific deal within a run
export async function allocationCampaignsForDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    const dealId = req.query.dealId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!dealId) return res.status(400).json({ error: 'dealId_required' });

    const pipeline = buildAllocationBasePipeline({ projectId, runId }, { deal_id: dealId });
    pipeline.push({ $limit: MAX_ALLOCATIONS_LIMIT });

    const rows = await AttributionResult.aggregate(pipeline).exec();
    const out = rows.map((r: any) => ({
      campaign_id: String(r.campaign?.campaign_id || r.campaign_id),
      campaign_name: r.campaign?.name || null,
      channel: r.campaign_channel || null,
      revenue_share: r.revenue_share || 0,
    }));

    return res.json({ ok: true, allocations: out });
  } catch (e) {
    console.error('[m06/allocationCampaignsForDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function stats(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const requestedRunId = (req.query.runId as string) || '';
    const requestedModel = sanitizeStringValue(req.query.model)?.replace('-', '_') || null;
    const requestedChannels = getRequestedChannels(req.query.channels);
    let runDoc: any = null;

    if (requestedRunId) {
      if (!mongoose.isValidObjectId(requestedRunId)) return res.status(400).json({ ok: false, error: 'runId_required' });
      runDoc = await AttributionRun.findOne({ _id: requestedRunId, project_id: projectId }).lean();
      if (!runDoc || runDoc.status === 'error') return res.status(400).json({ ok: false, error: 'invalid_run' });
    } else {
      const runQuery: Record<string, unknown> = { project_id: projectId, status: 'success' };
      if (requestedModel) runQuery.model_type = requestedModel;
      runDoc = await AttributionRun.findOne(runQuery).sort({ createdAt: -1 }).lean();
      if (!runDoc) {
        const [deals, campaigns] = await Promise.all([
          Deal.find({ project_id: projectId }).lean(),
          Campaign.find({ project_id: projectId }).lean(),
        ]);

        const filteredDeals = deals;
        const filteredCampaigns = campaigns.filter((campaign) => {
          const channel = String(campaign.channel || 'other').toLowerCase();
          return !requestedChannels || requestedChannels.has(channel);
        });

        const totalRevenue = filteredDeals.reduce((sum, deal) => sum + (Number(deal.revenue) || 0), 0);
        const totalSpend = filteredCampaigns.reduce((sum, campaign) => sum + (Number(campaign.spend) || 0), 0);

        const revenueOverTimeMap: Record<string, { period: string; revenue: number; spend: number; roi: number }> = {};
        for (const deal of filteredDeals) {
          const closedAt = deal.closed_at ? new Date(deal.closed_at) : null;
          if (!closedAt || Number.isNaN(closedAt.getTime())) continue;
          const label = closedAt.toISOString().slice(0, 7);
          if (!revenueOverTimeMap[label]) {
            revenueOverTimeMap[label] = { period: label, revenue: 0, spend: 0, roi: 0 };
          }
          revenueOverTimeMap[label].revenue += Number(deal.revenue) || 0;
        }

        const spendByChannelMap: Record<string, { channel: string; revenue: number; spend: number; attributedRevenue: number; roi: number }> = {};
        for (const campaign of filteredCampaigns) {
          const channel = String(campaign.channel || 'other').toLowerCase();
          if (!spendByChannelMap[channel]) {
            spendByChannelMap[channel] = { channel, revenue: 0, spend: 0, attributedRevenue: 0, roi: 0 };
          }
          spendByChannelMap[channel].spend += Number(campaign.spend) || 0;
        }

        return res.json({
          ok: true,
          totalRevenue,
          attributedRevenue: 0,
          totalSpend,
          campaignCount: filteredCampaigns.length,
          modelName: requestedModel,
          lastRun: null,
          runId: null,
          status: 'no_attribution',
          message: 'No successful attribution run found yet. Upload data and run attribution to unlock ROI-based dashboard metrics.',
          revenueByChannel: Object.values(spendByChannelMap),
          revenueOverTime: Object.values(revenueOverTimeMap).sort((a, b) => a.period.localeCompare(b.period)),
          topCampaigns: [],
          bottomCampaigns: [],
        });
      }
    }

    const runId = String(runDoc._id);

    // Attribution rows for the run
    let rows = await AttributionResult.aggregate([
      { $match: { run_id: runId, project_id: projectId } },
      { $lookup: { from: 'deals', localField: 'deal_id', foreignField: 'deal_id', as: 'deal' } },
      { $unwind: { path: '$deal', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'campaigns', localField: 'campaign_id', foreignField: 'campaign_id', as: 'campaign' } },
      { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          revenue: '$revenue_share',
          spend: { $ifNull: ['$campaign.spend', 0] },
          channel: { $toLower: { $ifNull: ['$campaign.channel', 'other'] } },
          name: '$campaign.name',
          ym: { $cond: [{ $ifNull: ['$deal.closed_at', false] }, { $dateToString: { format: "%Y-%m", date: '$deal.closed_at' } }, 'unknown'] }
        }
      }
    ]).exec();

    rows = rows.filter((row: any) => {
      const channel = String(row.channel || 'other').toLowerCase();
      if (requestedChannels && !requestedChannels.has(channel)) return false;
      return true;
    });

    const totalRevenue = rows.reduce((s: number, r: any) => s + (Number(r.revenue) || 0), 0);
    const totalSpend = rows.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
    const campaignIds = new Set<string>();
    rows.forEach((r: any) => campaignIds.add(String(r.campaign_id)));

    // Revenue by channel
    const chMap: Record<string, { channel: string; revenue: number; spend: number; attributedRevenue: number; roi: number }> = {};
    for (const r of rows) {
      const key = r.channel || 'other';
      if (!chMap[key]) chMap[key] = { channel: key, revenue: 0, spend: 0, attributedRevenue: 0, roi: 0 };
      chMap[key].revenue += Number(r.revenue) || 0;
      chMap[key].spend += Number(r.spend) || 0;
      chMap[key].attributedRevenue += Number(r.revenue) || 0;
    }
    const revenueByChannel = Object.values(chMap).map(c => ({ ...c, roi: c.spend > 0 ? (c.revenue / c.spend) * 100 : 0 }));

    // Revenue over time
    const overTime: Record<string, { period: string; revenue: number; spend: number; roi: number }> = {};
    for (const r of rows) {
      const label = r.ym || 'unknown';
      if (!overTime[label]) overTime[label] = { period: label, revenue: 0, spend: 0, roi: 0 };
      overTime[label].revenue += Number(r.revenue) || 0;
      overTime[label].spend += Number(r.spend) || 0;
    }
    const revenueOverTime = Object.values(overTime).map(v => ({ ...v, roi: v.spend > 0 ? (v.revenue / v.spend) * 100 : 0 })).sort((a, b) => a.period.localeCompare(b.period));

    // Campaign ROI lists
    const campMap: Record<string, { name: string; channel: string; spend: number; revenue: number; roi: number }> = {};
    for (const r of rows) {
      const id = String(r.campaign_id || '')
      if (!id) continue;
      if (!campMap[id]) campMap[id] = { name: r.name || id, channel: r.channel || 'other', spend: 0, revenue: 0, roi: 0 };
      campMap[id].spend += Number(r.spend) || 0;
      campMap[id].revenue += Number(r.revenue) || 0;
    }
    const campArr = Object.values(campMap).map(c => ({ ...c, roi: c.spend > 0 ? (c.revenue / c.spend) * 100 : 0 }));
    const topCampaigns = [...campArr].sort((a, b) => (b.roi - a.roi));
    const bottomCampaigns = [...campArr].sort((a, b) => (a.roi - b.roi));

    return res.json({
      ok: true,
      totalRevenue,
      attributedRevenue: totalRevenue,
      totalSpend,
      campaignCount: campaignIds.size,
      modelName: (runDoc as any).model_type || 'linear',
      lastRun: runDoc.createdAt || runDoc.timestamp || new Date(),
      runId,
      status: runDoc.status || 'success',
      revenueByChannel,
      revenueOverTime,
      topCampaigns,
      bottomCampaigns,
    });
  } catch (e) {
    console.error('[m06/stats]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/latest-run?workspaceId=...
export async function latestRun(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ ok: false, error: 'workspaceId_required' });
    const run = await AttributionRun.findOne({ project_id: projectId, status: 'success' }).sort({ createdAt: -1 }).lean();
    if (!run) return res.json({ ok: true, run: null });
    return res.json({ ok: true, run: { runId: String(run._id), model: (run as any).modelType || (run as any).model_type || 'linear', createdAt: (run as any).createdAt || (run as any).timestamp, status: run.status } });
  } catch (e) {
    console.error('[m06/latest-run]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

// GET /m06/run-list?workspaceId=...
export async function runList(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ ok: false, error: 'workspaceId_required' });
    const runs = await AttributionRun.find({ project_id: projectId }).sort({ createdAt: -1 }).select({ _id: 1, modelType: 1, model_type: 1, createdAt: 1, timestamp: 1, status: 1 }).lean();
    return res.json({ ok: true, runs: runs.map(r => ({ runId: String(r._id), model: (r as any).modelType || (r as any).model_type || 'linear', createdAt: (r as any).createdAt || (r as any).timestamp, status: (r as any).status || 'pending' })) });
  } catch (e) {
    console.error('[m06/run-list]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

// GET /m06/allocation/campaigns?projectId=...&runId=...
export async function allocationByCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });

    const minShare = req.query.minShare !== undefined ? Number(req.query.minShare) : undefined;
    const channel = (req.query.channel as string | undefined) || null;
    const closedFrom = parseDateInput(req.query.closedFrom as string | undefined);
    const closedTo = parseDateInput(req.query.closedTo as string | undefined);
    const leadSearch = (req.query.lead as string | undefined) || '';
    const statusParam = (req.query.status as string | undefined) || 'all';
    const status = statusParam === 'closed_won' || statusParam === 'open' ? statusParam : 'all';

    const page = req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : 1;
    const limit = req.query.limit !== undefined ? Math.min(MAX_ALLOCATIONS_LIMIT, Math.max(1, Number(req.query.limit))) : 50;

    const leadRegex = leadSearch
      ? new RegExp(sanitizeRegex(leadSearch.trim()), 'i')
      : null;

    const options: AllocationPipelineOptions = {
      projectId,
      runId,
      minShare,
      channel,
      closedFrom,
      closedTo,
      leadRegex,
      status,
    };

    const basePipeline = buildAllocationBasePipeline(options);

    const summaryPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$campaign.campaign_id',
          campaign_id: { $first: '$campaign.campaign_id' },
          name: { $first: '$campaign.name' },
          channel: { $first: '$campaign_channel' },
          total_revenue: { $sum: '$revenue_share' },
          deal_ids: { $addToSet: '$deal.deal_id' },
        },
      },
      {
        $project: {
          _id: 0,
          campaign_id: '$campaign_id',
          name: 1,
          channel: 1,
          total_revenue: 1,
          deal_count: { $size: '$deal_ids' },
          avg_revenue_per_deal: {
            $cond: [{ $gt: [{ $size: '$deal_ids' }, 0] }, { $divide: ['$total_revenue', { $size: '$deal_ids' }] }, 0],
          },
        },
      },
      { $sort: { total_revenue: -1 } },
      { $limit: MAX_ALLOCATIONS_LIMIT },
    ];

    const totalAgg = await AttributionResult.aggregate([
      ...basePipeline,
      { $group: { _id: '$campaign.campaign_id' } },
      { $count: 'total' },
    ]).exec();
    const total = totalAgg[0]?.total || 0;

    // Apply pagination to summary
    const pagedPipeline = [
      ...summaryPipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const summary = await AttributionResult.aggregate(pagedPipeline).exec();

    return res.json({ ok: true, campaigns: summary || [], page, limit, total });
  } catch (e) {
    console.error('[m06/allocationByCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/allocation/deals?projectId=...&runId=...
export async function allocationByDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });

    const minShare = req.query.minShare !== undefined ? Number(req.query.minShare) : undefined;
    const channel = (req.query.channel as string | undefined) || null;
    const closedFrom = parseDateInput(req.query.closedFrom as string | undefined);
    const closedTo = parseDateInput(req.query.closedTo as string | undefined);
    const leadSearch = (req.query.lead as string | undefined) || '';
    const statusParam = (req.query.status as string | undefined) || 'all';
    const status = statusParam === 'closed_won' || statusParam === 'open' ? statusParam : 'all';
    const minDealAmount = req.query.minDealAmount !== undefined ? Number(req.query.minDealAmount) : undefined;
    const maxDealAmount = req.query.maxDealAmount !== undefined ? Number(req.query.maxDealAmount) : undefined;

    const page = req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : 1;
    const limit = req.query.limit !== undefined ? Math.min(MAX_ALLOCATIONS_LIMIT, Math.max(1, Number(req.query.limit))) : 50;

    const leadRegex = leadSearch
      ? new RegExp(sanitizeRegex(leadSearch.trim()), 'i')
      : null;

    const options: AllocationPipelineOptions = {
      projectId,
      runId,
      minShare,
      channel,
      closedFrom,
      closedTo,
      leadRegex,
      minDealAmount,
      maxDealAmount,
      status,
    };

    const basePipeline = buildAllocationBasePipeline(options);

    const summaryPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$deal.deal_id',
          deal_id: { $first: '$deal.deal_id' },
          amount: { $first: '$deal.revenue' },
          closed_at: { $first: '$deal.closed_at' },
          closed_won: { $first: '$deal.closed_won' },
          lead: { $first: '$lead' },
          total_attributed: { $sum: '$revenue_share' },
          campaign_count: { $addToSet: '$campaign.campaign_id' },
        },
      },
      {
        $project: {
          _id: 0,
          deal_id: '$deal_id',
          amount: 1,
          closed_at: 1,
          closed_won: 1,
          lead_name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$lead.First_Name', ''] },
                  ' ',
                  { $ifNull: ['$lead.Last_Name', ''] },
                ],
              },
            },
          },
          lead_email: '$lead.Email',
          total_attributed: 1,
          unattributed: { $max: [{ $subtract: ['$amount', '$total_attributed'] }, 0] },
          campaign_count: { $size: '$campaign_count' },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: MAX_ALLOCATIONS_LIMIT },
    ];

    const totalAgg = await AttributionResult.aggregate([
      ...basePipeline,
      { $group: { _id: '$deal.deal_id' } },
      { $count: 'total' },
    ]).exec();
    const total = totalAgg[0]?.total || 0;

    const pagedPipeline = [
      ...summaryPipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const deals = await AttributionResult.aggregate(pagedPipeline).exec();
    return res.json({ ok: true, deals, page, limit, total });
  } catch (e) {
    console.error('[m06/allocationByDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Helper: ensure the user (from Authorization header) is an active sales_manager or marketing_manager in workspace
async function ensureDeletePermission(req: Request, workspaceId: string | null) {
  try {
    const auth = req.header('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return false;
    const { verifyToken } = await import('../core/auth/utils/jwt.js');
    const payload = verifyToken(token as string);
    const userId = payload?.sub;
    if (!userId) return false;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return false;
    const member = await WorkspaceMember.findOne({ workspaceId, userId, status: 'active' }).lean();
    if (!member) return false;
    // only head_manager and sales_manager allowed to delete per requirements
    return member.role === 'sales_manager' || member.role === 'head_manager';
  } catch (e) {
    return false;
  }
}

export async function getRunResults(req: Request, res: Response) {
  try {
    const runId = (req.params.id as string) || (req.query.runId as string) || null;
    const projectId = getProjectId(req);
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });

    const rows = await AttributionResult.find({ run_id: runId, project_id: projectId }).lean();
    const campaignIds = Array.from(new Set(rows.map(r => String(r.campaign_id))));
    const dealIds = Array.from(new Set(rows.map(r => String(r.deal_id))));

    const campaigns = await Campaign.find({ project_id: projectId, campaign_id: { $in: campaignIds } }).lean();
    const deals = await Deal.find({ project_id: projectId, deal_id: { $in: dealIds } }).lean();

    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c.campaign_id)] = c;
    const dealMap: Record<string, any> = {};
    for (const d of deals) dealMap[String(d.deal_id)] = d;

    const out = rows.map(r => ({ deal_id: String(r.deal_id), deal_external_id: dealMap[String(r.deal_id)]?.deal_id || null, campaign_id: String(r.campaign_id), campaignName: campaignMap[String(r.campaign_id)]?.name || null, revenue_share: r.revenue_share }));
    return res.json({ ok: true, results: out });
  } catch (e) {
    console.error('[m06/getRunResults]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// --- Campaign management endpoints ---
// --- Campaign Touch management (Screen 2) ---
export async function createCampaignTouch(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { leadId, lead_id, campaignId, campaign_id, channel, type, touched_at, metadata, status } = req.body || {};
    const leadValue = requireStringId(lead_id ?? leadId);
    const campaignValue = requireStringId(campaign_id ?? campaignId);
    if (!leadValue) return res.status(400).json({ error: 'lead_id_required' });
    if (!campaignValue) return res.status(400).json({ error: 'campaign_id_required' });
    if (!touched_at) return res.status(400).json({ error: 'touched_at_required' });
    if (!type) return res.status(400).json({ error: 'type_required' });
    const dt = new Date(touched_at);
    if (isNaN(dt.getTime())) return res.status(400).json({ error: 'invalid_datetime' });
    const normalizedType = normalizeEnumValue(type, TOUCH_TYPES);
    if (!normalizedType) return res.status(400).json({ error: 'invalid_type', allowed: Array.from(TOUCH_TYPES) });
    const normalizedChannel = channel === undefined ? null : normalizeEnumValue(channel, TOUCH_CHANNELS);
    if (channel !== undefined && normalizedChannel === null) return res.status(400).json({ error: 'invalid_channel', allowed: Array.from(TOUCH_CHANNELS) });
    const normalizedStatus = status === undefined ? 'active' : normalizeEnumValue(status, TOUCH_STATUSES);
    if (status !== undefined && normalizedStatus === null) return res.status(400).json({ error: 'invalid_status', allowed: Array.from(TOUCH_STATUSES) });

    const lead = await Module6Lead.findOne({ project_id: projectId, lead_id: leadValue }).select('_id').lean();
    if (!lead) return res.status(400).json({ error: 'lead_not_found' });
    const campaign = await Campaign.findOne({ project_id: projectId, campaign_id: campaignValue }).select('campaign_id channel').lean();
    if (!campaign) return res.status(400).json({ error: 'campaign_not_found' });

    const touch = await CampaignTouch.create({
      project_id: projectId,
      lead_id: leadValue,
      campaign_id: campaignValue,
      channel: normalizedChannel || campaign.channel,
      type: normalizedType,
      touched_at: dt,
      metadata: isObjectRecord(metadata) ? metadata : null,
      status: normalizedStatus || 'active',
    });
    return res.status(201).json({ ok: true, touch: { id: String(touch._id) } });
  } catch (e) {
    console.error('[m06/createCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listCampaignTouchesByCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const campaignId = (req.query.campaignId as string) || null;
    console.debug('[m06/listCampaignTouchesByCampaign] query=', { projectId: req.query.projectId, workspaceId: req.query.workspaceId, campaignId: req.query.campaignId, rawQuery: req.query });
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!campaignId) return res.status(400).json({ error: 'campaignId_required' });
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const channelFilter = (req.query.channel as string) || '';
    const typeFilter = (req.query.type as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const statusFilter = (req.query.status as string) || '';
    const match: any = { project_id: projectId, campaign_id: campaignId };
    if (from || to) {
      match.touched_at = {};
      if (from) match.touched_at.$gte = new Date(from);
      if (to) match.touched_at.$lte = new Date(to);
    }
    if (channelFilter) match.channel = channelFilter;
    if (typeFilter) match.type = typeFilter;
    if (statusFilter) match.status = statusFilter; else if (!includeArchived) match.status = 'active';
    const rows = await CampaignTouch.find(match).sort({ touched_at: -1 }).limit(500).lean();
    console.debug('[m06/listCampaignTouchesByCampaign] found rows=', rows.length);
    return res.json({ ok: true, touches: rows.map(r => ({ id: String(r._id), lead_id: String(r.lead_id), campaign_id: String(r.campaign_id), channel: r.channel, type: r.type, touched_at: r.touched_at, status: r.status })) });
  } catch (e) {
    console.error('[m06/listCampaignTouchesByCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listCampaignTouchesByLead(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const leadId = (req.query.leadId as string) || null;
    console.debug('[m06/listCampaignTouchesByLead] query=', { projectId: req.query.projectId, leadId: req.query.leadId, rawQuery: req.query });
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!leadId) return res.status(400).json({ error: 'leadId_required' });
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const channelFilter = (req.query.channel as string) || '';
    const typeFilter = (req.query.type as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const statusFilter = (req.query.status as string) || '';
    const match: any = { project_id: projectId, lead_id: leadId };
    if (from || to) {
      match.touched_at = {};
      if (from) match.touched_at.$gte = new Date(from);
      if (to) match.touched_at.$lte = new Date(to);
    }
    if (channelFilter) match.channel = channelFilter;
    if (typeFilter) match.type = typeFilter;
    if (statusFilter) match.status = statusFilter; else if (!includeArchived) match.status = 'active';
    const rows = await CampaignTouch.find(match).sort({ touched_at: -1 }).limit(500).lean();
    console.debug('[m06/listCampaignTouchesByLead] found rows=', rows.length);
    return res.json({ ok: true, touches: rows.map(r => ({ id: String(r._id), lead_id: String(r.lead_id), campaign_id: String(r.campaign_id), channel: r.channel, type: r.type, touched_at: r.touched_at, status: r.status })) });
  } catch (e) {
    console.error('[m06/listCampaignTouchesByLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Debug endpoint: return count and sample of touches for project/campaign/lead
export async function listTouchesDebug(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const campaignId = (req.query.campaignId as string) || null;
    const leadId = (req.query.leadId as string) || null;
    console.debug('[m06/listTouchesDebug] query=', { projectId, campaignId, leadId });

    const match: any = { project_id: projectId };
    if (campaignId) match.campaign_id = campaignId;
    if (leadId) match.lead_id = leadId;

    const count = await CampaignTouch.countDocuments(match).exec();
    const sample = await CampaignTouch.find(match).sort({ touched_at: -1 }).limit(10).lean();
    return res.json({ ok: true, count, sample });
  } catch (e) {
    console.error('[m06/listTouchesDebug]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCampaignTouch(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).exec();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    const { channel, type, touched_at, metadata, status } = req.body || {};
    if (channel !== undefined) {
      const normalizedChannel = normalizeEnumValue(channel, TOUCH_CHANNELS);
      if (!normalizedChannel) return res.status(400).json({ error: 'invalid_channel', allowed: Array.from(TOUCH_CHANNELS) });
      touch.channel = normalizedChannel as any;
    }
    if (type !== undefined) {
      const normalizedType = normalizeEnumValue(type, TOUCH_TYPES);
      if (!normalizedType) return res.status(400).json({ error: 'invalid_type', allowed: Array.from(TOUCH_TYPES) });
      touch.type = normalizedType as any;
    }
    if (touched_at) {
      const dt = new Date(touched_at);
      if (isNaN(dt.getTime())) return res.status(400).json({ error: 'invalid_datetime' });
      touch.touched_at = dt;
    }
    if (metadata !== undefined) touch.metadata = isObjectRecord(metadata) ? metadata : null;
    if (status !== undefined) {
      const normalizedStatus = normalizeEnumValue(status, TOUCH_STATUSES);
      if (!normalizedStatus) return res.status(400).json({ error: 'invalid_status', allowed: Array.from(TOUCH_STATUSES) });
      touch.status = normalizedStatus as any;
    }
    await touch.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveCampaignTouch(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).exec();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    touch.status = 'archived';
    await touch.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteCampaignTouchPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).lean();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    if (touch.status !== 'archived') return res.status(400).json({ error: 'not_archived', message: 'Touch must be archived before permanent deletion.' });
    await CampaignTouch.deleteOne({ _id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteCampaignTouchPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importCampaignTouches(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy, allowPartial, leadIdentifier } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const validation = await validateCampaignTouchesCSV({ projectId, csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy, leadIdentifier });
    if (validation.summary.invalidRows > 0 && !allowPartial) {
      return res.status(400).json({ error: 'invalid_rows_present', validation });
    }
    const summary = await importCampaignTouchesCSV({ projectId, csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy, leadIdentifier });
    return res.json({ ok: true, ...summary });
  } catch (e) {
    console.error('[m06/importCampaignTouches]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function validateCampaignTouchesImport(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy, leadIdentifier } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const validation = await validateCampaignTouchesCSV({ projectId, csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy, leadIdentifier });
    return res.json(validation);
  } catch (e) {
    console.error('[m06/validateCampaignTouchesImport]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
export async function listCampaigns(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });

    // Filters: search(name/id), channel, status, includeArchived, date ranges
    const search = (req.query.search as string) || '';
    const channel = (req.query.channel as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const status = (req.query.status as string) || '';
    const createdFrom = (req.query.createdFrom as string) || '';
    const createdTo = (req.query.createdTo as string) || '';
    const startFrom = (req.query.startFrom as string) || '';
    const startTo = (req.query.startTo as string) || '';

    const match: any = { project_id: projectId };
    if (search) {
      const regex = new RegExp(search, 'i');
      match.$or = [{ name: regex }, { campaign_id: regex }];
    }
    if (channel) match.channel = channel;
    if (status) match.status = status;
    else if (!includeArchived) match.status = 'active';
    // created date range
    if (createdFrom || createdTo) {
      match.createdAt = {};
      if (createdFrom) match.createdAt.$gte = new Date(createdFrom);
      if (createdTo) match.createdAt.$lte = new Date(createdTo);
    }
    // start date range
    if (startFrom || startTo) {
      match.start_date = {};
      if (startFrom) match.start_date.$gte = new Date(startFrom);
      if (startTo) match.start_date.$lte = new Date(startTo);
    }

    const camps = await Campaign.find(match).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, campaigns: camps.map((c:any)=> ({ id: String(c._id), campaign_id: c.campaign_id, name: c.name, channel: c.channel, start_date: c.start_date, end_date: c.end_date, spend: c.spend || 0, status: c.status || 'active', created_at: c.createdAt, description: c.description || null, tags: c.tags || [] })) });
  } catch (e) {
    console.error('[m06/listCampaigns]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function createCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const validation = validateCampaignValueFields(req.body || {});
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    const payload = validation.payload;
    if (!payload.campaign_id) return res.status(400).json({ error: 'campaign_id_required' });
    const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(projectId, 'campaign', payload.campaign_id);
    if (crossEntityConflicts.length > 0) {
      return res.status(409).json({ error: 'business_id_conflict', field: 'campaign_id', conflicts: crossEntityConflicts });
    }
    const dup = await Campaign.findOne({ project_id: projectId, campaign_id: payload.campaign_id }).select('_id').lean();
    if (dup) return res.status(409).json({ error: 'duplicate_campaign_id' });
    const campaign = await Campaign.create({
      campaign_id: payload.campaign_id,
      project_id: projectId,
      channel: payload.channel,
      name: payload.name,
      description: payload.description,
      tags: payload.tags,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: (payload.status || 'active') as any,
      spend: payload.spend,
    });
    return res.status(201).json({ ok: true, campaign: { id: String(campaign._id), name: campaign.name } });
  } catch (e) {
    console.error('[m06/createCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const { campaign_id, campaignId } = req.body || {};
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    const nextCampaignId = requireStringId(campaign_id ?? campaignId);
    if (nextCampaignId && nextCampaignId !== camp.campaign_id) {
      const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(String(camp.project_id), 'campaign', nextCampaignId);
      if (crossEntityConflicts.length > 0) {
        return res.status(409).json({ error: 'business_id_conflict', field: 'campaign_id', conflicts: crossEntityConflicts });
      }
      const dup = await Campaign.findOne({ project_id: camp.project_id, campaign_id: nextCampaignId, _id: { $ne: camp._id } }).select('_id').lean();
      if (dup) return res.status(409).json({ error: 'duplicate_campaign_id' });
      camp.campaign_id = nextCampaignId;
    }
    const validation = validateCampaignValueFields({ ...camp.toObject(), ...req.body, campaign_id: nextCampaignId || camp.campaign_id });
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    Object.assign(camp, validation.payload);
    await camp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    camp.status = 'archived' as any;
    await camp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function addSpendEntry(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const { date, amount, source, note } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    if (!date || amount === undefined) return res.status(400).json({ error: 'date_amount_required' });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    const projectKey = camp.project_id;
    const ds = new Date(date);
    const spend = await CampaignSpend.create({ campaign_id: String(camp.campaign_id), project_id: projectKey, date: ds, amount: Number(amount) || 0, source: source || 'manual', note: note || null });
    // update total spend on campaign
    camp.spend = (Number(camp.spend) || 0) + Number(amount || 0);
    await camp.save();
    return res.status(201).json({ ok: true, spend: { id: String(spend._id), date: spend.date, amount: spend.amount } });
  } catch (e) {
    console.error('[m06/addSpendEntry]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Accept CSV text in body.csv. Simple parser: first row header
export async function uploadSpendCSV(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const { csv, dateColumn, amountColumn, startRow } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());
    const dcol = dateColumn ? header.indexOf(dateColumn) : 0;
    const acol = amountColumn ? header.indexOf(amountColumn) : 1;
    if (dcol < 0 || acol < 0) return res.status(400).json({ error: 'columns_not_found', header });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    let inserted = 0;
    const srow = startRow ? Number(startRow) : 1;
    for (let i = srow; i < lines.length; i++) {
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const d = cols[dcol];
      const a = parseFloat((cols[acol] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const date = new Date(String(d));
      if (isNaN(date.getTime())) continue;
      await CampaignSpend.create({ campaign_id: String(camp.campaign_id), project_id: camp.project_id, date, amount: a, source: 'csv' });
      camp.spend = (Number(camp.spend) || 0) + a;
      inserted++;
    }
    await camp.save();
    return res.json({ ok: true, inserted });
  } catch (e) {
    console.error('[m06/uploadSpendCSV]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Accept CSV text for multiple campaigns in a project. Body: { csv, campaignColumn?, dateColumn?, amountColumn?, startRow?, projectId? }
export async function uploadSpendCSVMulti(req: Request, res: Response) {
  try {
    const { csv, campaignColumn, dateColumn, amountColumn, startRow } = req.body || {};
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());

    // determine columns
    const ccol = typeof campaignColumn === 'string' && campaignColumn ? header.indexOf(campaignColumn) : header.findIndex(h => /campaign|campaign_id|campaign name|campaignname/i.test(h));
    const dcol = typeof dateColumn === 'string' && dateColumn ? header.indexOf(dateColumn) : header.findIndex(h => /date|day|dt/i.test(h));
    const acol = typeof amountColumn === 'string' && amountColumn ? header.indexOf(amountColumn) : header.findIndex(h => /amount|cost|spend|value|price/i.test(h));
    const campaignCol = ccol >= 0 ? ccol : 0;
    const dateCol = dcol >= 0 ? dcol : 1;
    const amountCol = acol >= 0 ? acol : 2;

    let inserted = 0;
    const srow = startRow ? Number(startRow) : 1;

    // cache campaigns found/created by identifier string
    const campaignMap: Record<string, any> = {};

    for (let i = srow; i < lines.length; i++) {
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const campVal = (cols[campaignCol] || '').trim();
      const d = cols[dateCol];
      const aRaw = cols[amountCol] || '0';
      const a = parseFloat(aRaw.replace(/[^0-9.-]/g, '')) || 0;
      if (!d) continue;
      const date = new Date(d);
      if (isNaN(date.getTime())) continue;

      const key = campVal || '__unknown__';
      let campDoc = campaignMap[key];
      if (!campDoc) {
        // try to find existing campaign by campaign_id or name within this project
        const found = await Campaign.findOne({ project_id: projectId, $or: [{ campaign_id: key }, { name: key }] }).exec();
        if (found) campDoc = found;
        else {
          campDoc = await Campaign.create({ campaign_id: `camp-${Date.now()}-${Math.floor(Math.random()*1000)}`, project_id: projectId, channel: 'other', name: key || `Imported ${Date.now()}`, description: null, tags: [], spend: 0 });
        }
        campaignMap[key] = campDoc;
      }

      await CampaignSpend.create({ campaign_id: String(campDoc.campaign_id), project_id: projectId, date, amount: a, source: 'csv' });
      campDoc.spend = (Number(campDoc.spend) || 0) + a;
      inserted++;
    }

    // persist campaign spend totals
    for (const k of Object.keys(campaignMap)) {
      try { await campaignMap[k].save(); } catch (e) { /* ignore per-campaign save errors */ }
    }

    return res.json({ ok: true, inserted, campaigns: Object.keys(campaignMap).length });
  } catch (e) {
    console.error('[m06/uploadSpendCSVMulti]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listSpendEntries(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const rows = await CampaignSpend.find({ campaign_id: id }).sort({ date: -1 }).lean();
    return res.json({ ok: true, rows: rows.map((r:any)=> ({ id: String(r._id), date: r.date, amount: r.amount, source: r.source, note: r.note })) });
  } catch (e) {
    console.error('[m06/listSpendEntries]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    await Campaign.deleteOne({ _id: id }).exec();
    // Optionally remove touches and attribution results referencing this campaign
    await CampaignTouch.deleteMany({ campaign_id: id }).exec();
    await AttributionResult.deleteMany({ campaign_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Permanent delete with role checks; may block if dependencies exist
export async function deleteCampaignPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });

    // Optional safeguard: block deletion if attribution results exist
    const deps = await AttributionResult.findOne({ campaign_id: new mongoose.Types.ObjectId(id) }).lean();
    if (deps) return res.status(400).json({ error: 'has_history', message: 'Campaign has attribution history; archive instead.' });

    await Campaign.deleteOne({ _id: id }).exec();
    await CampaignTouch.deleteMany({ campaign_id: id }).exec();
    await CampaignSpend.deleteMany({ campaign_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteCampaignPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Module 6 leads management
export async function listModule6Leads(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const search = (req.query.search as string | undefined)?.trim();
    const includeArchived = req.query.includeArchived === 'true';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const match: Record<string, any> = { project_id: projectId };
    if (!includeArchived) match.is_archived = { $ne: true };
    if (search) {
      const regex = new RegExp(sanitizeRegex(search), 'i');
      match.$or = [
        { lead_id: regex },
        { full_name: regex },
        { first_name: regex },
        { last_name: regex },
        { company: regex },
        { email: regex },
        { source: regex },
        { owner: regex },
        { industry: regex },
        { region: regex },
        { job_title: regex },
        { segment: regex },
      ];
    }
    const leads = await Module6Lead.find(match).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ ok: true, leads: leads.map(serializeModule6Lead) });
  } catch (e) {
    console.error('[m06/listModule6Leads]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function createModule6Lead(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const validation = validateLeadValueFields(req.body || {});
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    const leadId = validation.leadId;
    if (!leadId) return res.status(400).json({ error: 'lead_id_required' });
    const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(projectId, 'lead', leadId);
    if (crossEntityConflicts.length > 0) {
      return res.status(409).json({ error: 'business_id_conflict', field: 'lead_id', conflicts: crossEntityConflicts });
    }

    const exists = await Module6Lead.findOne({ project_id: projectId, lead_id: leadId }).select('_id').lean();
    if (exists) return res.status(409).json({ error: 'duplicate_lead_id' });

    const doc = await Module6Lead.create({ project_id: projectId, row_number: validation.rowNumber, lead_id: leadId, ...validation.payload });
    await syncModule6LeadToFunnelLead(projectId, doc);
    return res.status(201).json({ ok: true, lead: serializeModule6Lead(doc) });
  } catch (e) {
    console.error('[m06/createModule6Lead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateModule6Lead(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const id = req.params.id;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

    const doc = await Module6Lead.findOne({ _id: id, project_id: projectId }).exec();
    if (!doc) return res.status(404).json({ error: 'not_found' });

    const nextLeadId = sanitizeStringValue(req.body?.lead_id ?? req.body?.leadId);
    if (nextLeadId && nextLeadId !== doc.lead_id) {
      const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(projectId, 'lead', nextLeadId);
      if (crossEntityConflicts.length > 0) {
        return res.status(409).json({ error: 'business_id_conflict', field: 'lead_id', conflicts: crossEntityConflicts });
      }
      const dup = await Module6Lead.findOne({ project_id: projectId, lead_id: nextLeadId, _id: { $ne: doc._id } }).select('_id').lean();
      if (dup) return res.status(409).json({ error: 'duplicate_lead_id' });
      doc.lead_id = nextLeadId;
    }

    const validation = validateLeadValueFields({ ...req.body, lead_id: nextLeadId || doc.lead_id });
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    if (req.body?.row_number !== undefined) {
      doc.row_number = validation.rowNumber;
    }
    Object.assign(doc, validation.payload);
    await doc.save();
    await syncModule6LeadToFunnelLead(projectId, doc);
    return res.json({ ok: true, lead: serializeModule6Lead(doc) });
  } catch (e) {
    console.error('[m06/updateModule6Lead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveModule6Lead(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const id = req.params.id;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const doc = await Module6Lead.findOne({ _id: id, project_id: projectId }).exec();
    if (!doc) return res.status(404).json({ error: 'not_found' });
    doc.is_archived = true;
    await doc.save();
    await syncModule6LeadToFunnelLead(projectId, doc);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveModule6Lead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function validateModule6LeadsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });

    const validation = await validateModule6LeadCsvImport({
      projectId,
      csv,
      map: map && typeof map === 'object' ? map : undefined,
      startRow,
      endRow,
    });

    if (!validation.ok || !('summary' in validation) || !validation.summary || !validation.selectedRange || !validation.validRows || !validation.invalidRows) {
      return res.status(400).json(validation);
    }

    return res.json({
      ok: true,
      header: validation.header,
      mapping: validation.mapping,
      selectedRange: validation.selectedRange,
      summary: validation.summary,
      rowResults: validation.rowResults,
    });
  } catch (e: any) {
    console.error('[m06/validateModule6LeadsCSV]', e);
    if (e instanceof Error && e.message === 'csv_no_rows') {
      return res.status(400).json({ error: 'csv_no_rows' });
    }
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importModule6LeadsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, allowPartial } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const validation = await validateModule6LeadCsvImport({
      projectId,
      csv,
      map: map && typeof map === 'object' ? map : undefined,
      startRow,
      endRow,
    });

    if (!validation.ok || !validation.summary || !validation.selectedRange || !validation.validRows || !validation.invalidRows) {
      return res.status(400).json(validation);
    }
    const importValidation = validation as typeof validation & {
      summary: NonNullable<typeof validation.summary>;
      selectedRange: NonNullable<typeof validation.selectedRange>;
      validRows: NonNullable<typeof validation.validRows>;
      invalidRows: NonNullable<typeof validation.invalidRows>;
    };
    if (importValidation.summary.invalidRows > 0 && !allowPartial) {
      return res.status(400).json({ error: 'invalid_rows_present', validation: {
        header: importValidation.header,
        mapping: importValidation.mapping,
        selectedRange: importValidation.selectedRange,
        summary: importValidation.summary,
        rowResults: importValidation.rowResults,
      } });
    }

    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let failed = importValidation.summary.invalidRows;
    let duplicates = 0;
    const failedRows: Array<{ row: number; error: string }> = importValidation.invalidRows.map((row) => ({
      row: row.rowNumber,
      error: row.errors.map((error) => error.message).join('; '),
    }));

    for (const row of importValidation.validRows) {
      processed++;
      const leadIdentifier = row.mapped.lead_id;
      const { lead_id: _leadId, ...payload } = row.mapped as Record<string, any>;

      try {
        const existing = await Module6Lead.findOne({ project_id: projectId, lead_id: leadIdentifier }).exec();
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          await syncModule6LeadToFunnelLead(projectId, existing);
          updated++;
          duplicates++;
          continue;
        }
        const doc = await Module6Lead.create({
          project_id: projectId,
          lead_id: leadIdentifier,
          ...payload,
        });
        await syncModule6LeadToFunnelLead(projectId, doc);
        inserted++;
      } catch (err: any) {
        failed++;
        failedRows.push({ row: row.rowNumber, error: err.code === 11000 ? 'duplicate_lead_id' : (err.message || 'insert_failed') });
      }
    }

    return res.json({
      ok: true,
      processed,
      inserted,
      updated,
      failed,
      duplicates,
      failedRows,
      selected: importValidation.selectedRange.selectedRows,
      skipped: importValidation.summary.invalidRows,
      warnings: importValidation.summary.warningRows,
    });
  } catch (e) {
    console.error('[m06/importModule6LeadsCSV]', e);
    if (e instanceof Error && e.message === 'csv_no_rows') {
      return res.status(400).json({ error: 'csv_no_rows' });
    }
    return res.status(500).json({ error: 'internal' });
  }
}

export async function searchModule6Leads(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.json({ leads: [] });
    const query = (req.query.q as string | undefined)?.trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)));
    const match: Record<string, any> = { project_id: projectId };
    match.is_archived = { $ne: true };
    if (query) {
      if (/^\d+$/.test(query)) {
        match.lead_id = query;
      } else {
        const regex = new RegExp(sanitizeRegex(query), 'i');
        match.$or = [
          { lead_id: regex },
          { full_name: regex },
          { first_name: regex },
          { last_name: regex },
          { company: regex },
          { email: regex },
        ];
      }
    }
    const leads = await Module6Lead.find(match).sort({ createdAt: -1 }).limit(limit).lean();
    if (leads.length > 0 || query) {
      return res.json({ leads: leads.map(l => ({
        _id: String(l._id),
        lead_id: l.lead_id,
        full_name: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || null,
        company: l.company || null,
        email: l.email || null,
      })) });
    }

    // fallback to legacy leads if no query or no module6 leads exist yet
    const legacyQuery = (query || '').trim();
    if (!legacyQuery) return res.json({ leads: [] });
    const sanitized = new RegExp(sanitizeRegex(legacyQuery), 'i');
    const legacyLeads = await Lead.find({
      $or: [
        { First_Name: sanitized },
        { Last_Name: sanitized },
        { Company: sanitized },
        { Email: sanitized },
      ]
    }).limit(limit).select('lead_id First_Name Last_Name Email').lean();
    return res.json({ leads: legacyLeads.map(l => ({
      _id: String(l._id),
      lead_id: String(l.lead_id ?? ''),
      name: `${l.First_Name || ''} ${l.Last_Name || ''}`.trim() || null,
      email: (l as any).Email || null,
    })) });
  } catch (e) {
    console.error('[m06/searchModule6Leads]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Bulk CSV import for campaigns: maps headers and creates campaigns
export async function validateCampaignsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const validation = await validateCampaignsCsvImport({
      projectId,
      csv,
      map: map && typeof map === 'object' ? map : undefined,
      startRow,
      endRow,
    });
    if (!validation.ok) return res.status(400).json(validation);
    return res.json({
      ok: true,
      header: validation.header,
      mapping: validation.mapping,
      selectedRange: validation.selectedRange,
      summary: validation.summary,
      rowResults: validation.rowResults,
    });
  } catch (e) {
    console.error('[m06/validateCampaignsCSV]', e);
    if (e instanceof Error && e.message === 'csv_no_rows') {
      return res.status(400).json({ error: 'csv_no_rows' });
    }
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importCampaignsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, allowPartial } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const validation = await validateCampaignsCsvImport({
      projectId,
      csv,
      map: map && typeof map === 'object' ? map : undefined,
      startRow,
      endRow,
    });
    if (!validation.ok || !validation.summary || !validation.selectedRange || !validation.validRows || !validation.invalidRows) {
      return res.status(400).json(validation);
    }
    const importValidation = validation as typeof validation & {
      summary: NonNullable<typeof validation.summary>;
      selectedRange: NonNullable<typeof validation.selectedRange>;
      validRows: NonNullable<typeof validation.validRows>;
      invalidRows: NonNullable<typeof validation.invalidRows>;
    };
    if (importValidation.summary.invalidRows > 0 && !allowPartial) {
      return res.status(400).json({ error: 'invalid_rows_present', validation: {
        header: importValidation.header,
        mapping: importValidation.mapping,
        selectedRange: importValidation.selectedRange,
        summary: importValidation.summary,
        rowResults: importValidation.rowResults,
      } });
    }

    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = importValidation.summary.invalidRows;
    const errors: Array<{ row: number, reason: string }> = importValidation.invalidRows.map((row) => ({
      row: row.rowNumber,
      reason: row.errors.map((error) => error.message).join('; '),
    }));

    for (const row of importValidation.validRows) {
      processed++;
      try {
        const existing = await Campaign.findOne({ project_id: projectId, campaign_id: row.mapped.campaign_id }).exec();
        if (existing) {
          Object.assign(existing, row.mapped);
          await existing.save();
          updated++;
          continue;
        }
        await Campaign.create({
          ...row.mapped,
          project_id: projectId,
        });
        created++;
      } catch (err: any) {
        failed++;
        errors.push({ row: row.rowNumber, reason: err.code === 11000 ? 'duplicate_campaign_id' : (err.message || 'insert_failed') });
      }
    }

    return res.json({
      ok: true,
      processed,
      created,
      updated,
      skipped: importValidation.summary.invalidRows,
      failed,
      warnings: importValidation.summary.warningRows,
      errors,
      selected: importValidation.selectedRange.selectedRows,
    });
  } catch (e) {
    console.error('[m06/importCampaignsCSV]', e);
    if (e instanceof Error && e.message === 'csv_no_rows') {
      return res.status(400).json({ error: 'csv_no_rows' });
    }
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    await Deal.deleteOne({ _id: id }).exec();
    await AttributionResult.deleteMany({ deal_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// --- Deals management (Screen 3) ---
export async function createDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const validation = validateDealValueFields(req.body || {});
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    const payload = validation.payload;
    if (!payload.deal_id) return res.status(400).json({ error: 'deal_id_required' });
    if (!payload.lead_id) return res.status(400).json({ error: 'lead_id_required' });
    const lead = await Module6Lead.findOne({ project_id: projectId, lead_id: payload.lead_id }).select('_id').lean();
    if (!lead) return res.status(400).json({ error: 'lead_not_found' });
    const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(projectId, 'deal', payload.deal_id);
    if (crossEntityConflicts.length > 0) {
      return res.status(409).json({ error: 'business_id_conflict', field: 'deal_id', conflicts: crossEntityConflicts });
    }
    const dup = await Deal.findOne({ project_id: projectId, deal_id: payload.deal_id }).lean();
    if (dup) return res.status(409).json({ error: 'duplicate_deal_id' });

    const doc = await Deal.create({
      deal_id: payload.deal_id,
      lead_id: payload.lead_id,
      project_id: projectId,
      revenue: payload.revenue,
      currency: payload.currency,
      closed_won: payload.closed_won,
      closed_at: payload.closed_at,
    });
    return res.status(201).json({ ok: true, deal: { id: String(doc._id) } });
  } catch (e) {
    console.error('[m06/createDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listDeals(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const match: any = { project_id: projectId };
    const leadId = (req.query.leadId as string) || '';
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const status = (req.query.status as string) || '';
    const minAmount = req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined;
    const maxAmount = req.query.maxAmount !== undefined ? Number(req.query.maxAmount) : undefined;
    const includeArchived = req.query.includeArchived === 'true';
    if (leadId) match.lead_id = leadId;
    if (from || to) {
      match.closed_at = {};
      if (from) match.closed_at.$gte = new Date(from);
      if (to) match.closed_at.$lte = new Date(to);
    }
    if (status) {
      // interpret common strings; otherwise pass-through
      if (status === 'closed_won') match.closed_won = true;
      else if (status === 'open') match.closed_won = false;
    }
    if (minAmount !== undefined) match.revenue = { ...(match.revenue || {}), $gte: minAmount };
    if (maxAmount !== undefined) match.revenue = { ...(match.revenue || {}), $lte: maxAmount };
    void includeArchived;
    const rows = await Deal.find(match).sort({ closed_at: -1, createdAt: -1 }).limit(500).lean();
    return res.json(rows.map(r => ({
      _id: String(r._id),
      deal_id: r.deal_id,
      project_id: String(r.project_id),
      lead_id: String(r.lead_id),
      // revenue stored as Decimal128 — return string to avoid precision loss in JSON
      revenue: Number(r.revenue) || 0,
      currency: (r as any).currency || null,
      closed_won: r.closed_won,
      closed_at: r.closed_at,
      
    })));
  } catch (e) {
    console.error('[m06/listDeals]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const d = await Deal.findById(id).exec();
    if (!d) return res.status(404).json({ error: 'not_found' });
    const { deal_id, lead_id } = req.body || {};
    if (deal_id !== undefined) {
      const nextDealId = requireStringId(deal_id);
      if (!nextDealId) return res.status(400).json({ error: 'deal_id_required' });
      if (nextDealId !== d.deal_id) {
        const crossEntityConflicts = await findCrossEntityBusinessIdConflicts(String(d.project_id), 'deal', nextDealId);
        if (crossEntityConflicts.length > 0) {
          return res.status(409).json({ error: 'business_id_conflict', field: 'deal_id', conflicts: crossEntityConflicts });
        }
        const dup = await Deal.findOne({ project_id: d.project_id, deal_id: nextDealId, _id: { $ne: d._id } }).select('_id').lean();
        if (dup) return res.status(409).json({ error: 'duplicate_deal_id' });
      }
      d.deal_id = nextDealId;
    }
    if (lead_id !== undefined) {
      const leadKey = requireStringId(lead_id);
      if (!leadKey) return res.status(400).json({ error: 'lead_id_required' });
      const lead = await Module6Lead.findOne({ project_id: String(d.project_id), lead_id: leadKey }).select('_id').lean();
      if (!lead) return res.status(400).json({ error: 'lead_not_found' });
      d.lead_id = leadKey;
    }
    const validation = validateDealValueFields({ ...d.toObject(), ...req.body });
    if (validation.errors.length > 0) return res.status(400).json({ error: 'validation_failed', fieldErrors: validation.errors });
    Object.assign(d, validation.payload);

    await d.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const d = await Deal.findById(id).exec();
    if (!d) return res.status(404).json({ error: 'not_found' });
    d.closed_won = false;
    await d.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteDealPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    // Enforce role-based permission similar to campaign deletion
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    const d = await Deal.findById(id).lean();
    if (!d) return res.status(404).json({ error: 'not_found' });
    await Deal.deleteOne({ _id: id }).exec();
    await AttributionResult.deleteMany({ deal_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteDealPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importDealsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, duplicatePolicy, allowPartial } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const validation = await validateDealsCsvImport({ projectId, csv, map, startRow, endRow, duplicatePolicy });
    if (!validation.ok || !validation.summary || !validation.selectedRange || !validation.validRows || !validation.invalidRows) {
      return res.status(400).json(validation);
    }
    const importValidation = validation as typeof validation & {
      summary: NonNullable<typeof validation.summary>;
      selectedRange: NonNullable<typeof validation.selectedRange>;
      validRows: NonNullable<typeof validation.validRows>;
      invalidRows: NonNullable<typeof validation.invalidRows>;
    };
    if (importValidation.summary.invalidRows > 0 && !allowPartial) {
      return res.status(400).json({ error: 'invalid_rows_present', validation: importValidation });
    }

    let processed = 0;
    let inserted = 0;
    let failed = importValidation.summary.invalidRows;
    let duplicates = 0;
    const failedRows: Array<{ row: number; error: string }> = importValidation.invalidRows.map((row) => ({
      row: row.rowNumber,
      error: row.errors.map((error) => error.message).join('; '),
    }));

    for (const row of importValidation.validRows) {
      processed++;
      const payload = row.mapped as ReturnType<typeof buildDealPayload>;
      const dup = await Deal.findOne({ project_id: projectId, deal_id: payload.deal_id }).lean();
      if (dup) {
        duplicates++;
        if (duplicatePolicy === 'skip') continue;
      }
      try {
        await Deal.create({
          deal_id: payload.deal_id,
          lead_id: payload.lead_id,
          project_id: projectId,
          revenue: payload.revenue,
          currency: payload.currency,
          closed_won: payload.closed_won,
          closed_at: payload.closed_at,
        } as any);
        inserted++;
      } catch (ie:any) {
        failed++;
        failedRows.push({ row: row.rowNumber, error: ie.message || 'insert_failed' });
      }
    }

    return res.json({
      ok: true,
      processed,
      inserted,
      failed,
      duplicates,
      failedRows,
      selected: importValidation.selectedRange.selectedRows,
      skipped: importValidation.summary.invalidRows,
      warnings: importValidation.summary.warningRows,
    });
  } catch (e) {
    console.error('[m06/importDealsCSV]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function validateDealsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, duplicatePolicy } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const validation = await validateDealsCsvImport({ projectId, csv, map, startRow, endRow, duplicatePolicy });
    if (!validation.ok) return res.status(400).json(validation);
    return res.json(validation);
  } catch (e) {
    console.error('[m06/validateDealsCSV]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function runAttribution(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });

    const toArray = (input: unknown): string[] => {
      if (Array.isArray(input)) return input.map(val => String(val));
      if (typeof input === 'string') {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    const modelType = (req.body && req.body.model_type) || req.body?.modelType || (req.query.modelType as string) || 'linear';
    const dateFromRaw = req.body?.date_from || req.query.date_from;
    const dateToRaw = req.body?.date_to || req.query.date_to;
    const closedWonOnly = req.body?.closedWonOnly === true || req.query.closedWonOnly === 'true';
    const minAmount = req.body?.minAmount !== undefined ? Number(req.body.minAmount) : (req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined);
    const includeArchived = req.body?.includeArchived === true || req.query.includeArchived === 'true';

    const channelInput = req.body?.requiredChannels
      ?? req.body?.channels
      ?? req.query.channels
      ?? req.query.channel;
    const requiredChannelSet = new Set(
      toArray(channelInput)
        .map(ch => ch.toLowerCase())
        .filter(ch => CHANNEL_SET.has(ch as any))
    );

    const campaignInput = req.body?.requiredCampaignIds
      ?? req.body?.campaignIds
      ?? req.query.campaignIds
      ?? req.query.campaignId;
    const rawCampaignIds = new Set(
      toArray(campaignInput)
        .map(id => id.trim())
        .filter(Boolean)
    );

    if (!dateFromRaw || !dateToRaw) return res.status(400).json({ error: 'date_range_required' });
    const dateFrom = new Date(dateFromRaw);
    const dateTo = new Date(dateToRaw);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) return res.status(400).json({ error: 'invalid_dates' });
    if (dateFrom.getTime() > dateTo.getTime()) return res.status(400).json({ error: 'start_after_end' });

    const existingRunning = await AttributionRun.findOne({ project_id: projectId, status: 'running' }).lean();
    if (existingRunning) return res.status(409).json({ error: 'run_in_progress' });

    const allowedModels = ['first_touch', 'last_touch', 'linear'];
    const model = allowedModels.includes(modelType) ? modelType : 'linear';

    const dealMatch: any = { project_id: projectId, closed_at: { $gte: dateFrom, $lte: dateTo } };
    if (closedWonOnly) dealMatch.closed_won = true;
    if (minAmount !== undefined && !Number.isNaN(minAmount)) dealMatch.revenue = { $gte: minAmount };

    const deals = await Deal.find(dealMatch).lean();
    if (!deals || deals.length === 0) return res.status(400).json({ error: 'no_deals_in_window' });

    const campaigns = await Campaign.find({ project_id: projectId }).lean();
    const campaignMap: Record<string, any> = {};
    const projectCampaignIds = new Set<string>();
    for (const campaign of campaigns) {
      const id = String(campaign.campaign_id);
      campaignMap[id] = campaign;
      projectCampaignIds.add(id);
    }

    const requiredCampaignIds = Array.from(rawCampaignIds).filter(id => projectCampaignIds.has(id));
    const requiredCampaignSet = new Set(requiredCampaignIds);
    const filtersApplied = requiredChannelSet.size > 0 || requiredCampaignSet.size > 0;

    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));
    const touches = await CampaignTouch.find({
      lead_id: { $in: leadIds },
      campaign_id: { $in: Array.from(projectCampaignIds) }
    }).sort({ touched_at: 1 }).lean();
    const touchesByLead: Record<string, Array<any>> = {};
    for (const touch of touches) {
      const lid = String(touch.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push(touch);
    }

    const runObjectId = new mongoose.Types.ObjectId();
    let totalRevenue = 0;
    let totalAttributed = 0;
    let dealsWithJourneys = 0;
    let dealsWithoutJourneys = 0;
    let dealsIncluded = 0;
    let excludedByChannel = 0;
    let excludedByCampaign = 0;
    let excludedNoTouches = 0;
    const results: any[] = [];

    const getTouchChannel = (touch: any): string => {
      const fromTouch = typeof touch.channel === 'string' ? touch.channel.toLowerCase() : '';
      if (fromTouch && CHANNEL_SET.has(fromTouch)) return fromTouch;
      const campaignId = String(touch.campaign_id);
      const campaignChannel = (campaignMap[campaignId]?.channel || '').toLowerCase();
      return CHANNEL_SET.has(campaignChannel) ? campaignChannel : 'other';
    };

    for (const deal of deals) {
      const revenue = Number(deal.revenue) || 0;
      const leadId = String(deal.lead_id);
      const allTouches = (touchesByLead[leadId] || []).filter(t => {
        if (!deal.closed_at) return true;
        return new Date(t.touched_at).getTime() <= new Date(deal.closed_at as any).getTime();
      });

      if (!allTouches.length) {
        if (filtersApplied) {
          excludedNoTouches++;
          continue;
        }
        totalRevenue += revenue;
        dealsWithoutJourneys++;
        continue;
      }

      const hasRequiredChannel = requiredChannelSet.size === 0
        || allTouches.some(touch => requiredChannelSet.has(getTouchChannel(touch)));
      if (!hasRequiredChannel) {
        if (filtersApplied) excludedByChannel++;
        continue;
      }

      const hasRequiredCampaign = requiredCampaignSet.size === 0
        || allTouches.some(touch => requiredCampaignSet.has(String(touch.campaign_id)));
      if (!hasRequiredCampaign) {
        if (filtersApplied) excludedByCampaign++;
        continue;
      }

      totalRevenue += revenue;
      dealsIncluded++;

      const sequence: string[] = [];
      for (const touch of allTouches) {
        const campaignId = String(touch.campaign_id);
        if (!projectCampaignIds.has(campaignId)) continue;
        if (sequence.length === 0 || sequence[sequence.length - 1] !== campaignId) {
          sequence.push(campaignId);
        }
      }

      if (!sequence.length) {
        dealsWithoutJourneys++;
        continue;
      }

      dealsWithJourneys++;

      if (model === 'first_touch') {
        const cid = sequence[0];
        results.push({ run_id: String(runObjectId), project_id: projectId, deal_id: deal.deal_id, campaign_id: cid, revenue_share: revenue });
        totalAttributed += revenue;
      } else if (model === 'last_touch') {
        const cid = sequence[sequence.length - 1];
        results.push({ run_id: String(runObjectId), project_id: projectId, deal_id: deal.deal_id, campaign_id: cid, revenue_share: revenue });
        totalAttributed += revenue;
      } else {
        const n = sequence.length;
        const perShare = n > 0 ? revenue / n : 0;
        let allocated = 0;
        for (let i = 0; i < sequence.length; i++) {
          const cid = sequence[i];
          const isLast = i === sequence.length - 1;
          const share = isLast ? Number((revenue - allocated).toFixed(2)) : Number(perShare.toFixed(2));
          allocated += share;
          results.push({ run_id: String(runObjectId), project_id: projectId, deal_id: deal.deal_id, campaign_id: cid, revenue_share: share });
          totalAttributed += share;
        }
      }
    }

    const dealCountForRun = dealsIncluded + dealsWithoutJourneys;

    if (filtersApplied && dealCountForRun === 0) {
      return res.status(400).json({
        error: 'no_deals_after_filters',
        details: {
          excludedByFilters: {
            channels: excludedByChannel,
            campaigns: excludedByCampaign,
            noTouches: excludedNoTouches
          }
        }
      });
    }

    const touchesUsed = results.length;
    const unattributed = totalRevenue - totalAttributed;
    const campaignCount = new Set(results.map(r => String(r.campaign_id))).size;

    const runDoc = await AttributionRun.create({
      _id: runObjectId,
      run_id: `run-${Date.now()}`,
      project_id: projectId,
      model_type: model as any,
      timestamp: new Date(),
      status: 'success',
      date_from: dateFrom,
      date_to: dateTo,
      deal_count: dealCountForRun,
      deals_with_journeys: dealsWithJourneys,
      deals_without_journeys: dealsWithoutJourneys,
      total_revenue: Number(totalRevenue.toFixed(2)),
      attributed_revenue: Number(totalAttributed.toFixed(2)),
      unattributed_revenue: Number(unattributed.toFixed(2)),
      campaign_count: campaignCount,
      meta: {
        initiatedBy: 'api',
        model,
        filters: {
          closedWonOnly,
          minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
          includeArchived,
          requiredChannels: Array.from(requiredChannelSet),
          requiredCampaignIds
        },
        excludedByFilters: filtersApplied ? {
          channels: excludedByChannel,
          campaigns: excludedByCampaign,
          noTouches: excludedNoTouches
        } : undefined,
        dealsProcessed: dealCountForRun,
        touches_used: touchesUsed
      }
    });

    if (touchesUsed > 0) {
      try {
        await AttributionResult.insertMany(results);
      } catch (insertErr) {
        console.error('[m06/runAttribution] insertMany error', insertErr);
      }
    }

    return res.json({
      ok: true,
      runId: String(runDoc._id),
      runName: runDoc.run_id,
      model,
      date_from: runDoc.date_from,
      date_to: runDoc.date_to,
      deal_count: runDoc.deal_count,
      deals_with_journeys: runDoc.deals_with_journeys,
      deals_without_journeys: runDoc.deals_without_journeys,
      total_revenue: runDoc.total_revenue,
      attributed_revenue: runDoc.attributed_revenue,
      unattributed_revenue: runDoc.unattributed_revenue,
      campaign_count: runDoc.campaign_count,
      touches_used: touchesUsed,
      filters: runDoc.meta?.filters || null,
      excluded_by_filters: (runDoc.meta as any)?.excludedByFilters || null
    });
  } catch (e) {
    console.error('[m06/runAttribution]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/runs
export async function listAttributionRuns(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const runs = await AttributionRun.find({ project_id: projectId })
      .sort({ timestamp: -1 })
      .select('run_id model_type status timestamp date_from date_to deal_count deals_with_journeys deals_without_journeys total_revenue attributed_revenue unattributed_revenue campaign_count meta')
      .lean();
    return res.json({ ok: true, runs });
  } catch (e) {
    console.error('[m06/listAttributionRuns]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/run/:id/summary
export async function getAttributionRunSummary(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.params.id;
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    const runOid = new mongoose.Types.ObjectId(runId);
    const run = await AttributionRun.findOne({ _id: runOid, project_id: projectId }).lean();
    if (!run) return res.status(404).json({ error: 'run_not_found' });

    // aggregate campaign revenue table for this run
    const campaignAgg = await AttributionResult.aggregate([
      { $match: { project_id: projectId, run_id: runId } },
      { $group: { _id: '$campaign_id', revenue: { $sum: '$revenue_share' }, deals: { $addToSet: '$deal_id' } } },
      { $project: { campaign_id: '$_id', revenue: 1, deal_count: { $size: '$deals' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    // touches used for this run
    const touchesUsedAgg = await AttributionResult.aggregate([
      { $match: { project_id: projectId, run_id: runId } },
      { $count: 'count' }
    ]);
    const touches_used = touchesUsedAgg.length ? touchesUsedAgg[0].count : 0;

    // build sample allocations: pick up to 10 deals from this run (top by total), with allocation items and deal enrichment
    const sampleDeals = await AttributionResult.aggregate([
      { $match: { project_id: projectId, run_id: runId } },
      { $group: { _id: '$deal_id', total: { $sum: '$revenue_share' }, items: { $push: { campaign_id: '$campaign_id', share: '$revenue_share' } } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    const sampleDealIds = sampleDeals.map((item: any) => String(item._id));
    const sampleDealDocs = await Deal.find({ project_id: projectId, deal_id: { $in: sampleDealIds } }).select('deal_id revenue lead_id closed_at').lean();
    const sampleDealMap: Record<string, any> = {};
    for (const deal of sampleDealDocs) sampleDealMap[String(deal.deal_id)] = deal;
    const sampleDealsOut = sampleDeals.map((item: any) => ({
      _id: item._id,
      total: item.total,
      items: item.items,
      deal_amount: sampleDealMap[String(item._id)]?.revenue ?? null,
      lead_id: sampleDealMap[String(item._id)]?.lead_id ?? null,
    }));

    // attempt unattributed example: find a deal in window with no result rows
    const windowDeals = await Deal.find({ project_id: projectId, closed_at: { $gte: run.date_from, $lte: run.date_to } }).select('deal_id revenue lead_id closed_at').lean();
    const resultDealIds = new Set((await AttributionResult.find({ project_id: projectId, run_id: runId }).select('deal_id').lean()).map(r => String(r.deal_id)));
    const unattributedExample = windowDeals.find(d => !resultDealIds.has(String(d.deal_id)));

    return res.json({
      ok: true,
      run: {
        id: String(run._id),
        run_id: run.run_id,
        model_type: run.model_type,
        status: run.status,
        timestamp: run.timestamp,
        date_from: run.date_from,
        date_to: run.date_to,
        deal_count: run.deal_count,
        deals_with_journeys: run.deals_with_journeys,
        deals_without_journeys: run.deals_without_journeys,
        total_revenue: run.total_revenue,
        attributed_revenue: run.attributed_revenue,
        unattributed_revenue: run.unattributed_revenue,
        campaign_count: run.campaign_count,
        campaigns_with_credit: campaignAgg.length,
        touches_used,
        filters: (run as any)?.meta?.filters || null,
        excluded_by_filters: (run as any)?.meta?.excludedByFilters || null
      },
      campaigns: campaignAgg,
      samples: sampleDealsOut,
      unattributed_sample: unattributedExample ? { deal_id: unattributedExample.deal_id, revenue: unattributedExample.revenue, closed_at: unattributedExample.closed_at } : null
    });
  } catch (e) {
    console.error('[m06/getAttributionRunSummary]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/roi-by-run?projectId=...&runId=...
export async function roiByRun(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId_required' });
    }
    if (!runId || !mongoose.isValidObjectId(runId)) {
      return res.status(400).json({ error: 'runId_required' });
    }
    const match: any = { project_id: projectId, run_id: runId };

    const agg = await AttributionResult.aggregate([
      { $match: match },
      { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } },
      { $sort: { attributed: -1 } },
    ]).exec();

    if (!agg.length) {
      return res.status(400).json({
        error: 'no_attribution_for_run',
        message: 'No attribution results found for this run. Try another run or rerun attribution.',
      });
    }

    const campaignIds = agg.map(r => String(r._id));
    const campaigns = await Campaign.find({
      project_id: projectId,
      campaign_id: { $in: campaignIds },
    })
      .lean()
      .exec();

    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) {
      campaignMap[String(c.campaign_id)] = c;
    }

    const rows: Array<{
      campaign_id: string;
      name: string | null;
      channel: string | null;
      spend: number;
      attributed: number;
      profit: number;
      roi: number | null;
    }> = [];

    let totalAttributed = 0;
    let totalSpend = 0;
    let totalDeals = 0;

    for (const r of agg) {
      const cid = String(r._id);
      const camp = campaignMap[cid] || null;
      const attributed = Number(r.attributed) || 0;
      const spend = camp ? Number((camp as any).spend || 0) : 0;
      const profit = attributed - spend;
      const roi = spend > 0 ? (profit / spend) * 100 : null;

      totalAttributed += attributed;
      totalSpend += spend;
      totalDeals += 1;

      rows.push({
        campaign_id: cid,
        name: camp?.name || null,
        channel: (camp as any)?.channel || 'other',
        spend,
        attributed,
        profit,
        roi,
      });
    }

    const netProfit = totalAttributed - totalSpend;
    const overallROI = totalSpend > 0 ? (netProfit / totalSpend) * 100 : null;

    const warnings: string[] = [];
    if (totalSpend === 0) {
      warnings.push('Total campaign spend is 0 — ROI is not meaningful.');
    }
    if (overallROI !== null && overallROI < 0) {
      warnings.push('Overall ROI is negative — campaigns are losing money in this run.');
    }
    if (rows.length < 3) {
      warnings.push('Fewer than 3 campaigns in this run — results may be noisy.');
    }

    return res.json({
      ok: true,
      runId: String(runId),
      totalAttributed,
      totalSpend,
      totalDeals,
      netProfit,
      overallROI,
      campaigns: rows,
      warnings,
    });
  } catch (e) {
    console.error('[m06/roiByRun]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function previewDeals(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });

    const toArray = (input: unknown): string[] => {
      if (Array.isArray(input)) return input.map(val => String(val));
      if (typeof input === 'string') {
        return input.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [];
    };

    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const statusParam = (req.query.status as string) || 'closed_won';
    const includeArchived = req.query.includeArchived === 'true';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));

    const channelInput = req.query.channels ?? req.query.channel;
    const requiredChannelSet = new Set(
      toArray(channelInput)
        .map(ch => ch.toLowerCase())
        .filter(ch => CHANNEL_SET.has(ch as any))
    );

    const match: any = { project_id: projectId };
    if (from || to) {
      match.closed_at = {};
      if (from) match.closed_at.$gte = new Date(from);
      if (to) match.closed_at.$lte = new Date(to);
    }
    if (statusParam === 'closed_won') match.closed_won = true;
    else if (statusParam === 'closed_lost' || statusParam === 'open') match.closed_won = false;

    const deals = await Deal.find(match).sort({ closed_at: -1, createdAt: -1 }).lean();
    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));

    const campaigns = await Campaign.find({ project_id: projectId }).lean();
    const campaignMap: Record<string, any> = {};
    const projectCampaignIds = new Set<string>();
    for (const campaign of campaigns) {
      const id = String(campaign.campaign_id);
      campaignMap[id] = campaign;
      projectCampaignIds.add(id);
    }

    const filtersApplied = requiredChannelSet.size > 0;

    const touches = await CampaignTouch.find({
      lead_id: { $in: leadIds },
      campaign_id: { $in: Array.from(projectCampaignIds) }
    }).sort({ touched_at: 1 }).lean();
    const touchesByLead: Record<string, any[]> = {};
    for (const touch of touches) {
      const lid = String(touch.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push(touch);
    }

    const getTouchChannel = (touch: any): string => {
      const fromTouch = typeof touch.channel === 'string' ? touch.channel.toLowerCase() : '';
      if (fromTouch && CHANNEL_SET.has(fromTouch)) return fromTouch;
      const campaignId = String(touch.campaign_id);
      const campaignChannel = (campaignMap[campaignId]?.channel || '').toLowerCase();
      return CHANNEL_SET.has(campaignChannel) ? campaignChannel : 'other';
    };

    const eligibleDeals: Array<{ deal: any; touches: any[] }> = [];
    let excludedByChannel = 0;
    let excludedNoTouches = 0;

    for (const deal of deals) {
      const leadId = String(deal.lead_id);
      const list = (touchesByLead[leadId] || []).filter(t => !deal.closed_at || new Date(t.touched_at).getTime() <= new Date(deal.closed_at as any).getTime());

      if (!list.length) {
        if (filtersApplied) {
          excludedNoTouches++;
          continue;
        }
        eligibleDeals.push({ deal, touches: [] });
        continue;
      }

      const hasChannel = requiredChannelSet.size === 0
        || list.some(touch => requiredChannelSet.has(getTouchChannel(touch)));
      if (!hasChannel) {
        if (filtersApplied) excludedByChannel++;
        continue;
      }

      eligibleDeals.push({ deal, touches: list });
    }

    const total = eligibleDeals.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = eligibleDeals.slice(start, end);

    const leadSummaryIds = Array.from(new Set(pageItems.map(item => String(item.deal.lead_id))));
    const leadSummaries = await loadLeadSummariesByObjectIds(leadSummaryIds);

    const rows = pageItems.map(({ deal, touches: list }) => {
      const touchCount = list.length;
      const firstTouchAt = touchCount ? list[0].touched_at : null;
      const lastTouchAt = touchCount ? list[touchCount - 1].touched_at : null;
      const leadInfo = leadSummaries[String(deal.lead_id)] || { name: null, email: null, company: null, lead_id: null };
      return {
        deal_id: String(deal._id),
        deal_external_id: deal.deal_id || null,
        lead_id: leadInfo.lead_id || String(deal.lead_id),
        lead_name: leadInfo.name,
        lead_email: leadInfo.email,
        revenue: deal.revenue,
        closed_at: deal.closed_at,
        status: deal.closed_won ? 'closed_won' : 'other',
        touchCount,
        firstTouchAt,
        lastTouchAt,
      };
    });

    return res.json({
      ok: true,
      page,
      limit,
      total,
      rows,
      excluded_by_filters: filtersApplied ? {
        channels: excludedByChannel,
        noTouches: excludedNoTouches
      } : undefined
    });
  } catch (e) {
    console.error('[m06/previewDeals]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Journey detail for a specific deal
export async function journeyDetail(req: Request, res: Response) {
  try {
    const dealId = req.params.id;
    const projectId = getProjectId(req);
    if (!dealId) return res.status(400).json({ error: 'dealId_required' });
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });
    const d = await Deal.findOne({ project_id: projectId, $or: [{ _id: dealId }, { deal_id: dealId }] }).lean();
    if (!d) return res.status(404).json({ error: 'deal_not_found' });

    // campaigns for project
    const campaigns = await Campaign.find({ project_id: projectId }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c.campaign_id)] = c;

    // touches for lead within project campaigns, up to closed_at
    const touchMatch: any = { lead_id: d.lead_id, campaign_id: { $in: Object.keys(campaignMap) } };
    const all = await CampaignTouch.find(touchMatch).sort({ touched_at: 1 }).lean();
    const list = all.filter(t => !d.closed_at || new Date(t.touched_at).getTime() <= new Date(d.closed_at as any).getTime());
    const journey = list.map(t => ({
      touched_at: t.touched_at,
      type: t.type,
      channel: (t as any).channel || campaignMap[String(t.campaign_id)]?.channel || 'other',
      campaign_id: String(t.campaign_id),
      campaignName: campaignMap[String(t.campaign_id)]?.name || null,
      metadata: (t as any).metadata || undefined,
    }));

    // lead summary (optional)
    let lead: any = null;
    try {
      const summaries = await loadLeadSummariesByObjectIds([String(d.lead_id)]);
      const summary = summaries[String(d.lead_id)];
      if (summary) {
        lead = {
          id: String(d.lead_id),
          lead_id: summary.lead_id,
          name: summary.name,
          email: summary.email,
          company: summary.company,
        };
      }
    } catch {}

    return res.json({ ok: true, deal: { id: String(d._id), external_id: d.deal_id || null, revenue: d.revenue, closed_at: d.closed_at, status: d.closed_won ? 'closed_won' : 'other' }, lead, journey });
  } catch (e) {
    console.error('[m06/journeyDetail]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// ROI dashboard data for Page 3
// Optional: ?runId=... to scope attribution to a specific run
export async function roiDashboard(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId) return res.status(400).json({ error: 'projectId_required' });

    const requestedRunId = (req.query.runId as string) || null;
    let runId = requestedRunId;

    // parse filters
    const channelFilter = (req.query.channel as string) || null; // single channel or comma-separated
    const startMonth = (req.query.start as string) || null; // YYYY-MM
    const endMonth = (req.query.end as string) || null; // YYYY-MM
    const minSpend = req.query.minSpend ? Number(req.query.minSpend) : null;
    const minROI = req.query.minROI ? Number(req.query.minROI) : null;

    // Precondition: ensure attribution results exist for this project (and run, if provided)
    const attribMatch: any = { project_id: projectId };
    if (runId) {
      if (!mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'invalid_runId' });
      attribMatch.run_id = runId;
    } else {
      const latestRun = await AttributionRun.findOne({ project_id: projectId, status: 'success' }).sort({ createdAt: -1 }).lean();
      if (latestRun) {
        runId = String(latestRun._id);
        attribMatch.run_id = runId;
      }
    }

    const hasAttrib = await AttributionResult.findOne(attribMatch).lean();
    if (!hasAttrib) return res.status(400).json({ error: 'no_attribution', message: 'No attribution results found. Please run attribution (Page 2) first.' });

    // Precondition: ensure there are campaigns with spend (required to compute ROI)
    const campaignsWithSpend = await Campaign.find({ project_id: projectId, spend: { $gt: 0 } }).lean();
    if (!campaignsWithSpend || campaignsWithSpend.length === 0) return res.status(400).json({ error: 'no_campaign_spend', message: 'No campaigns with spend found for this project. Add campaign spend to compute ROI.' });

    // Build attributed sums per campaign, optionally limited to a date range (by deal.closed_at)
    const matchStage: any = { ...attribMatch };
    // We'll join deals to filter by closed_at when start/end provided
    let attribByCampaign: any[] = [];
    if (startMonth || endMonth) {
      const startDate = startMonth ? new Date(startMonth + '-01') : new Date('1970-01-01');
      // set end to last day of month
      const endDate = endMonth ? new Date(new Date(endMonth + '-01').getFullYear(), new Date(endMonth + '-01').getMonth() + 1, 0, 23, 59, 59, 999) : new Date();
      attribByCampaign = await AttributionResult.aggregate([
        { $match: matchStage },
        { $lookup: { from: 'deals', localField: 'deal_id', foreignField: 'deal_id', as: 'deal' } },
        { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
        { $match: { 'deal.closed_at': { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } }
      ]).exec();
    } else {
      attribByCampaign = await AttributionResult.aggregate([
        { $match: matchStage },
        { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } }
      ]).exec();
    }

    // 2) campaign details
    const campaigns = await Campaign.find({ project_id: projectId }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c.campaign_id)] = c;

    // Build campaign metrics array
    const campaignsMetrics = attribByCampaign.map((r:any) => {
      const cid = String(r._id);
      const camp = campaignMap[cid] || null;
      const spend = camp ? (Number(camp.spend) || 0) : 0;
      const attributed = Number(r.attributed) || 0;
      const profit = attributed - spend;
      const roi = spend === 0 ? null : ((attributed - spend) / (spend || 1)) * 100;
      return { campaign_id: cid, name: camp?.name || null, channel: camp?.channel || 'other', spend, attributed, profit, roi };
    });

    // Include campaigns with spend but zero attribution
    for (const c of campaigns) {
      const cid = String(c.campaign_id);
      if (!campaignsMetrics.find((m:any) => m.campaign_id === cid)) {
        const spend = Number(c.spend) || 0;
        campaignsMetrics.push({ campaign_id: cid, name: c.name, channel: c.channel || 'other', spend, attributed: 0, profit: -spend, roi: spend === 0 ? null : ((0 - spend) / spend) * 100 });
      }
    }

    // Apply filters: channel, minSpend, minROI
    let filteredCampaigns = campaignsMetrics;
    if (channelFilter) {
      const chans = channelFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      filteredCampaigns = filteredCampaigns.filter((c:any) => chans.includes(String(c.channel).toLowerCase()));
    }
    if (minSpend !== null) filteredCampaigns = filteredCampaigns.filter((c:any) => (c.spend||0) >= minSpend);
    if (minROI !== null) filteredCampaigns = filteredCampaigns.filter((c:any) => (c.roi === null ? -Infinity : c.roi) >= minROI);

    // Totals (after filters)
    const totalAttributed = filteredCampaigns.reduce((s:any,m:any) => s + (m.attributed||0), 0);
    const totalSpend = filteredCampaigns.reduce((s:any,m:any) => s + (m.spend||0), 0);
    const netProfit = totalAttributed - totalSpend;
    const overallROI = totalSpend === 0 ? null : ((totalAttributed - totalSpend) / (totalSpend || 1)) * 100;

    // Monthly attributed revenue series (by deal.closed_at)
    const monthlyPipeline: any[] = [
      { $match: attribMatch },
      { $lookup: { from: 'deals', localField: 'deal_id', foreignField: 'deal_id', as: 'deal' } },
      { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
      { $project: { revenue_share: 1, ym: { $dateToString: { format: '%Y-%m', date: '$deal.closed_at' } }, closed_at: '$deal.closed_at', campaign_id: '$campaign_id' } }
    ];
    // apply date filter if provided
    if (startMonth || endMonth) {
      const startDate = startMonth ? new Date(startMonth + '-01') : new Date('1970-01-01');
      const endDate = endMonth ? new Date(new Date(endMonth + '-01').getFullYear(), new Date(endMonth + '-01').getMonth() + 1, 0, 23, 59, 59, 999) : new Date();
      monthlyPipeline.push({ $match: { closed_at: { $gte: startDate, $lte: endDate } } });
    }
    // if channel filter provided, join campaigns and filter by channel
    if (channelFilter) {
      monthlyPipeline.push({ $lookup: { from: 'campaigns', localField: 'campaign_id', foreignField: 'campaign_id', as: 'campaign' } });
      monthlyPipeline.push({ $unwind: { path: '$campaign', preserveNullAndEmptyArrays: false } });
      const chans = channelFilter.split(',').map((s:string) => s.trim().toLowerCase()).filter(Boolean);
      monthlyPipeline.push({ $match: { 'campaign.channel': { $in: chans } } });
    }
    monthlyPipeline.push({ $group: { _id: '$ym', attributed: { $sum: '$revenue_share' } } });
    monthlyPipeline.push({ $sort: { _id: 1 } });
    const monthlyAttribAgg = await AttributionResult.aggregate(monthlyPipeline).exec();
    const monthlySeries = monthlyAttribAgg.map((r:any) => ({ month: r._id, attributed: r.attributed }));

    // Channel contribution (from filtered campaigns)
    const channelMap: Record<string, number> = {};
    for (const m of filteredCampaigns) {
      const ch = m.channel || 'other';
      channelMap[ch] = (channelMap[ch] || 0) + (m.attributed || 0);
    }
    const channelContribution = Object.keys(channelMap).map(k => ({ channel: k, attributed: channelMap[k] }));

    // Top/bottom lists
    const sortedByROI = [...filteredCampaigns].sort((a:any,b:any)=> {
      const ra = a.roi === null ? -Infinity : a.roi;
      const rb = b.roi === null ? -Infinity : b.roi;
      return rb - ra;
    });
    const top5 = sortedByROI.slice(0,5);
    const bottom5 = sortedByROI.slice(-5).reverse();

    return res.json({ ok: true, runId: runId || null, totalAttributed, totalSpend, netProfit, overallROI, campaigns: filteredCampaigns, monthlySeries, channelContribution, top5, bottom5 });
  } catch (e) {
    console.error('[m06/roiDashboard]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// New CSV-driven forecasting endpoint for Module 6
export async function forecast(req: Request, res: Response) {
  try {
    // For now, forecast is global over the synthetic dataset and does not
    // filter by workspace; project/workspace scoping can be layered later.
    const horizonRaw = (req.body && req.body.horizonMonths as number | string | undefined)
      ?? (req.query.horizonMonths as string | undefined)
      ?? (req.query.months as string | undefined);
    const spendMultRaw = (req.body && req.body.spendMultiplier as number | string | undefined)
      ?? (req.query.spendMultiplier as string | undefined);

    const horizon = horizonRaw === undefined ? 6 : Number(horizonRaw);
    const spendMultiplier = spendMultRaw === undefined ? 1 : Number(spendMultRaw);

    const result = runForecast({
      horizonMonths: Number.isFinite(horizon) ? horizon : 6,
      spendMultiplier: Number.isFinite(spendMultiplier) ? spendMultiplier : 1,
    });

    return res.json(result);
  } catch (e) {
    console.error('[m06/forecast-csv]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function forecastOptions(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, channels: getForecastChannels() });
  } catch (e) {
    console.error('[m06/forecast-options]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Forecast endpoint that delegates to the Python forecasting agent
export async function forecastViaAgent(req: Request, res: Response) {
  try {
    const { campaign_id, campaign_channel, channel, forecast_window, spend_multiplier } = (req.body || {}) as {
      campaign_id?: unknown;
      campaign_channel?: unknown;
      channel?: unknown;
      forecast_window?: unknown;
      spend_multiplier?: unknown;
    };

    const channelStrRaw = (typeof campaign_channel === 'string' ? campaign_channel : (typeof channel === 'string' ? channel : '')).trim();
    const hasChannel = !!channelStrRaw;

    const campaignIdNum = typeof campaign_id === 'number' ? campaign_id : Number(campaign_id);
    if (!hasChannel && !Number.isFinite(campaignIdNum)) {
      return res.status(400).json({ ok: false, error: 'campaign_id_or_channel_required' });
    }

    const windowStr = typeof forecast_window === 'string' && forecast_window.trim()
      ? forecast_window.trim()
      : '3m';
    const multiplierNum = typeof spend_multiplier === 'number'
      ? spend_multiplier
      : (spend_multiplier !== undefined ? Number(spend_multiplier) : 1);

    let result: AgentForecastResult;
    try {
      if (hasChannel) {
        result = await invokePythonAgentByChannel(channelStrRaw.toLowerCase(), windowStr, Number.isFinite(multiplierNum) ? multiplierNum : 1);
      } else {
        result = await invokePythonAgent(campaignIdNum, windowStr, Number.isFinite(multiplierNum) ? multiplierNum : 1);
      }
    } catch (e: any) {
      console.error('[m06/forecast-agent]', e);
      const fallback: AgentForecastResult = {
        history: [],
        forecast: [],
        baselineROI: 0,
        scenarioROI: 0,
        confidenceLow: 0,
        confidenceHigh: 0,
        trend: 'flat',
        volatility: 0,
        seasonality: 0,
        forecastMethod: 'naive',
        explanation: 'Forecast agent failed to run. Please try again later or contact support.',
      };
      return res.status(200).json({ ok: false, error: 'agent_failed', result: fallback });
    }

    return res.json({ ok: true, result });
  } catch (e) {
    console.error('[m06/forecastViaAgent]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

// NOTE: old MongoDB-based forecasting endpoint removed.
