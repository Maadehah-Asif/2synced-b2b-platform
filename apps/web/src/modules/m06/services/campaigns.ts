const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export async function searchCampaigns(q: string){
  const workspaceId = useWorkspaceIdFromHash();
  const usp = new URLSearchParams();
  if(workspaceId) usp.set('projectId', workspaceId);
  if(q) usp.set('search', q);
  const res = await fetch(`${API_BASE}/m06/campaigns?${usp.toString()}`);
  if(!res.ok) throw new Error('campaign_search_failed');
  const data = await res.json();
  // normalize to minimal structure
  const items = (data.campaigns || []).map((c:any)=> ({ id: c.id, name: c.name, channel: c.channel }));
  return items;
}
