const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export async function previewJourneys(params: any){
  const workspaceId = useWorkspaceIdFromHash();
  const usp = new URLSearchParams();
  if(workspaceId) usp.set('projectId', workspaceId);
  Object.keys(params||{}).forEach(k=>{
    const v = (params as any)[k];
    if(v!==undefined && v!==null && v!=='') usp.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/m07/preview?${usp.toString()}`);
  if(!res.ok) throw new Error('preview_failed');
  return await res.json();
}

export async function getJourney(dealId: string){
  const workspaceId = useWorkspaceIdFromHash();
  const usp = new URLSearchParams();
  if(workspaceId) usp.set('projectId', workspaceId);
  const res = await fetch(`${API_BASE}/m07/journey/${dealId}?${usp.toString()}`);
  if(!res.ok) throw new Error('journey_failed');
  return await res.json();
}
