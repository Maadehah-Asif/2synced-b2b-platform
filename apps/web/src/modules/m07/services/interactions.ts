import { getWorkspaceIdFromHash } from '../../../utils/workspace';
import { fetchFromApi, parseApiJson } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type InteractionRecord = {
  _id?: string;
  workspace_id?: string;
  interaction_id?: string | null;
  lead_id: string;
  timestamp: string;
  interaction_type: string;
  channel?: string | null;
  campaign_id?: string | null;
  outcome?: string | null;
  engagement_score?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  is_archived?: boolean;
};

export type ValidationIssue = { field: string; message: string };
export type InteractionValidationRow = {
  rowNumber: number;
  original: Record<string, string>;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type InteractionValidationResult = {
  ok: true;
  rowResults: InteractionValidationRow[];
  summary: {
    checkedRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
  };
};

export type InteractionImportSummary = {
  ok: true;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  warnings: string[];
};

function getWorkspaceId() {
  const workspaceId = getWorkspaceIdFromHash();
  if (!workspaceId) throw new Error('Workspace is required.');
  return workspaceId;
}

async function parseJson<T>(res: Response): Promise<T> {
  return parseApiJson<T>(res, `Request failed with HTTP ${res.status}`);
}

export async function listInteractions(params: {
  leadId?: string;
  interactionType?: string;
  campaignId?: string;
  includeArchived?: boolean;
}) {
  const qs = new URLSearchParams({ workspaceId: getWorkspaceId() });
  if (params.leadId) qs.set('leadId', params.leadId);
  if (params.interactionType) qs.set('interactionType', params.interactionType);
  if (params.campaignId) qs.set('campaignId', params.campaignId);
  if (params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetchFromApi(`${API_URL}/m07/interactions?${qs.toString()}`, undefined, API_URL);
  const json = await parseJson<{ items?: InteractionRecord[] }>(res);
  return (json.items || []) as InteractionRecord[];
}

export async function createInteraction(payload: Omit<InteractionRecord, '_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'is_archived'>) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  }, API_URL);
  return parseJson(res);
}

export async function updateInteraction(id: string, payload: Partial<InteractionRecord>) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, API_URL);
  return parseJson(res);
}

export async function archiveInteraction(id: string) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions/${encodeURIComponent(id)}/archive`, { method: 'POST' }, API_URL);
  return parseJson(res);
}

export async function deleteInteractionPermanent(id: string) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' }, API_URL);
  return parseJson(res);
}

export async function validateInteractionsCSV(payload: {
  csv: string;
  map: Record<string, string | null>;
  startRow?: number;
  endRow?: number;
  duplicateMode?: 'skip_duplicates' | 'overwrite_existing';
}) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions/upload/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  }, API_URL);
  return (await parseJson(res)) as InteractionValidationResult;
}

export async function importInteractionsCSV(payload: {
  csv: string;
  map: Record<string, string | null>;
  startRow?: number;
  endRow?: number;
  duplicateMode?: 'skip_duplicates' | 'overwrite_existing';
  allowPartial?: boolean;
}) {
  const res = await fetchFromApi(`${API_URL}/m07/interactions/upload/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  }, API_URL);
  return (await parseJson(res)) as InteractionImportSummary;
}

export async function searchLeads(query: string) {
  const workspaceId = getWorkspaceId();
  const qs = new URLSearchParams({ projectId: workspaceId });
  if (query.trim()) qs.set('q', query.trim());
  const res = await fetchFromApi(`${API_URL}/m06/leads/search?${qs.toString()}`, undefined, API_URL);
  return parseJson<{ leads?: Array<{ lead_id?: string; full_name?: string; email?: string }> }>(res);
}

export async function searchCampaigns(query: string) {
  const workspaceId = getWorkspaceId();
  const qs = new URLSearchParams({ projectId: workspaceId, search: query.trim() });
  const res = await fetchFromApi(`${API_URL}/m06/campaigns?${qs.toString()}`, undefined, API_URL);
  const json = await parseJson<{ campaigns?: Array<{ id?: string; campaign_id?: string; name?: string; channel?: string }> }>(res);
  return (json.campaigns || []) as Array<{ id?: string; campaign_id?: string; name?: string; channel?: string }>;
}
