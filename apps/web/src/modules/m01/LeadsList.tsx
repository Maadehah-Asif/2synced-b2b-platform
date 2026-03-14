import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

import { getWorkspaceIdFromHash } from '../../utils/workspace';

export default function LeadsList(){
  const [workspace] = useState<string|null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt_desc'|'createdAt_asc'|'name_asc'|'name_desc'>('createdAt_desc');
  const [message, setMessage] = useState<string| null>(null);
  const [retryAction, setRetryAction] = useState<null | (() => void)>(null);
  const [details, setDetails] = useState<any|null>(null);
  const [mergedOptions, setMergedOptions] = useState<any[]>([]);
  const [selMerged, setSelMerged] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => { fetchList(); fetchMerged(); }, [workspace, sort]);
  const setPreviewReturn = () => {
    try { sessionStorage.setItem('m01_preview_return', window.location.hash || ''); } catch (e) { /* ignore */ }
  };

  async function fetchList(){
    if (!workspace) { setMessage('Workspace required'); return; }
    try{
      const res = await fetch(`${API_URL}/m01/leads?workspace=${workspace}&sort=${sort}${q?`&q=${encodeURIComponent(q)}`:''}`);
      const j = await res.json();
      if (j?.ok) setItems(j.items || []); else setMessage(j?.error || 'failed to load');
    }catch(e){ setMessage('network error'); }
  }

  async function fetchMerged(){
    if (!workspace) return;
    try{
      const res = await fetch(`${API_URL}/m01/merges?workspace=${workspace}&sort=createdAt_desc`);
      const j = await res.json();
      if (j?.ok) setMergedOptions(j.items || []);
    }catch(e){ /* ignore */ }
  }

  async function createLeads(){
    if (!workspace) { setMessage('Workspace required'); return; }
    if (!selMerged) { setMessage('Select a merged CSV'); return; }
    setRetryAction(null);
    setCreating(true);
    setMessage(null);
    try{
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/m01/leads/generate`,{
        method:'POST',
        headers: { 'Content-Type': 'application/json', ...(token?{ Authorization: `Bearer ${token}`}: {}) },
        body: JSON.stringify({ workspace, mergedId: selMerged, name: newName })
      });
      const j = await res.json();
      if (j?.ok) { setNewName(''); setSelMerged(''); await fetchList(); }
      else { setMessage(j?.error || 'failed to generate'); setRetryAction(()=>createLeads); }
    }catch(e){ setMessage('network error'); setRetryAction(()=>createLeads); }
    setCreating(false);
  }

  // Back navigation now handled by ModuleBackButton (to module home)

  const sorted = useMemo(() => items, [items]);

  return (
    <Layout>
      <div className="p-20">
        <div className="mb-12" style={{ display: 'flex', alignItems: 'center' }}>
          <ModuleBackButton toSuffix="/m01" />
          <h2 style={{ margin: 0 }}>Leads Code CSVs</h2>
        </div>

        {/* Create new Leads Code */}
        <div className="card p-12 mt-12" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <strong>Add Leads Code</strong>
          <input placeholder="Name (optional)" value={newName} onChange={(e)=>setNewName(e.target.value)} />
          <select value={selMerged} onChange={(e)=>setSelMerged(e.target.value)} style={{ minWidth: 280 }}>
            <option value="">Select a merged CSV…</option>
            {mergedOptions.map((m:any) => (
              <option key={m._id} value={m._id}>{m.name || m.filename}</option>
            ))}
          </select>
          <button className="btn-primary" disabled={creating || !selMerged} onClick={createLeads}>{creating?'Creating…':'Create'}</button>
        </div>

        <div className="mt-8" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input placeholder="Search name or filename" value={q} onChange={(e)=>setQ(e.target.value)} />
          <button onClick={fetchList}>Search</button>
          <select value={sort} onChange={(e)=> setSort(e.target.value as any)}>
            <option value="createdAt_desc">Newest first</option>
            <option value="createdAt_asc">Oldest first</option>
            <option value="name_asc">Name A→Z</option>
            <option value="name_desc">Name Z→A</option>
          </select>
        </div>
        {message && (
          <div className="mt-8 muted" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span>{message}</span>
            {retryAction && <button className="btn-ghost btn-sm" onClick={retryAction}>Retry</button>}
          </div>
        )}
        <ul className="mt-12">
          {sorted.map((m:any) => (
            <li key={m._id} className="list-item">
              <div className="meta">
                <strong>{m.name || m.filename}</strong> — {new Date(m.createdAt).toLocaleString()}
              </div>
              <div>
                <button
                  type="button"
                  className="ml-6"
                  onClick={() => {
                    setPreviewReturn();
                    if (workspace) window.location.hash = `#/workspace/${workspace}/m01/leads/preview/${m._id}`; else window.location.hash = `#/m01/leads/preview/${m._id}`;
                  }}
                >Preview</button>
                <button type="button" className="ml-6" onClick={async () => {
                  const res = await fetch(`${API_URL}/m01/leads/${m._id}?workspace=${workspace}`);
                  const j = await res.json();
                  if (j?.ok) setDetails(j.item); else setMessage('failed to load details');
                }}>⋯</button>
              </div>
            </li>
          ))}
        </ul>

        {details && (
          <div className="modal-overlay" onClick={() => setDetails(null)}>
            <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
              <h3>Leads Code details</h3>
              <div><strong>Name:</strong> {details.name || details.filename}</div>
              <div><strong>Created by:</strong> {details.createdBy?.fullName || details.createdBy?.email || 'Unknown'}</div>
              <div><strong>Created at:</strong> {new Date(details.createdAt).toLocaleString()}</div>
              <div><strong>Source merged:</strong> {details.mergedId}</div>
              <div className="mt-12"><button type="button" onClick={() => setDetails(null)}>Close</button></div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
