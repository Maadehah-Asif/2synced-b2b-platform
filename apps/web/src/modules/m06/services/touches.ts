import { getWorkspaceIdFromHash } from '../../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface TouchRecord {
  id: string;
  lead_id: string;
  campaign_id: string;
  channel?: string;
  type: string;
  touched_at: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface TouchValidationIssue {
  field: string;
  message: string;
}

export interface TouchValidationRow {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, unknown>;
  action: 'insert';
  errors: TouchValidationIssue[];
  warnings: TouchValidationIssue[];
  valid: boolean;
}

export interface TouchValidationResult {
  ok: true;
  header: string[];
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
  rowResults: TouchValidationRow[];
}

export interface TouchImportSummary {
  ok?: boolean;
  processed: number;
  inserted: number;
  failed: number;
  duplicates: number;
  failedRows?: Array<{ row: number; error: string }>;
}

export async function createTouch(payload: { lead_id: string; campaign_id: string; type: string; channel?: string; touched_at: string; metadata?: any; status?: string; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/campaign-touches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId })
  });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_create_failed');
  return json.touch;
}

export async function listTouchesByCampaign(params: { campaignId: string; channel?: string; type?: string; includeArchived?: boolean; workspaceId?: string; }) {
  const qs = new URLSearchParams();
  const projectId = params.workspaceId || getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  qs.set('projectId', projectId);
  qs.set('campaignId', params.campaignId);
  if(params.channel) qs.set('channel', params.channel);
  if(params.type) qs.set('type', params.type);
  if(params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m06/campaign-touches/by-campaign?${qs.toString()}`);
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_list_failed');
  return json.touches || [];
}

export async function listTouchesByLead(params: { leadId: string; channel?: string; type?: string; includeArchived?: boolean; workspaceId?: string; }) {
  const qs = new URLSearchParams();
  const projectId = params.workspaceId || getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  qs.set('projectId', projectId);
  qs.set('leadId', params.leadId);
  if(params.channel) qs.set('channel', params.channel);
  if(params.type) qs.set('type', params.type);
  if(params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m06/campaign-touches/by-lead?${qs.toString()}`);
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_list_failed');
  return json.touches || [];
}

export async function updateTouch(id: string, payload: { channel?: string; type?: string; touched_at?: string; metadata?: any; status?: string; }) {
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_update_failed');
  return json;
}

export async function archiveTouch(id: string){
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}/archive`, { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_archive_failed');
  return json;
}

export async function deleteTouchPermanent(id: string){
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}/permanent`, { method: 'DELETE' });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_delete_failed');
  return json;
}

export async function validateTouchesCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; campaignIdentifier?: 'name'|'campaign_id'; leadIdentifier?: 'id'|'email'; duplicatePolicy?: 'skip'|'allow'; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/campaign-touches/import/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId })
  });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_validation_failed');
  return json as TouchValidationResult;
}

export async function importTouchesCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; campaignIdentifier?: 'name'|'campaign_id'; leadIdentifier?: 'id'|'email'; duplicatePolicy?: 'skip'|'allow'; allowPartial?: boolean; }) {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/campaign-touches/import/csv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, projectId }) });
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json?.error || 'touch_import_failed');
  return json as TouchImportSummary;
}

export async function searchCampaigns(query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', search: query });
  const res = await fetch(`${API_URL}/m06/campaigns?${qs.toString()}`);
  if(!res.ok) return { campaigns: [] };
  const json = await res.json();
  return { campaigns: json.campaigns || [] };
}

export async function searchLeads(query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', q: query });
  const res = await fetch(`${API_URL}/m06/leads/search?${qs.toString()}`);
  if(!res.ok) return { leads: [] };
  const json = await res.json();
  return { leads: json.leads || [] };
}
