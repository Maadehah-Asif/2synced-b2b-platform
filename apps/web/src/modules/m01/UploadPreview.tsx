import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getWorkspaceFromHash() {
  const m = window.location.hash.match(/workspace=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

function getKindAndIdFromHash(): { kind: 'upload' | 'merged' | 'leads', id: string | null }{
  const h = window.location.hash;
  let m = h.match(/#\/m01\/upload\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'upload', id: m[1] };
  m = h.match(/#\/m01\/merged\/preview\/([^\?\/]+)/i);
  if (m) return { kind: 'merged', id: m[1] };
  m = h.match(/#\/m01\/leads\/preview\/([^\?\/]+)/i);
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
  const [workspace] = useState<string | null>(() => getWorkspaceFromHash());
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

  function goBack(){
    if(workspace) window.location.hash = `#/m01/upload?workspace=${workspace}`;
    else window.location.hash = '#/m01/upload';
  }

  return (
    <Layout>
      <div className="p-20">
          <div className="mb-12" style={{ display: 'flex', alignItems: 'center' }}>
            <ModuleBackButton toSuffix="/m01" />
            <h2 style={{ margin: 0 }}>Preview {kind === 'merged' ? 'Merged' : (kind==='leads' ? 'Leads Code' : 'Upload')}</h2>
          </div>
        {message && <div className="mt-8 muted">{message}</div>}

        <div className="mt-8 mb-8">
          <label>Per page: <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select></label>
          <button type="button" className="ml-8" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>Prev</button>
          <span className="mx-8">&nbsp;</span>
          {/* numeric pagination: show up to 5 pages centered on current */}
          <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />
          <span className="mx-8">&nbsp;</span>
          <button type="button" disabled={!hasMore} onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>Next</button>
          <button type="button" className="ml-8" onClick={() => fetchPage(page, perPage)}>Retry</button>
          <button type="button" className="ml-8" onClick={() => setIsFullscreen(true)}>Zoom</button>
        </div>

        {header && rows && (
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
        )}

      </div>

      {isFullscreen && (
        <div className="fullscreen-overlay" role="dialog" aria-modal="true">
          <div className="fullscreen-panel">
            <div className="fullscreen-header">
              <div className="font-700">Preview {kind === 'merged' ? 'Merged' : (kind==='leads' ? 'Leads Code' : 'Upload')}</div>
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
