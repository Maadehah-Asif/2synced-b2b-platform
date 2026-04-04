import { getWorkspaceIdFromHash } from '../../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type StageRecord = {
  _id?: string;
  workspace_id?: string;
  lead_id: string;
  stage_name: string;
  entered_at: string;
  exited_at?: string | null;
  stage_status?: string | null;
  next_stage?: string | null;
  exit_reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  is_archived?: boolean;
};

export type ValidationIssue = {
  field: string;
  message: string;
};

export type StageValidationRow = {
  rowNumber: number;
  original: Record<string, string>;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type StageValidationResult = {
  ok: true;
  rowResults: StageValidationRow[];
  summary: {
    checkedRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
  };
};

export type StageImportSummary = {
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

async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `Request failed with HTTP ${res.status}`);
  }
  return json;
}

export async function listStages(params: {
  leadId?: string;
  stageName?: string;
  status?: string;
  includeArchived?: boolean;
}) {
  const qs = new URLSearchParams({ workspaceId: getWorkspaceId() });
  if (params.leadId) qs.set('leadId', params.leadId);
  if (params.stageName) qs.set('stageName', params.stageName);
  if (params.status) qs.set('status', params.status);
  if (params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m07/stages?${qs.toString()}`);
  const json = await parseJson(res);
  return (json.items || []) as StageRecord[];
}

export async function createStage(payload: Omit<StageRecord, '_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'is_archived'>) {
  const res = await fetch(`${API_URL}/m07/stages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  });
  return parseJson(res);
}

export async function updateStage(id: string, payload: Partial<StageRecord>) {
  const res = await fetch(`${API_URL}/m07/stages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function archiveStage(id: string) {
  const res = await fetch(`${API_URL}/m07/stages/${encodeURIComponent(id)}/archive`, { method: 'POST' });
  return parseJson(res);
}

export async function deleteStagePermanent(id: string) {
  const res = await fetch(`${API_URL}/m07/stages/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' });
  return parseJson(res);
}

export async function validateStagesCSV(payload: {
  csv: string;
  map: Record<string, string | null>;
  startRow?: number;
  endRow?: number;
  overwriteMode?: 'overwrite_existing' | 'skip_duplicates';
}) {
  const res = await fetch(`${API_URL}/m07/stages/upload/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  });
  return (await parseJson(res)) as StageValidationResult;
}

export async function importStagesCSV(payload: {
  csv: string;
  map: Record<string, string | null>;
  startRow?: number;
  endRow?: number;
  overwriteMode?: 'overwrite_existing' | 'skip_duplicates';
  allowPartial?: boolean;
}) {
  const res = await fetch(`${API_URL}/m07/stages/upload/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: getWorkspaceId(), ...payload }),
  });
  return (await parseJson(res)) as StageImportSummary;
}

export async function searchLeads(query: string) {
  const workspaceId = getWorkspaceId();
  const qs = new URLSearchParams({ projectId: workspaceId });
  if (query.trim()) qs.set('q', query.trim());
  const res = await fetch(`${API_URL}/m06/leads/search?${qs.toString()}`);
  return parseJson(res);
}
