import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function StageList(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(()=>{ fetchList(); }, [workspace, search]);

  async function fetchList(){
    if(!workspace) return setMessage('workspace required');
    setLoading(true); setMessage(null);
    try{
      const params = new URLSearchParams({ workspace, search });
      const res = await fetch(`${API_URL}/m07/stages?${params.toString()}`);
      const j = await res.json();
      if(res.ok && j?.ok) setItems(j.items || []); else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
    setLoading(false);
  }

  function computeDurationDays(item:any){
    try{
      const entered = item.entered_at ? new Date(item.entered_at) : null;
      const exited = item.exited_at ? new Date(item.exited_at) : null;
      const now = new Date();
      if(entered && exited) return Math.round((exited.getTime() - entered.getTime()) / (1000*60*60*24));
      if(entered && !exited) return Math.round((now.getTime() - entered.getTime()) / (1000*60*60*24));
    }catch(e){}
    return '';
  }

  async function archive(id:string){ if(!confirm('Archive this stage record?')) return; const res = await fetch(`${API_URL}/m07/stages/${id}/archive`, { method: 'POST' }); if(res.ok) setItems(s => s.filter(x=>x._id !== id)); }
  async function remove(id:string){ if(!confirm('Delete permanently?')) return; const res = await fetch(`${API_URL}/m07/stages/${id}/permanent`, { method: 'DELETE' }); if(res.ok) setItems(s => s.filter(x=>x._id !== id)); }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m07" />
          <h2 style={{ margin: 0 }}>Module 07 - Stage History (Manage)</h2>
        </div>

        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search by lead or stage" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d0d0', width: 360 }} value={search} onChange={e=>setSearch(e.target.value)} />
            <button className="btn-primary" onClick={fetchList}>Reload</button>
            <button className="btn-ghost" onClick={()=>{ setSearch(''); fetchList(); }}>Reset</button>
          </div>
        </div>

        <div style={{ marginTop: 8, background: '#fff', borderRadius: 8, padding: 12 }}>
          {loading && <div style={{ fontSize: 12 }}>Loading...</div>}
          {message && <div className="muted">{message}</div>}
          {!loading && items.length === 0 && <div style={{ fontSize: 12 }}>No stage records found.</div>}

          {!loading && items.length > 0 && (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding:6, textAlign:'left' }}>Lead ID</th>
                  <th style={{ padding:6, textAlign:'left' }}>Stage</th>
                  <th style={{ padding:6, textAlign:'left' }}>Entered</th>
                  <th style={{ padding:6, textAlign:'left' }}>Exited</th>
                  <th style={{ padding:6, textAlign:'left' }}>Status</th>
                  <th style={{ padding:6, textAlign:'left' }}>Duration (days)</th>
                  <th style={{ padding:6, textAlign:'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it=> (
                  <tr key={it._id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding:8 }}>{it.lead_id}</td>
                    <td style={{ padding:8 }}>{it.stage_name}</td>
                    <td style={{ padding:8 }}>{it.entered_at ? new Date(it.entered_at).toLocaleDateString() : ''}</td>
                    <td style={{ padding:8 }}>{it.exited_at ? new Date(it.exited_at).toLocaleDateString() : ''}</td>
                    <td style={{ padding:8 }}>{it.stage_status}</td>
                    <td style={{ padding:8 }}>{computeDurationDays(it)}</td>
                    <td style={{ padding:8 }}>
                      <button className="btn-ghost" onClick={()=>{ if(workspace) window.location.hash = `#/workspace/${workspace}/m07/stages/${it._id}`; else window.location.hash = `#/m07/stages/${it._id}`; }}>View</button>
                      <button className="btn-ghost" style={{ marginLeft:8 }} onClick={()=>archive(it._id)}>Archive</button>
                      <button className="btn-ghost" style={{ marginLeft:8 }} onClick={()=>remove(it._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
