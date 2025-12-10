import { getWorkspaceIdFromHash } from '../../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface Module6Lead {
  _id: string;
  lead_id: string;
  name?: string | null;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadImportSummary {
  ok?: boolean;
  processed: number;
  inserted: number;
  failed: number;
  duplicates: number;
  failedRows?: Array<{ row: number; error: string }>;
  selected?: number;
}

export async function fetchModule6Leads(params: { search?: string; limit?: number } = {}): Promise<{ leads: Module6Lead[] }> {
  const projectId = getWorkspaceIdFromHash();
  if (!projectId) return { leads: [] };
  const qs = new URLSearchParams({ projectId });
  if (params.search) qs.set('search', params.search);
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${API_URL}/m06/leads?${qs.toString()}`);
  if (!res.ok) return { leads: [] };
  const json = await res.json();
  return { leads: json.leads || [] };
}

export async function importModule6LeadsCSV(payload: { csv: string; map: Record<string, string | null>; startRow?: number; endRow?: number; }): Promise<LeadImportSummary> {
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
      } catch {}
    }
    throw new Error(message);
  }
  return res.json();
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
