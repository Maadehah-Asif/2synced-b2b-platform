import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getOpenIdFromHash(){
  const m = window.location.hash.match(/open=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

export default function MergedListM02(){
  const [workspace] = useState<string|null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt_desc'|'createdAt_asc'|'name_asc'|'name_desc'>('createdAt_desc');
  const [message, setMessage] = useState<string| null>(null);
  const [details, setDetails] = useState<any|null>(null);
  const [openId] = useState<string | null>(() => getOpenIdFromHash());

  useEffect(() => { fetchList(); }, [workspace, sort]);
  const setPreviewReturn = () => {
    try { sessionStorage.setItem('m02_preview_return', window.location.hash || ''); } catch (e) { /* ignore */ }
  };
  useEffect(() => {
    if (!openId || items.length === 0) return;
    const match = items.find((it:any) => String(it._id) === String(openId));
    if (match) {
      (async () => {
        const res = await fetch(`${API_URL}/m01/merges/${match._id}?workspace=${workspace}`);
        const j = await res.json();
        if (j?.ok) setDetails(j.item);
      })();
    }
  }, [openId, items]);

  async function fetchList(){
    if (!workspace) { setMessage('Workspace required'); return; }
    try{
      const res = await fetch(`${API_URL}/m01/merges?workspace=${workspace}&sort=${sort}${q?`&q=${encodeURIComponent(q)}`:''}`);
      const j = await res.json();
      if (j?.ok) setItems(j.items || []); else setMessage(j?.error || 'failed to load');
    }catch(e){ setMessage('network error'); }
  }

  const sorted = useMemo(() => items, [items]);

  return (
    <Layout>
      <div className="p-20">
        <div className="mb-12" style={{ display: 'flex', alignItems: 'center' }}>
          <ModuleBackButton toSuffix="/m02" />
          <h2 style={{ margin: 0 }}>Module 02 - Merged CSVs</h2>
        </div>
        <div className="mt-8" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input placeholder="Search name or filename" value={q} onChange={(e)=>setQ(e.target.value)} />
          <button onClick={fetchList}>Search</button>
          <select value={sort} onChange={(e)=> setSort(e.target.value as any)}>
            <option value="createdAt_desc">Newest first</option>
            <option value="createdAt_asc">Oldest first</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>
        {message && <div className="mt-8 muted">{message}</div>}
        <ul className="mt-12">
          {sorted.map((m:any) => (
            <li key={m._id} className="list-item">
              <div className="meta">
                <strong>{m.name || m.filename}</strong> — {new Date(m.createdAt).toLocaleString()} — by {m.createdBy?.fullName || m.createdBy?.email || 'Unknown'}
              </div>
              <div>
                <button
                  type="button"
                  className="ml-6"
                  onClick={() => {
                    setPreviewReturn();
                    if (workspace) window.location.hash = `#/workspace/${workspace}/m02/merged/preview/${m._id}`; else window.location.hash = `#/m02/merged/preview/${m._id}`;
                  }}
                >Preview</button>
                <button
                  type="button"
                  className="ml-6"
                  onClick={async () => {
                    const res = await fetch(`${API_URL}/m01/merges/${m._id}?workspace=${workspace}`);
                    const j = await res.json();
                    if (j?.ok) setDetails(j.item); else setMessage('failed to load details');
                  }}
                >
                  Details
                </button>
              </div>
            </li>
          ))}
        </ul>

        {details && (
          <div className="modal-overlay" onClick={() => setDetails(null)}>
            <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
              <h3>Merged file details</h3>
              <div><strong>Name:</strong> {details.name || details.filename}</div>
              <div><strong>Created by:</strong> {details.createdBy?.fullName || details.createdBy?.email || 'Unknown'}</div>
              <div><strong>Created at:</strong> {new Date(details.createdAt).toLocaleString()}</div>
              <div><strong>Constituent uploads:</strong>
                <ul>
                  {(details.uploadIds || []).map((id:string, i:number) => (
                    <li key={id}>{id} — {details.uploadNames?.[i] || ''}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-12"><button type="button" onClick={() => setDetails(null)}>Close</button></div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

