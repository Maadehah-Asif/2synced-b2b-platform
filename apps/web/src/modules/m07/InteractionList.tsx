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
};

export default function InteractionList(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(()=>{ fetchList(); }, [workspace]);

  async function fetchList(){
    if(!workspace) return setMessage('workspace required');
    setLoading(true); setMessage(null);
    try{
      const params = new URLSearchParams({ workspace_id: workspace });
      const res = await fetch(`${API_URL}/m07/interactions?${params.toString()}`);
      const j = await res.json();
      setItems(j || []);
    }catch(e){ setMessage('network error'); }
    setLoading(false);
  }

  async function archive(id: string){
    try{
      const res = await fetch(`${API_URL}/m07/interactions/${id}/archive`, { method: 'POST' });
      const j = await res.json();
      if(j?.ok) setItems(s => s.filter(x => x._id !== id)); else setMessage(j?.error || 'failed');
    }catch(e){ setMessage('network error'); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" />
          <h2 style={{ margin: 0 }}>Module 07 - Interactions (Manage)</h2>
        </div>

        <div style={{ marginTop: 18, background: '#fff', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnPrimary} onClick={fetchList}>Reload</button>
            <button style={btnGhost} onClick={()=>{ window.location.hash = workspace ? `#/workspace/${workspace}/m07/interactions/upload` : '#/m07/interactions/upload' }}>Add / Upload</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ fontSize: 12 }}>Loading...</div>}
          {message && <div className="muted">{message}</div>}
          {!loading && items.length === 0 && <div style={{ fontSize: 12 }}>{workspace ? 'No interactions found.' : 'Open a workspace to view interactions.'}</div>}

          {!loading && items.length > 0 && (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>Lead ID</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Timestamp</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Type</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Channel</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Outcome</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Score</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it._id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{it.lead_id}</td>
                    <td style={{ padding: 8 }}>{it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}</td>
                    <td style={{ padding: 8 }}>{it.interaction_type}</td>
                    <td style={{ padding: 8 }}>{it.channel || ''}</td>
                    <td style={{ padding: 8 }}>{it.outcome || ''}</td>
                    <td style={{ padding: 8 }}>{it.engagement_score ?? ''}</td>
                    <td style={{ padding: 8 }}>
                      <button style={{ marginRight: 8, ...btnGhost }} onClick={() => { if (workspace) window.location.hash = `#/workspace/${workspace}/m07/interactions/${it._id}`; else window.location.hash = `#/m07/interactions/${it._id}`; }}>View</button>
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
