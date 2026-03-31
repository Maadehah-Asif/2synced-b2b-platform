import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import '../../styles/dataPreview.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getKindAndIdFromHash(): { kind: 'upload' | 'merged' | 'leads', id: string | null }{
  const h = window.location.hash;
  let m = h.match(/#\/workspace\/[^^\/]+\/m02\/upload\/preview\/([^\?\/]+)/i) || h.match(/#\/m02\/upload\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'upload', id: m[1] };
  m = h.match(/#\/workspace\/[^^\/]+\/m02\/merged\/preview\/([^\?\/]+)/i) || h.match(/#\/m02\/merged\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'merged', id: m[1] };
  m = h.match(/#\/workspace\/[^^\/]+\/m02\/leads\/preview\/([^\?\/]+)/i) || h.match(/#\/m02\/leads\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'leads', id: m[1] };
  return { kind: 'upload', id: null };
}

function Pagination({ page, hasMore, onPage }: { page: number, hasMore: boolean, onPage: (n:number)=>void }){
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  if (start === 0) start = 1;
  const pages: number[] = [];
  for (let i = 0; i < windowSize; i++) pages.push(start + i);

  return (
    <span className="pagination">
      {start > 1 && (
        <button type="button" className="page-btn" onClick={() => onPage(1)}>1</button>
      )}
      {start > 2 && <span className="mx-8 muted">...</span>}
      {pages.map(p => (
        <button
          key={p}
          type="button"
          className={`page-btn ${p === page ? 'active' : ''}`}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {hasMore && (
        <>
          <button type="button" className="page-btn" onClick={() => onPage(pages[pages.length - 1] + 1)}>
            {pages[pages.length - 1] + 1}
          </button>
          <span className="mx-8 muted">...</span>
        </>
      )}
    </span>
  );
}

export default function UploadPreviewM02(){
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
    if (!previewId) return setMessage('No file selected');
    fetchPage(page, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);

  async function fetchPage(p: number, pp: number){
    if (!previewId) return;
    setMessage(null);
    setRows(null);
    try{
      const path = kind === 'merged' ? 'merges' : (kind === 'leads' ? 'leads' : 'uploads');
      const res = await fetch(`${API_URL}/m01/${path}/${previewId}/preview?page=${p}&perPage=${pp}&workspace=${workspace}`);
      if (res.status === 404) {
        setMessage('File not found in storage');
        return;
      }
      let j: any = null;
      try {
        j = await res.json();
      } catch (_) {
        const txt = await res.text().catch(() => 'Unable to parse response');
        setMessage(`Preview error: ${txt}`);
        return;
      }
      if (res.ok && j?.ok) {
        setHeader(j.header || null);
        setRows(j.rows || null);
        setPage(p);
        setPerPage(pp);
        setHasMore(Boolean(j.hasMore));
      } else {
        setMessage(j?.error || `Preview failed (status ${res.status})`);
      }
    }catch(e){
      setMessage('Preview error');
    }
  }

  function goBack(){
    try {
      const prev = sessionStorage.getItem('m02_preview_return');
      sessionStorage.removeItem('m02_preview_return');
      if (prev) {
        window.location.hash = prev;
        return;
      }
    } catch (_) {}
    if (kind === 'merged') {
      window.location.hash = workspace ? `#/workspace/${workspace}/m02/merged` : '#/m02/merged';
    } else if (kind === 'leads') {
      window.location.hash = workspace ? `#/workspace/${workspace}/m02/leads` : '#/m02/leads';
    } else {
      window.location.hash = workspace ? `#/workspace/${workspace}/m02/upload` : '#/m02/upload';
    }
  }

  const previewTitle = kind === 'merged' ? 'Merged Dataset' : (kind === 'leads' ? 'Intent Lead Records' : 'Uploaded File');
  const previewType = kind === 'merged' ? 'Merged' : (kind === 'leads' ? 'Leads' : 'Upload');

  return (
    <Layout>
      <div className="p-20 data-preview-page">
        <div className="data-preview-hero">
          <div className="data-preview-hero-copy">
            <div className="data-preview-kicker">
              {kind === 'merged' ? 'Merged Preview' : (kind === 'leads' ? 'Intent Leads Preview' : 'Upload Preview')}
            </div>
            <div className="mb-12" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" className="btn-ghost" onClick={goBack}>Back</button>
            </div>
            <h2 className="data-preview-title">Preview {previewTitle}</h2>
            <p className="data-preview-subtitle">
              Review parsed rows before continuing. Check that intent and behavior data looks correct,
              inspect headers and values page by page, and use zoom when you need a wider working view.
            </p>
          </div>
          <div className="data-preview-hero-side">
            <div className="data-preview-stat">
              <span className="data-preview-stat-label">Dataset Type</span>
              <strong>{previewType}</strong>
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
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>
                Prev
              </button>
              <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />
              <button type="button" className="btn-ghost" disabled={!hasMore} onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>
                Next
              </button>
            </div>
            <button type="button" className="btn-ghost" onClick={() => fetchPage(page, perPage)}>Retry</button>
            <button type="button" className="btn-primary" onClick={() => setIsFullscreen(true)}>Zoom</button>
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
              <div className="font-700">Preview {previewTitle}</div>
              <div>
                <label>Per page: <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select></label>
                <button type="button" className="ml-8" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>Prev</button>
                <span className="mx-8">&nbsp;</span>
                <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />
                <span className="mx-8">&nbsp;</span>
                <button type="button" disabled={!hasMore} onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>Next</button>
                <button type="button" className="ml-8" onClick={() => fetchPage(page, perPage)}>Retry</button>
                <button type="button" className="ml-8" onClick={() => setIsFullscreen(false)}>Close</button>
              </div>
            </div>

            <div className="fullscreen-body">
              {header && rows ? (
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
              ) : (
                <div className="p-18">Loading...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
