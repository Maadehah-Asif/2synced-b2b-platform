import type { CampaignTouch, CampaignTouchImportSummary } from '../../../types/campaignTouch';
import { getWorkspaceIdFromHash } from '../../../utils/workspace';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';


export async function createTouch(payload: { leadId: string; campaignId: string; type: string; channel?: string; touched_at: string; metadata?: any; }): Promise<{ id: string } | { error: string }> {
  const projectId = getWorkspaceIdFromHash();
  if(!projectId) return { error: 'workspace_required' } as any;
  const res = await fetch(`${API_URL}/m06/campaign-touches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, projectId })
  });
  const j = await res.json();
  if(!res.ok) return { error: j.error || 'failed' } as any;
  return j.touch;
}

type TouchListParams = { campaignId: string; from?: string; to?: string; channel?: string; type?: string; includeArchived?: boolean; showArchived?: boolean; filterType?: string; filterChannel?: string; workspaceId?: string; };

type TouchListLeadParams = { leadId: string; from?: string; to?: string; channel?: string; type?: string; includeArchived?: boolean; showArchived?: boolean; filterType?: string; filterChannel?: string; workspaceId?: string; };

export async function listTouchesByCampaign(params: TouchListParams) : Promise<CampaignTouch[]> {
  const qs = new URLSearchParams();
  const projectId = params.workspaceId || getWorkspaceIdFromHash();
  if(projectId) qs.set('projectId', projectId);
  else return { ok: false, error: 'workspace_required' } as any;
  qs.set('campaignId', params.campaignId);
  if(params.from) qs.set('from', params.from);
  if(params.to) qs.set('to', params.to);
  if(params.channel) qs.set('channel', params.channel);
  if(params.type) qs.set('type', params.type);
  if(params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m06/campaign-touches/by-campaign?${qs.toString()}`);
  const j = await res.json();
  if(!res.ok) return { ok: false, error: j.error || 'failed' } as any;
  return j as any;
}

export async function listTouchesByLead(params: TouchListLeadParams) : Promise<CampaignTouch[]> {
  const qs = new URLSearchParams();
  const projectId = params.workspaceId || getWorkspaceIdFromHash();
  if(projectId) qs.set('projectId', projectId);
  else return { ok: false, error: 'workspace_required' } as any;
  qs.set('leadId', params.leadId);
  if(params.from) qs.set('from', params.from);
  if(params.to) qs.set('to', params.to);
  if(params.channel) qs.set('channel', params.channel);
  if(params.type) qs.set('type', params.type);
  if(params.includeArchived) qs.set('includeArchived', 'true');
  const res = await fetch(`${API_URL}/m06/campaign-touches/by-lead?${qs.toString()}`);
  const j = await res.json();
  if(!res.ok) return { ok: false, error: j.error || 'failed' } as any;
  return j as any;
}

export async function updateTouch(id: string, payload: { channel?: string; type?: string; touched_at?: string; metadata?: any; }) {
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function archiveTouch(id: string){
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}/archive`, { method: 'POST' });
  return res.json();
}

export async function deleteTouchPermanent(id: string){
  const res = await fetch(`${API_URL}/m06/campaign-touches/${id}/permanent`, { method: 'DELETE' });
  return res.json();
}

export async function importTouchesCSV(payload: { csv: string; map: any; startRow?: number; endRow?: number; campaignIdentifier?: 'name'|'campaign_id'; leadIdentifier?: 'id'|'email'; duplicatePolicy?: string; }): Promise<CampaignTouchImportSummary> {
  const projectId = getWorkspaceIdFromHash();
  const body = { ...payload, projectId };
  const res = await fetch(`${API_URL}/m06/campaign-touches/import/csv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

// Placeholder autocomplete search functions (backend route may need implementation)
export async function searchCampaigns(query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', search: query });
  const res = await fetch(`${API_URL}/m06/campaigns?${qs.toString()}`);
  if(!res.ok) return { campaigns: [] };
  const j = await res.json();
  return { campaigns: j.campaigns || [] };
}

// Lead search: requires backend; placeholder using lead_id numeric search (not implemented route). Returns empty list for now.
export async function searchLeads(_query: string){
  const projectId = getWorkspaceIdFromHash();
  const qs = new URLSearchParams({ projectId: projectId || '', q: _query });
  const res = await fetch(`${API_URL}/m06/leads/search?${qs.toString()}`);
  if(!res.ok) return { leads: [] };
  const j = await res.json();
  return { leads: j.leads || [] };
}
