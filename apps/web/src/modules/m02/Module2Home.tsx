import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { useState } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Module2Home(){
  const wid = getWorkspaceIdFromHash();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  function go(path: string){
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }
  async function seedDemo(){
    if (!wid) { window.location.hash = '#/workspaces'; return setSeedMsg('workspace not found'); }
    setSeeding(true); setSeedMsg(null);
    try{
      const res = await fetch(`${API_URL || ''}/m02/seed-demo`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ workspace: wid }) });
      const j = await res.json();
      setSeeding(false);
      if (j?.ok) {
        setSeedMsg(`Seed created runId=${j.runId}`);
        // navigate to prioritization so user can inspect
        window.location.hash = `#/workspace/${wid}/m02/prioritization`;
      } else setSeedMsg(j?.error || 'seed failed');
    }catch(e){ setSeeding(false); setSeedMsg('network error'); }
  }
  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop:16 }}>Module 2  Home</h2>
        </div>
        <div style={{ fontSize:12, color:'#555' }}>Quick access to Module 2 features.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/upload`)}>Upload</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/upload-wizard`)}>Upload Wizard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/leads`)}>Leads</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/merged`)}>Merged List</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/merge-columns`)}>Merge Columns</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/generate`)}>Generate Intent Scores</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/prioritization`)}>Prioritization Dashboard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/behavior`)}>Behavior Timeline</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/segment-behavior`)}>Segment Behavior Dashboard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/intent-forecast`)}>Intent Forecast</button>
          <button className="btn-secondary btn-sm" onClick={seedDemo} disabled={seeding}>{seeding ? 'Seeding' : 'Seed demo data'}</button>
        </div>
        {seedMsg && <div style={{ marginTop:8, fontSize:13 }}>{seedMsg}</div>}
      </main>
    </Layout>
  )
}

