// Attribution Runs service
// Uses same pattern as other m06 services with env-based API base.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type RunAttributionRequest = {
  model_type: 'first_touch' | 'last_touch' | 'linear';
  date_from: string; // ISO
  date_to: string;   // ISO
  closedWonOnly?: boolean;
  minAmount?: number;
  includeArchived?: boolean;
};

export async function runAttribution(projectId: string, payload: RunAttributionRequest) {
  const url = `${API_BASE}/m06/run?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`runAttribution failed: ${res.status}`);
  return res.json();
}

export async function listRuns(projectId: string) {
  const url = `${API_BASE}/m06/runs?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listRuns failed: ${res.status}`);
  return res.json();
}

export async function getRunSummary(projectId: string, runId: string) {
  const url = `${API_BASE}/m06/run/${encodeURIComponent(runId)}/summary?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getRunSummary failed: ${res.status}`);
  return res.json();
}

export async function getROI(projectId: string, runId?: string) {
  const qp = new URLSearchParams({ projectId });
  if (runId) qp.set('runId', runId);
  const url = `${API_BASE}/m06/roi?${qp.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getROI failed: ${res.status}`);
  return res.json();
}
