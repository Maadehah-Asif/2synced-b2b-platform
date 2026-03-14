import { useEffect, useState } from 'react'; 
import Layout from '../../components/Layout';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

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
  let start = Math.max(1, page - Math.floor(windowSize/2));
  if (start === 0) start = 1;
  const pages = [] as number[];
  for (let i = 0; i < windowSize; i++) pages.push(start + i);

  const btnStyle = {
    background: '#0f4258',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer'
  };

  return (
    <span className="pagination">
      {start > 1 && (
        <button type="button" className="page-btn" style={btnStyle} onClick={() => onPage(1)}>1</button>
      )}
      {start > 2 && <span className="mx-8 muted">...</span>}
      {pages.map(p => (
        <button 
          key={p}
          type="button"
          className={`page-btn ${p === page ? 'active' : ''}`}
          style={btnStyle}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {hasMore && <>
        <button type="button" className="page-btn" style={btnStyle} onClick={() => onPage(pages[pages.length-1] + 1)}>
          {pages[pages.length-1] + 1}
        </button>
        <span className="mx-8 muted">...</span>
      </>}
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
    if(!previewId) return setMessage('No file selected');
    fetchPage(page, perPage);
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
      try { j = await res.json(); } catch (_) {
        const txt = await res.text().catch(() => 'Unable to parse response');
        setMessage(`Preview error: ${txt}`);
        return;
      }
      if(res.ok && j?.ok){
        setHeader(j.header || null);
        setRows(j.rows || null);
        setPage(p);
        setPerPage(pp);
        setHasMore(Boolean(j.hasMore));
      } else {
        setMessage(j?.error || `Preview failed (status ${res.status})`);
      }
    }catch(e){ setMessage('Preview error'); }
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

  const btn = {
    background: '#0f4258',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer'
  };

  return (
    <Layout>
      <div className="p-20">

        {/* BACK BUTTON — DEFAULT STYLE RESTORED */}
        <div className="mb-12" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn-ghost" onClick={goBack}>Back</button>
          <h2 style={{ margin: 0 }}>Preview {kind === 'merged' ? 'Merged' : (kind==='leads' ? 'Leads Code' : 'Upload')}</h2>
        </div>

        {message && <div className="mt-8 muted">{message}</div>}

        <div className="mt-8 mb-8">
          <label>Per page: 
            <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <button type="button" className="ml-8" style={btn} disabled={page <= 1} 
            onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>
            Prev
          </button>

          <span className="mx-8">&nbsp;</span>

          <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />

          <span className="mx-8">&nbsp;</span>

          <button type="button" style={btn} disabled={!hasMore} 
            onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>
            Next
          </button>

          <button type="button" className="ml-8" style={btn} onClick={() => fetchPage(page, perPage)}>Retry</button>
          <button type="button" className="ml-8" style={btn} onClick={() => setIsFullscreen(true)}>Zoom</button>
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
                      <tr key={i} className={selected ? 'row-selected' : ''} 
                        onClick={() => setSelectedRow(selected ? null : displayIndex)}>
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
                <label>Per page: 
                  <select value={perPage} onChange={(e) => { const v = Number(e.target.value); fetchPage(1, v); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>

                <button type="button" className="ml-8" style={btn} disabled={page <= 1} 
                  onClick={() => { const np = Math.max(1, page - 1); fetchPage(np, perPage); }}>
                  Prev
                </button>

                <span className="mx-8">&nbsp;</span>

                <Pagination page={page} hasMore={hasMore} onPage={(np:number)=>fetchPage(np, perPage)} />

                <span className="mx-8">&nbsp;</span>

                <button type="button" style={btn} disabled={!hasMore} 
                  onClick={() => { const np = page + 1; fetchPage(np, perPage); }}>
                  Next
                </button>

                <button type="button" className="ml-8" style={btn} onClick={() => fetchPage(page, perPage)}>Retry</button>
                <button type="button" className="ml-8" style={btn} onClick={() => setIsFullscreen(false)}>Close</button>
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
                            <tr key={i} className={selected ? 'row-selected' : ''} 
                              onClick={() => setSelectedRow(selected ? null : displayIndex)}>
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
