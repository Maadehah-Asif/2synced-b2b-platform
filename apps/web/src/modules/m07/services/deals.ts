import type { CampaignTouchImportSummary } from '../../../types/campaignTouch';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getWorkspaceIdFromHash(): string | null {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export interface Deal {
  _id?: string;
  deal_id?: string;
  lead_id: number | string;
  amount: number;
  currency?: string;
  closed_won: boolean;
  closed_at?: string;
  stage?: string;
  notes?: string;
  status?: string; // active | archived
}

export async function createDeal(payload: Partial<Deal> & { lead_id: string | number; amount: number; closed_won: boolean; closed_at?: string; }): Promise<{ id: string } | { error: string }>{
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) return { error: 'workspace_required' } as any;
  const res = await fetch(`${API_URL}/m07/deals`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ...payload, projectId }) });
  const j = await res.json();
  if(!res.ok) return { error: j.error || 'failed' } as any;
  return j.deal || j;
}

export async function importDealsCSV(payload: { csv: string; map: any; startRow?: number; endRow?: number; duplicatePolicy?: string; }): Promise<CampaignTouchImportSummary>{
  const projectId = getWorkspaceIdFromHash();
  const body = { ...payload, projectId };
  const res = await fetch(`${API_URL}/m07/deals/import/csv`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

export async function listDeals(params: { leadId?: string; from?: string; to?: string; status?: string; minAmount?: number; maxAmount?: number; stage?: string; includeArchived?: boolean; }): Promise<Deal[]>{
  const qs = new URLSearchParams();
  const projectId = getWorkspaceIdFromHash();
  if(projectId) qs.set('projectId', projectId);
  if(params.leadId) qs.set('leadId', String(params.leadId));
  if(params.from) qs.set('from', params.from);
  if(params.to) qs.set('to', params.to);
  if(params.status) qs.set('status', params.status);
  if(params.minAmount!==undefined) qs.set('minAmount', String(params.minAmount));
  if(params.maxAmount!==undefined) qs.set('maxAmount', String(params.maxAmount));
  if(params.stage) qs.set('stage', params.stage);
  if(params.includeArchived) qs.set('includeArchived','true');
  const res = await fetch(`${API_URL}/m07/deals?${qs.toString()}`);
  return res.json();
}

export async function updateDeal(id: string, payload: Partial<Deal>){
  const res = await fetch(`${API_URL}/m07/deals/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function archiveDeal(id: string){
  const res = await fetch(`${API_URL}/m07/deals/${id}/archive`, { method:'POST' });
  return res.json();
}

export async function deleteDealPermanent(id: string){
  const res = await fetch(`${API_URL}/m07/deals/${id}/permanent`, { method:'DELETE' });
  return res.json();
}

export async function searchLeads(query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', q: query });
  const res = await fetch(`${API_URL}/m07/leads/search?${qs.toString()}`);
  if(!res.ok) return { leads: [] } as any;
  const j = await res.json();
  return { leads: j.leads || [] } as any;
}
