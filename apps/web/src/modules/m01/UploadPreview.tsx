/**
 * Module: Lead Quality & Scoring (m01)
 * Layer: Frontend
 * File: UploadPreview.tsx
 * Purpose: Supports the U pl oa dP re vi ew flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import '../../styles/dataPreview.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

import { getWorkspaceIdFromHash } from '../../utils/workspace';

function getKindAndIdFromHash(): { kind: 'upload' | 'merged' | 'leads', id: string | null }{
  const h = window.location.hash;
  // support both path-style with workspace prefix and older root-style
  let m = h.match(/#\/workspace\/[^^\/]+\/m01\/upload\/preview\/([^\?\/]+)/i) || h.match(/#\/m01\/upload\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'upload', id: m[1] };
  m = h.match(/#\/workspace\/[^^\/]+\/m01\/merged\/preview\/([^\?\/]+)/i) || h.match(/#\/m01\/merged\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'merged', id: m[1] };
  m = h.match(/#\/workspace\/[^^\/]+\/m01\/leads\/preview\/([^\?\/]+)/i) || h.match(/#\/m01\/leads\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'leads', id: m[1] };
  return { kind: 'upload', id: null };
}

function Pagination({ page, hasMore, onPage }: { page: number, hasMore: boolean, onPage: (n:number)=>void }){
  // show up to 5 pages, centered on current page when possible
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize/2));
  // if near the start, ensure we show from 1
  if (start === 0) start = 1;
  const pages = [] as number[];
  for (let i = 0; i < windowSize; i++) pages.push(start + i);

  return (
    <span className="pagination">
      {start > 1 && (
        <button type="button" className="page-btn" onClick={() => onPage(1)}>1</button>
      )}
      {start > 2 && <span className="mx-8 muted">...</span>}
      {pages.map(p => (
        <button key={p} type="button" className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onPage(p)}>{p}</button>
      ))}
      {hasMore && <>
        <button type="button" className="page-btn" onClick={() => onPage(pages[pages.length-1] + 1)}>{pages[pages.length-1] + 1}</button>
        <span className="mx-8 muted">...</span>
      </>}
    </span>
  );
}

export default function UploadPreview(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [{ kind, id: previewId }] = useState(() => getKindAndIdFromHash());
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(20);
  const [header, setHeader] = useState<string[] | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    if(!previewId) return setMessage('No file selected');
    fetchPage(page, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);

  async function fetchPage(p: number, pp: number){
    if(!previewId) return;
    setMessage(null);
    setRows(null);
    try{
  const path = kind === 'merged' ? 'merges' : (kind === 'leads' ? 'leads' : 'uploads');
      const res = await fetch(`${API_URL}/m01/${path}/${previewId}/preview?page=${p}&perPage=${pp}&workspace=${workspace}`);
      if(res.status === 404){ setMessage('File not found in storage'); return; }
      let j: any = null;
      try { j = await res.json(); } catch (err) {
        const txt = await res.text().catch(() => 'Unable to parse response');
        setMessage(`Preview error: ${txt}`);
        return;
      }
  if(res.ok && j?.ok){ setHeader(j.header || null); setRows(j.rows || null); setPage(p); setPerPage(pp); setHasMore(Boolean(j.hasMore)); }
      else {
        setMessage(j?.error || `Preview failed (status ${res.status})`);
      }
    }catch(e){ setMessage('Preview error'); }
  }

  return (
    <Layout>
      <div className="p-20 data-preview-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix={kind === 'merged' ? '/m01/merged' : kind === 'leads' ? '/m01/leads' : '/m01/upload'} />
        </div>
        <div className="data-preview-hero">
          <div className="data-preview-hero-copy">
            <div className="data-preview-kicker">
              {kind === 'merged' ? 'Merged Preview' : (kind === 'leads' ? 'Lead Records Preview' : 'Upload Preview')}
            </div>
            <h2 className="data-preview-title">
              Preview {kind === 'merged' ? 'Merged Dataset' : (kind==='leads' ? 'Lead Records' : 'Uploaded File')}
            </h2>
            <p className="data-preview-subtitle">
              Review parsed rows before continuing. Use pagination to inspect batches, zoom for wider tables,
              and verify that headers and values look correct before moving to the next module step.
            </p>
          </div>
          <div className="data-preview-hero-side">
            <div className="data-preview-stat">
              <span className="data-preview-stat-label">Dataset Type</span>
              <strong>{kind === 'merged' ? 'Merged' : (kind==='leads' ? 'Leads' : 'Upload')}</strong>
            </div>
            <div className="data-preview-stat">
              <span className="data-preview-stat-label">Current Page</span>
              <strong>{page}</strong>
            </div>
            <div className="data-preview-stat">
              <span className="data-preview-stat-label">Visible Columns</span>
              <strong>{header?.length ?? 0}</strong>
            </div>
          </div>
        </div>

        {message && <div className="data-preview-message">{message}</div>}

        <div className="data-preview-controls">
          <div className="data-preview-controls-left">
            <div className="data-preview-field">
              <span className="data-preview-label">Rows Per Page</span>
              <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="data-preview-controls-right">
            <div className="data-preview-pagination">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>Prev</button>
              <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />
              <button type="button" className="btn-ghost" disabled={!hasMore} onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>Next</button>
            </div>
            <button type="button" className="btn-ghost" onClick={() => fetchPage(page, perPage)}>Retry</button>
            <button type="button" className="btn-ghost" onClick={() => setIsFullscreen(true)}>Zoom</button>
          </div>
        </div>

        {header && rows && (
          <div className="data-preview-table-shell">
            <div className="data-preview-table-head">
              <h3 className="data-preview-table-title">Preview Table</h3>
              <div className="data-preview-table-caption">
                Click any row to highlight it while you inspect values across columns. This is a read-only
                preview of the currently loaded page.
              </div>
            </div>
            <div className="preview-table-container">
              {rows.length === 0 ? (
                <div className="data-preview-empty">No rows on this page.</div>
              ) : (
                <table className="table preview-table">
                  <thead>
                    <tr>
                      <th className="preview-rownum-header">#</th>
                      {header.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r:any, i:number) => {
                      const displayIndex = (page - 1) * perPage + i + 1;
                      const selected = selectedRow === displayIndex;
                      return (
                        <tr key={i} className={selected ? 'row-selected' : ''} onClick={() => setSelectedRow(selected ? null : displayIndex)}>
                          <td className="preview-rownum-cell">{displayIndex}</td>
                          {r.map((c:any, j:number) => <td key={j}>{c}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="data-preview-scroll-hint">
              Scroll horizontally inside the table only. Row numbers and the first data column stay pinned to make wide previews easier to scan.
            </div>
          </div>
        )}

      </div>

      {isFullscreen && (
        <div className="fullscreen-overlay data-preview-fullscreen" role="dialog" aria-modal="true">
          <div className="fullscreen-panel">
            <div className="fullscreen-header">
              <div className="font-700">Preview {kind === 'merged' ? 'Merged' : (kind==='leads' ? 'Leads Code' : 'Upload')}</div>
              <div>
                <label>Per page: <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select></label>
                <button type="button" className="btn-ghost btn-sm ml-8" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>Prev</button>
                <span className="mx-8">&nbsp;</span>
                <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />
                <span className="mx-8">&nbsp;</span>
                <button type="button" className="btn-ghost btn-sm" disabled={!hasMore} onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>Next</button>
                <button type="button" className="btn-ghost btn-sm ml-8" onClick={() => fetchPage(page, perPage)}>Retry</button>
                <button type="button" className="btn-outline btn-sm ml-8" onClick={() => setIsFullscreen(false)}>Close</button>
              </div>
            </div>
            <div className="fullscreen-body">
              {header && rows ? (
                <div className="preview-table-container">
                  {rows.length === 0 ? (
                    <div className="muted">No rows on this page.</div>
                  ) : (
                    <table className="table preview-table">
                      <thead>
                        <tr>
                          <th className="preview-rownum-header">#</th>
                          {header.map((h, i) => <th key={i}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r:any, i:number) => {
                          const displayIndex = (page - 1) * perPage + i + 1;
                          const selected = selectedRow === displayIndex;
                          return (
                            <tr key={i} className={selected ? 'row-selected' : ''} onClick={() => setSelectedRow(selected ? null : displayIndex)}>
                              <td className="preview-rownum-cell">{displayIndex}</td>
                              {r.map((c:any, j:number) => <td key={j}>{c}</td>)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="p-18">Loading…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
