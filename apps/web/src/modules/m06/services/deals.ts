/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: deals.ts
 * Purpose: Supports the d ea ls flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { getWorkspaceIdFromHash } from '../../../utils/workspace';
import { fetchFromApi, parseApiJson } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface Deal {
  _id?: string;
  deal_id: string;
  lead_id: string;
  project_id?: string;
  revenue: number;
  currency?: string | null;
  closed_won: boolean;
  closed_at?: string | null;
}

export interface DealValidationIssue {
  field: string;
  message: string;
}

export interface DealValidationRow {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, unknown>;
  action: 'insert' | 'update';
  errors: DealValidationIssue[];
  warnings: DealValidationIssue[];
  valid: boolean;
}

export interface DealValidationResult {
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
  rowResults: DealValidationRow[];
}

export interface DealImportSummary {
  ok?: boolean;
  processed?: number;
  inserted?: number;
  failed?: number;
  duplicates?: number;
  failedRows?: Array<{ row: number; error: string }>;
  selected?: number;
  skipped?: number;
  warnings?: number;
}

export async function createDeal(payload: Partial<Deal> & { lead_id: string; deal_id: string; revenue: number; closed_won: boolean; closed_at?: string; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_URL}/m06/deals`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...payload, projectId }) }, API_URL);
  return parseApiJson(res, 'deal_create_failed');
}

export async function validateDealsCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; duplicatePolicy?: 'skip' | 'allow'; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_URL}/m06/deals/import/validate`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...payload, projectId }) }, API_URL);
  return parseApiJson<DealValidationResult>(res, 'deal_validation_failed');
}

export async function importDealsCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; duplicatePolicy?: 'skip' | 'allow'; allowPartial?: boolean; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetchFromApi(`${API_URL}/m06/deals/import/csv`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...payload, projectId }) }, API_URL);
  return parseApiJson<DealImportSummary>(res, 'deal_import_failed');
}

export async function listDeals(params: { leadId?: string; from?: string; to?: string; status?: string; minAmount?: number; maxAmount?: number; includeArchived?: boolean; }): Promise<Deal[]>{
  const qs = new URLSearchParams();
  const projectId = getWorkspaceIdFromHash();
  if(projectId) qs.set('projectId', projectId);
  if(params.leadId) qs.set('leadId', String(params.leadId));
  if(params.from) qs.set('from', params.from);
  if(params.to) qs.set('to', params.to);
  if(params.status) qs.set('status', params.status);
  if(params.minAmount!==undefined) qs.set('minAmount', String(params.minAmount));
  if(params.maxAmount!==undefined) qs.set('maxAmount', String(params.maxAmount));
  if(params.includeArchived) qs.set('includeArchived','true');
  const res = await fetchFromApi(`${API_URL}/m06/deals?${qs.toString()}`, undefined, API_URL);
  const json = await res.json().catch(() => ([]));
  if(!res.ok) throw new Error('deal_list_failed');
  return json;
}

export async function updateDeal(id: string, payload: Partial<Deal>){
  const res = await fetchFromApi(`${API_URL}/m06/deals/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) }, API_URL);
  return parseApiJson(res, 'deal_update_failed');
}

export async function archiveDeal(id: string){
  const res = await fetchFromApi(`${API_URL}/m06/deals/${id}/archive`, { method:'POST' }, API_URL);
  return parseApiJson(res, 'deal_archive_failed');
}

export async function deleteDealPermanent(id: string){
  const res = await fetchFromApi(`${API_URL}/m06/deals/${id}/permanent`, { method:'DELETE' }, API_URL);
  return parseApiJson(res, 'deal_delete_failed');
}

export async function searchLeads(query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', q: query });
  const res = await fetchFromApi(`${API_URL}/m06/leads/search?${qs.toString()}`, undefined, API_URL);
  if(!res.ok) return { leads: [] };
  const json = await res.json();
  return { leads: json.leads || [] };
}
