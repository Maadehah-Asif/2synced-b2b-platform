import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function LeadDetail(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [id, setId] = useState<string | null>(null);
  const [item, setItem] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const m = window.location.hash.match(/#\/workspace\/(.+?)\/m07\/leads\/(.+)/);
    if(m) setId(m[2]);
    else {
      const m2 = window.location.hash.match(/#\/m07\/leads\/(.+)/);
      if(m2) setId(m2[1]);
    }
  }, []);

  useEffect(() => { if(id) fetchItem(); }, [id]);

  async function fetchItem(){
    try{
      const res = await fetch(`${API_URL}/m07/leads/${id}`);
      const j = await res.json();
      if(j?.ok) setItem(j.item); else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
  }

  async function save(){
    if(!id || !item) return;
    try{
      const res = await fetch(`${API_URL}/m07/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      const j = await res.json();
      if(j?.ok) { setItem(j.item); setMessage('Saved'); } else setMessage(j?.error || 'save failed');
    }catch(e){ setMessage('network error'); }
  }

  if(!id) return <Layout><div className="p-20">Missing id</div></Layout>;

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m07/leads" />
          <h2 style={{ margin: 0 }}>Lead Details</h2>
        </div>

        {message && <div className="muted">{message}</div>}

        {item ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input value={item.lead_id || ''} readOnly />
              <input value={item.full_name || ''} onChange={(e)=> setItem({ ...item, full_name: e.target.value })} />
              <input value={item.company || ''} onChange={(e)=> setItem({ ...item, company: e.target.value })} />
              <input value={item.source || ''} onChange={(e)=> setItem({ ...item, source: e.target.value })} />
              <input value={item.owner || ''} onChange={(e)=> setItem({ ...item, owner: e.target.value })} />
              <input value={item.lead_score ?? ''} onChange={(e)=> setItem({ ...item, lead_score: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={save} style={{ padding: '8px 12px' }}>Save</button>
            </div>
          </div>
        ) : <div style={{ marginTop: 12 }}>Loading...</div>}
      </div>
    </Layout>
  );
}
