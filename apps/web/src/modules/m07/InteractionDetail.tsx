import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function InteractionDetail(){
  const workspace = getWorkspaceIdFromHash();
  const [doc, setDoc] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(()=>{ const id = window.location.hash.split('/').pop(); if(id) fetchDoc(id); }, []);

  async function fetchDoc(id: string){
    try{
      const res = await fetch(`${API_URL}/m07/interactions/${id}`);
      const j = await res.json();
      setDoc(j);
    }catch(e){ setMessage('network error'); }
  }

  async function save(){
    if(!doc || !doc._id) return;
    try{
      const res = await fetch(`${API_URL}/m07/interactions/${doc._id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(doc) });
      const j = await res.json();
      if(j?.error) setMessage(j.error); else setMessage('Saved');
    }catch(e){ setMessage('network error'); }
  }

  async function removePermanent(){
    if(!doc || !doc._id) return;
    try{
      const res = await fetch(`${API_URL}/m07/interactions/${doc._id}/permanent`, { method: 'DELETE' });
      const j = await res.json();
      if(j?.ok) { setMessage('Deleted'); window.location.hash = workspace ? `#/workspace/${workspace}/m07/interactions` : '#/m07/interactions'; }
      else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
  }

  if(!doc) return (
    <Layout>
      <div className="p-20">
        <ModuleBackButton toSuffix="/m07/interactions" />
        <div style={{ marginTop: 12 }}>Loading...</div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ModuleBackButton toSuffix="/m07/interactions" />
          <h2 style={{ margin: 0 }}>Interaction Detail</h2>
        </div>

        <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>Lead ID</label>
            <input value={doc.lead_id || ''} onChange={e => setDoc((d:any)=>({ ...d, lead_id: e.target.value }))} />

            <label>Timestamp</label>
            <input value={doc.timestamp ? new Date(doc.timestamp).toISOString().slice(0,19).replace('T',' ') : ''} onChange={e => setDoc((d:any)=>({ ...d, timestamp: e.target.value }))} />

            <label>Interaction Type</label>
            <input value={doc.interaction_type || ''} onChange={e => setDoc((d:any)=>({ ...d, interaction_type: e.target.value }))} />

            <label>Channel</label>
            <input value={doc.channel || ''} onChange={e => setDoc((d:any)=>({ ...d, channel: e.target.value }))} />

            <label>Outcome</label>
            <input value={doc.outcome || ''} onChange={e => setDoc((d:any)=>({ ...d, outcome: e.target.value }))} />

            <label>Engagement Score</label>
            <input value={doc.engagement_score ?? ''} onChange={e => setDoc((d:any)=>({ ...d, engagement_score: Number(e.target.value) }))} />

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={save}>Save</button>
              <button className="btn-ghost" onClick={removePermanent}>Delete Permanently</button>
            </div>
            {message && <div className="muted">{message}</div>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
