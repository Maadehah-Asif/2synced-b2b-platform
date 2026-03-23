import { useEffect, useState, type CSSProperties } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const btnPrimary: CSSProperties = {
  background: '#0f4258',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  height: 40,
  width: 120,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const btnGhost: CSSProperties = {
  background: 'transparent',
  border: '1px solid #0f4258',
  color: '#0f4258',
  padding: '8px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  height: 40,
  width: 120,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d0d0d0',
  fontSize: 13,
  height: 40,
  boxSizing: 'border-box'
};

export default function LeadList(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => { fetchList(); }, [workspace, search, showArchived]);

  async function fetchList(){
    if(!workspace) return setMessage('workspace required');
    setLoading(true); setMessage(null);
    try{
      const params = new URLSearchParams({ workspace, search, includeArchived: String(showArchived) });
      const res = await fetch(`${API_URL}/m07/leads?${params.toString()}`);
      const j = await res.json();
      if(j?.ok) setItems(j.items || []);
      else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
    setLoading(false);
  }

  async function archive(id: string){
    try{
      const res = await fetch(`${API_URL}/m07/leads/${id}/archive`, { method: 'POST' });
      const j = await res.json();
      if(j?.ok) setItems(s => s.filter(x => x._id !== id)); else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" />
          <h2 style={{ margin: 0 }}>Module 07 - Funnel Leads (Manage)</h2>
        </div>

        <div style={{ marginTop: 18, background: '#fff', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260, maxWidth: 360, flexShrink: 0 }}>
            <input style={inputStyle} placeholder="Search leads" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnPrimary} onClick={fetchList}>Reload</button>
            <button style={btnGhost} onClick={()=>{ setSearch(''); setShowArchived(false); fetchList(); }}>Reset</button>
          </div>

          <div style={{ flexGrow: 1 }} />

          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>

        <div style={{ marginTop: 20, background: '#fff', borderRadius: 8, padding: 12 }}>
          {loading && <div style={{ fontSize: 12 }}>Loading...</div>}

          {message && <div className="muted">{message}</div>}

          {!loading && items.length === 0 && (
            <div style={{ fontSize: 12 }}>{workspace ? 'No leads found.' : 'Open a workspace to view leads.'}</div>
          )}

          {!loading && items.length > 0 && (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>Lead ID</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Name</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Company</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Score</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Updated</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it._id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{it.lead_id}</td>
                    <td style={{ padding: 8 }}>{it.full_name || ''}</td>
                    <td style={{ padding: 8 }}>{it.company || ''}</td>
                    <td style={{ padding: 8 }}>{it.lead_score ?? ''}</td>
                    <td style={{ padding: 8 }}>{it.updated_at ? new Date(it.updated_at).toLocaleString() : ''}</td>
                    <td style={{ padding: 8 }}>
                      <button style={{ marginRight: 8, ...btnGhost }} onClick={() => { if (workspace) window.location.hash = `#/workspace/${workspace}/m07/leads/${it._id}`; else window.location.hash = `#/m07/leads/${it._id}`; }}>View</button>
                      <button style={btnGhost} onClick={() => archive(it._id)}>Archive</button>
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
