import { getWorkspaceIdFromHash } from '../../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface Module6Lead {
  _id: string;
  project_id?: string;
  row_number?: number | null;
  lead_id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  source?: string | null;
  owner?: string | null;
  industry?: string | null;
  region?: string | null;
  lead_score?: number | null;
  intent_score?: number | null;
  email?: string | null;
  job_title?: string | null;
  segment?: string | null;
  is_archived?: boolean;
  raw?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadImportSummary {
  ok?: boolean;
  processed: number;
  inserted: number;
  updated?: number;
  failed: number;
  duplicates: number;
  skipped?: number;
  warnings?: number;
  failedRows?: Array<{ row: number; error: string }>;
  selected?: number;
}

export interface LeadCsvValidationIssue {
  field: string;
  message: string;
}

export interface LeadCsvValidationRow {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, unknown>;
  action: 'insert' | 'update';
  errors: LeadCsvValidationIssue[];
  warnings: LeadCsvValidationIssue[];
  valid: boolean;
}

export interface LeadCsvValidationResult {
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
  rowResults: LeadCsvValidationRow[];
}

export async function fetchModule6Leads(params: { search?: string; limit?: number; includeArchived?: boolean } = {}): Promise<{ leads: Module6Lead[] }> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) return { leads: [] };
  const qs = new URLSearchParams({ projectId });
  if (params.search) qs.set('search', params.search);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m06/leads?${qs.toString()}`);
  if (!res.ok) return { leads: [] };
  const json = await res.json();
  return { leads: json.leads || [] };
}

export async function importModule6LeadsCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; allowPartial?: boolean; }): Promise<LeadImportSummary> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) {
    return { processed: 0, inserted: 0, failed: 0, duplicates: 0 };
  }
  const res = await fetch(`${API_URL}/m06/leads/import/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  });
  if (!res.ok) {
    let message = 'Import failed';
    try {
      const err = await res.json();
      if (err && (err.error || err.message)) message = `${res.status} ${err.error || err.message}`;
      else message = `${res.status} Import failed`;
    } catch {
      try {
        const text = await res.text();
        if (text) message = `${res.status} ${text}`;
      } catch {
        // ignore body parsing fallback errors
      }
    }
    throw new Error(message);
  }
  return res.json();
}

export async function validateModule6LeadsCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; }): Promise<LeadCsvValidationResult> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/leads/import/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'validation_failed');
  return json;
}

export async function searchModule6Leads(query: string): Promise<{ leads: Module6Lead[] }> {
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams();
  if (projectId) qs.set('projectId', projectId);
  if (query) qs.set('q', query);
  const res = await fetch(`${API_URL}/m06/leads/search?${qs.toString()}`);
  if (!res.ok) return { leads: [] };
  const json = await res.json();
  return { leads: json.leads || [] };
}

export async function createModule6Lead(payload: Partial<Module6Lead> & { lead_id: string }): Promise<Module6Lead> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'create_failed');
  return json.lead;
}

export async function updateModule6Lead(id: string, payload: Partial<Module6Lead>): Promise<Module6Lead> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/leads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'update_failed');
  return json.lead;
}

export async function archiveModule6Lead(id: string): Promise<void> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) throw new Error('workspace_required');
  const res = await fetch(`${API_URL}/m06/leads/${id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'archive_failed');
}
