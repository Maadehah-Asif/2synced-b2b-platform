/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: campaigns.ts
 * Purpose: Supports the c am pa ig ns flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { getWorkspaceIdFromHash } from '../../../utils/workspace';
import { fetchFromApi, parseApiJson } from '../../../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface CampaignRecord {
  id: string;
  campaign_id: string;
  name: string;
  channel: 'email' | 'ads' | 'linkedin' | 'webinar' | 'other';
  description?: string | null;
  tags?: string[];
  start_date?: string | null;
  end_date?: string | null;
  status?: 'active' | 'archived';
  spend: number;
  created_at?: string;
}

export interface CampaignCsvValidationIssue {
  field: string;
  message: string;
}

export interface CampaignCsvValidationRow {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, unknown>;
  action: 'insert' | 'update';
  errors: CampaignCsvValidationIssue[];
  warnings: CampaignCsvValidationIssue[];
  valid: boolean;
}

export interface CampaignCsvValidationResult {
  ok: true;
  header: string[];
  mapping: Record<string, number | null>;
  selectedRange: {
    startRow: number;
    endRow: number;
    totalRows: number;
    selectedRows: number;
  };
  summary: {
    checkedRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
  };
  rowResults: CampaignCsvValidationRow[];
}

export interface CampaignImportSummary {
  ok?: boolean;
  processed?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  warnings?: number;
  errors?: Array<{ row: number; reason: string }>;
  selected?: number;
}

export async function fetchCampaigns(params: Record<string, string | boolean | undefined>) {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) return { campaigns: [] as CampaignRecord[] };
  const searchParams = new URLSearchParams({ projectId });
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === false) return;
    searchParams.set(key, String(value));
  });
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns?${searchParams.toString()}`, undefined, API_BASE);
  if (!res.ok) throw new Error('campaign_list_failed');
  return res.json() as Promise<{ campaigns: CampaignRecord[] }>;
}

export async function searchCampaigns(q: string) {
  const result = await fetchCampaigns({ search: q });
  return (result.campaigns || []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
  }));
}

export async function createCampaign(payload: Record<string, unknown>) {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  }, API_BASE);
  return parseApiJson(res, 'campaign_create_failed');
}

export async function updateCampaign(id: string, payload: Record<string, unknown>) {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  }, API_BASE);
  return parseApiJson(res, 'campaign_update_failed');
}

export async function archiveCampaign(id: string) {
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns/${encodeURIComponent(id)}/archive`, { method: 'POST' }, API_BASE);
  await parseApiJson(res, 'campaign_archive_failed');
}

export async function deleteCampaignPermanent(id: string) {
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' }, API_BASE);
  await parseApiJson(res, 'campaign_delete_failed');
}

export async function validateCampaignsCsv(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number }) {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns/import/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  }, API_BASE);
  return parseApiJson<CampaignCsvValidationResult>(res, 'campaign_validation_failed');
}

export async function importCampaignsCsv(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; allowPartial?: boolean }) {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_BASE}/m06/campaigns/import/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  }, API_BASE);
  return parseApiJson<CampaignImportSummary>(res, 'campaign_import_failed');
}
