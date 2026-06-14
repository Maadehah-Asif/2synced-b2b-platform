/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: attributionRuns.ts
 * Purpose: Supports the a tt ri bu ti on Ru ns flow for this module.
 * Notes: Documentation header added for maintainability.
 */

// Attribution Runs service
// Uses same pattern as other m06 services with env-based API base.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = undefined;
  }
}

export type RunAttributionRequest = {
  model_type: 'first_touch' | 'last_touch' | 'linear';
  date_from: string; // ISO
  date_to: string;   // ISO
  closedWonOnly?: boolean;
  minAmount?: number;
  includeArchived?: boolean;
  requiredChannels?: string[];
  requiredCampaignIds?: string[];
};

export type AttributionFilterSummary = {
  closedWonOnly?: boolean;
  minAmount?: number;
  includeArchived?: boolean;
  requiredChannels?: string[];
  requiredCampaignIds?: string[];
};

export type AttributionExcludedSummary = {
  channels?: number;
  campaigns?: number;
  noTouches?: number;
};

export type AttributionRunRecord = {
  _id: string;
  run_id: string;
  model_type: 'first_touch' | 'last_touch' | 'linear';
  status: 'running' | 'success' | 'error';
  timestamp?: string;
  date_from?: string;
  date_to?: string;
  deal_count?: number;
  deals_with_journeys?: number;
  deals_without_journeys?: number;
  total_revenue?: number;
  attributed_revenue?: number;
  unattributed_revenue?: number;
  campaign_count?: number;
  meta?: {
    filters?: AttributionFilterSummary | null;
    excludedByFilters?: AttributionExcludedSummary | null;
  } | null;
};

export type RunSummaryCampaign = {
  campaign_id: string;
  revenue: number;
  deal_count: number;
};

export type RunSummarySample = {
  _id: string;
  total: number;
  deal_amount?: number;
  lead_id?: string;
  items: Array<{ campaign_id: string; share: number }>;
};

export type RunSummaryResponse = {
  ok: true;
  run: {
    id: string;
    run_id: string;
    model_type: 'first_touch' | 'last_touch' | 'linear';
    status: 'running' | 'success' | 'error';
    timestamp?: string;
    date_from?: string;
    date_to?: string;
    deal_count?: number;
    deals_with_journeys?: number;
    deals_without_journeys?: number;
    total_revenue?: number;
    attributed_revenue?: number;
    unattributed_revenue?: number;
    campaign_count?: number;
    campaigns_with_credit?: number;
    touches_used?: number;
    filters?: AttributionFilterSummary | null;
    excluded_by_filters?: AttributionExcludedSummary | null;
  };
  campaigns: RunSummaryCampaign[];
  samples: RunSummarySample[];
  unattributed_sample: null | { deal_id: string; revenue: number; closed_at?: string };
};

export type RunAttributionResponse = {
  ok: boolean;
  runId: string;
  runName: string;
  model: 'first_touch' | 'last_touch' | 'linear';
  date_from?: string;
  date_to?: string;
  deal_count?: number;
  deals_with_journeys?: number;
  deals_without_journeys?: number;
  total_revenue?: number;
  attributed_revenue?: number;
  unattributed_revenue?: number;
  campaign_count?: number;
  touches_used?: number;
  filters?: AttributionFilterSummary | null;
  excluded_by_filters?: AttributionExcludedSummary | null;
};

export type PreviewDealRow = {
  deal_id: string;
  deal_external_id: string | null;
  lead_id: string;
  lead_name: string | null;
  lead_email: string | null;
  amount: number;
  closed_at?: string;
  status: string;
  touchCount: number;
  firstTouchAt?: string | null;
  lastTouchAt?: string | null;
};

export type PreviewDealsResponse = {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  rows: PreviewDealRow[];
  excluded_by_filters?: AttributionExcludedSummary;
};

export type CampaignOption = {
  id: string;
  name: string;
  channel?: string | null;
};

async function handleJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  if (!res.ok) {
    if (isJson) {
      try {
        const body = await res.json();
        const message = body?.message || body?.error || `Request failed (${res.status})`;
        const err = new ApiError(message, res.status, body?.error);
        if (body?.details !== undefined) err.details = body.details;
        throw err;
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
    throw new ApiError(`Request failed (${res.status})`, res.status);
  }
  return isJson ? (res.json() as Promise<T>) : (undefined as unknown as T);
}

export async function runAttribution(projectId: string, payload: RunAttributionRequest) {
  const url = `${API_BASE}/m06/run?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJsonResponse<RunAttributionResponse>(res);
}

export async function listRuns(projectId: string) {
  const url = `${API_BASE}/m06/runs?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  return handleJsonResponse<{ ok: boolean; runs: AttributionRunRecord[] }>(res);
}

export async function getRunSummary(projectId: string, runId: string) {
  const url = `${API_BASE}/m06/run/${encodeURIComponent(runId)}/summary?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  return handleJsonResponse<RunSummaryResponse>(res);
}

export async function getROI(projectId: string, runId?: string) {
  const qp = new URLSearchParams({ projectId });
  if (runId) qp.set('runId', runId);
  const url = `${API_BASE}/m06/roi?${qp.toString()}`;
  const res = await fetch(url);
  return handleJsonResponse(res);
}

export async function previewDealsCount(projectId: string, payload: RunAttributionRequest) {
  const params = new URLSearchParams({
    projectId,
    from: payload.date_from,
    to: payload.date_to,
    status: payload.closedWonOnly === false ? 'all' : 'closed_won',
    page: '1',
    limit: '1'
  });
  if (payload.minAmount !== undefined && payload.minAmount !== null && !Number.isNaN(payload.minAmount)) {
    params.set('minAmount', String(payload.minAmount));
  }
  if (payload.includeArchived) params.set('includeArchived', 'true');
  if (payload.requiredChannels && payload.requiredChannels.length) {
    params.set('channels', payload.requiredChannels.join(','));
  }
  if (payload.requiredCampaignIds && payload.requiredCampaignIds.length) {
    params.set('campaignIds', payload.requiredCampaignIds.join(','));
  }

  const res = await fetch(`${API_BASE}/m06/preview?${params.toString()}`);
  return handleJsonResponse<PreviewDealsResponse>(res);
}

export async function fetchCampaignSummaries(projectId: string) {
  const qs = new URLSearchParams({ projectId, includeArchived: 'true' });
  const res = await fetch(`${API_BASE}/m06/campaigns?${qs.toString()}`);
  const data = await handleJsonResponse<{ ok: boolean; campaigns: Array<{ id: string; name: string; channel?: string | null }> }>(res);
  const campaigns = data?.campaigns || [];
  return campaigns.map(c => ({ id: c.id, name: c.name || c.id, channel: c.channel || null })) as CampaignOption[];
}
