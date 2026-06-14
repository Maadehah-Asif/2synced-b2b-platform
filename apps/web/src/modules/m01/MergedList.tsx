/**
 * Module: Lead Quality & Scoring (m01)
 * Layer: Frontend
 * File: MergedList.tsx
 * Purpose: Supports the M er ge dL is t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import '../../styles/dataMerged.css';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getOpenIdFromHash(){
  const m = window.location.hash.match(/open=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

export default function MergedList(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt_desc' | 'createdAt_asc' | 'name_asc' | 'name_desc'>('createdAt_desc');
  const [message, setMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [openId] = useState<string | null>(() => getOpenIdFromHash());

  useEffect(() => { fetchList(); }, [workspace, sort]);

  const setPreviewReturn = () => {
    try { sessionStorage.setItem('m01_preview_return', window.location.hash || ''); } catch (e) {}
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
  }, [openId, items, workspace]);

  async function fetchList(){
    if (!workspace) {
      setMessage('Workspace required');
      return;
    }
    try{
      const res = await fetch(`${API_URL}/m01/merges?workspace=${workspace}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      const j = await res.json();
      if (j?.ok) setItems(j.items || []);
      else setMessage(j?.error || 'failed to load');
    }catch(e){
      setMessage('network error');
    }
  }

  const sorted = useMemo(() => items, [items]);

  return (
    <Layout>
      <div className="p-20 data-merged-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m01" />
        </div>
        <div className="data-merged-hero">
          <div className="data-merged-hero-copy">
            <div className="data-merged-kicker">Merged Data</div>
            <h2 className="data-merged-title">Lead Quality Merged CSVs</h2>
            <p className="data-merged-subtitle">
              Review merged datasets created from uploaded lead files, inspect merge details, and open
              previews before continuing into downstream lead-processing workflows.
            </p>
          </div>
          <div className="data-merged-hero-side">
            <div className="data-merged-stat">
              <span className="data-merged-stat-label">Merged Files</span>
              <strong>{sorted.length}</strong>
            </div>
            <div className="data-merged-stat">
              <span className="data-merged-stat-label">Sort Order</span>
              <strong>{sort.startsWith('createdAt') ? 'By date' : 'By name'}</strong>
            </div>
          </div>
        </div>

        <div className="data-merged-toolbar">
          <div className="data-merged-field">
            <span className="data-merged-field-label">Search Merged Files</span>
            <input placeholder="Search name or filename" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="data-merged-field">
            <span className="data-merged-field-label">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="createdAt_desc">Newest first</option>
              <option value="createdAt_asc">Oldest first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={fetchList}>Search</button>
        </div>

        {message && <div className="data-merged-message">{message}</div>}

        <div className="data-merged-list-shell">
          <div className="data-merged-list-head">
            <h3 className="data-merged-list-title">Merged Dataset Library</h3>
            <div className="data-merged-list-caption">
              Open a merged dataset preview to validate the combined output, or inspect merge details to
              see who created it and which source uploads were used.
            </div>
          </div>
          <ul className="data-merged-list">
            {sorted.map((m:any) => (
              <li key={m._id} className="list-item data-merged-item">
                <div className="meta data-merged-meta">
                  <div className="data-merged-name">{m.name || m.filename}</div>
                  <div className="data-merged-detail">{new Date(m.createdAt).toLocaleString()}</div>
                  <div className="data-merged-detail">Created by {m.createdBy?.fullName || m.createdBy?.email || 'Unknown'}</div>
                </div>
                <div className="data-merged-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setPreviewReturn();
                      if (workspace) window.location.hash = `#/workspace/${workspace}/m01/merged/preview/${m._id}`;
                      else window.location.hash = `#/m01/merged/preview/${m._id}`;
                    }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      const res = await fetch(`${API_URL}/m01/merges/${m._id}?workspace=${workspace}`);
                      const j = await res.json();
                      if (j?.ok) setDetails(j.item);
                      else setMessage('failed to load details');
                    }}
                  >
                    Details
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {details && (
          <div className="modal-overlay" onClick={() => setDetails(null)}>
            <div className="modal-content data-merged-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Merged file details</h3>
              <div><strong>Name:</strong> {details.name || details.filename}</div>
              <div><strong>Created by:</strong> {details.createdBy?.fullName || details.createdBy?.email || 'Unknown'}</div>
              <div><strong>Created at:</strong> {new Date(details.createdAt).toLocaleString()}</div>
              <div><strong>Constituent uploads:</strong>
                <ul className="data-merged-modal-list">
                  {(details.uploadIds || []).map((id:string, i:number) => (
                    <li key={id}>{id} - {details.uploadNames?.[i] || ''}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-12">
                <button type="button" className="btn-primary" onClick={() => setDetails(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
