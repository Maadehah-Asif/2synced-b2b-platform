import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function StageDetail(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [item, setItem] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(()=>{
    const hash = window.location.hash || '';
    const parts = hash.split('/');
    const id = parts[parts.length-1];
    if(id) fetchItem(id);
  }, []);

  async function fetchItem(id:string){
    try{
      const res = await fetch(`${API_URL}/m07/stages/${encodeURIComponent(id)}`);
      const j = await res.json();
      if(res.ok && j?.ok) setItem(j.item); else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
  }

  async function save(){
    if(!item) return;
    try{
      const res = await fetch(`${API_URL}/m07/stages/${item._id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(item) });
      const j = await res.json();
      if(res.ok && j?.ok){ setItem(j.item); setMessage('Saved'); } else setMessage(j?.error || 'save failed');
    }catch(e){ setMessage('network error'); }
  }

  if(!item) return (
    <Layout>
      <div className="p-20"><ModuleBackButton toSuffix="/m07/stages" /><div style={{ marginTop:12 }}>{message || 'Loading...'}</div></div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}><ModuleBackButton toSuffix="/m07/stages" /><h2 style={{ margin:0 }}>Stage Record</h2></div>
        <div style={{ marginTop:12, padding:20, background:'#fff', borderRadius:8 }}>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
            <div><label>Lead ID</label><input value={item.lead_id || ''} onChange={e=>setItem({...item, lead_id: e.target.value})} /></div>
            <div><label>Stage</label><input value={item.stage_name || ''} onChange={e=>setItem({...item, stage_name: e.target.value})} /></div>
            <div><label>Entered At</label><input type="datetime-local" value={item.entered_at ? new Date(item.entered_at).toISOString().slice(0,16) : ''} onChange={e=>setItem({...item, entered_at: e.target.value})} /></div>
            <div><label>Exited At</label><input type="datetime-local" value={item.exited_at ? new Date(item.exited_at).toISOString().slice(0,16) : ''} onChange={e=>setItem({...item, exited_at: e.target.value})} /></div>
          </div>
          <div style={{ marginTop:12, display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={save}>Save</button>
          </div>
        </div>
        {message && <div style={{ marginTop:12 }} className="muted">{message}</div>}
      </div>
    </Layout>
  );
}
