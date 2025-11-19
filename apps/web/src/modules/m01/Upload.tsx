import { useEffect, useState } from "react";
import Layout from '../../components/Layout';
import MERGED_COLUMNS from './mergedColumns';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getWorkspaceFromHash() {
  const m = window.location.hash.match(/workspace=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

// (helper inferType removed — unused in this module)

export default function Upload(){
  function getAuthHeaders(extra: Record<string,string> = {}){
    try{
      const token = localStorage.getItem('token');
      return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
    }catch(e){ return extra; }
  }
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  // preview moved to a dedicated screen; inline preview state removed
  const [detailsItem, setDetailsItem] = useState<any|null>(null);
  const [workspace] = useState<string | null>(() => getWorkspaceFromHash());
  const [statusView, setStatusView] = useState<'active'|'archived'>('active');
  const [selectedForMerge, setSelectedForMerge] = useState<Record<string, boolean>>({});
  const [headersByUpload, setHeadersByUpload] = useState<Record<string, string[]>>({});
  // Sample rows kept local in modal; no component state needed
  // column type inference and warnings removed — treat everything as compatible
  const [headerPromotedByUpload, setHeaderPromotedByUpload] = useState<Record<string, boolean>>({});
  const [headerIndexByUpload, setHeaderIndexByUpload] = useState<Record<string, number|null>>({});
  const [useDetectedHeader, setUseDetectedHeader] = useState<Record<string, boolean>>({});
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  // legacy 'mappings' state removed; we now build mappings from mappingsByFile
  const [step, setStep] = useState<1|2>(1);
  // Casting toggle removed — all types treated permissively
  const [matchingColumns, setMatchingColumns] = useState<Record<string,string>>({});
  const [mappingsByFile, setMappingsByFile] = useState<Record<string, Array<{ source: string; target: string; customName?: string }>>>({});
  const [targetKey, setTargetKey] = useState<string>('lead_id');
  const [mergedResultId, setMergedResultId] = useState<string | null>(null);
  const [mergedName, setMergedName] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive'|'restore'|'permanent', id: string } | null>(null);

  useEffect(() => {
    if(!workspace) return setMessage('Workspace context missing');
    fetch(`${API_URL}/m01/uploads?workspace=${workspace}&status=${statusView}`, { headers: getAuthHeaders() }).then((r) => r.json()).then((j) => {
      if (j?.ok) setUploads((j.items || []).filter((it:any) => (it.status || 'active') === statusView));
    }).catch(() => {});
  }, [workspace, statusView]);

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('Workspace missing');
    if(!file) return setMessage('Please choose a file');
    setMessage('Uploading...');
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('workspace', workspace);

    try{
      const res = await fetch(`${API_URL}/m01/uploads`,{ method: 'POST', body: fd, headers: getAuthHeaders() });
      const j = await res.json();
      if(j?.ok){
        setMessage('Uploaded');
        const list = await (await fetch(`${API_URL}/m01/uploads?workspace=${workspace}&status=${statusView}`, { headers: getAuthHeaders() })).json();
        if(list?.ok) setUploads((list.items || []).filter((it:any) => (it.status || 'active') === statusView));
      } else {
        setMessage(j?.error || 'upload failed');
      }
    }catch(e){ setMessage('upload error'); }
  }

  // preview is provided on a dedicated page (UploadPreview)

  function goBack(){
    if(workspace) window.location.hash = `#/workspace/${workspace}`;
    else window.location.hash = '#/landing';
  }

  // Use an in-UI confirmation modal instead of browser confirm()
  function archiveUpload(id: string){
    setConfirmAction({ type: 'archive', id });
  }

  function restoreUpload(id: string){
    setConfirmAction({ type: 'restore', id });
  }

  function permanentDelete(id: string){
    setConfirmAction({ type: 'permanent', id });
  }

  async function performConfirmedAction(action: { type: 'archive'|'restore'|'permanent', id: string } | null){
    if(!action) return;
    const { type, id } = action;
    setConfirmAction(null);
    try{
      if(type === 'archive'){
        const res = await fetch(`${API_URL}/m01/uploads/${id}?workspace=${workspace}`, { method: 'DELETE', headers: getAuthHeaders() });
        const j = await res.json();
        if (j?.ok) setUploads((s) => s.filter(x => x._id !== id)); else setMessage(j?.error || 'archive failed');
      } else if (type === 'restore'){
        const res = await fetch(`${API_URL}/m01/uploads/${id}/restore?workspace=${workspace}`, { method: 'POST', headers: getAuthHeaders() });
        const j = await res.json();
        if (j?.ok) setUploads((s) => s.filter(x => x._id !== id)); else setMessage(j?.error || 'restore failed');
      } else if (type === 'permanent'){
        const res = await fetch(`${API_URL}/m01/uploads/${id}/permanent?workspace=${workspace}`, { method: 'DELETE', headers: getAuthHeaders() });
        const j = await res.json();
        if (j?.ok) setUploads((s) => s.filter(x => x._id !== id)); else setMessage(j?.error || 'delete failed');
      }
    }catch(e){ setMessage('action failed'); }
  }

  function toggleSelectForMerge(id: string){
    setSelectedForMerge(s => ({ ...s, [id]: !s[id] }));
  }

  async function openMergeModal(){
    // debug marker to verify this updated code runs in the browser bundle
    try { console.debug('[m01.upload] openMergeModal invoked — bundle marker v2'); } catch (e) {}
    const ids = Object.keys(selectedForMerge).filter(k => selectedForMerge[k]);
    if(ids.length < 2) {
      setMessage('Select at least 2 uploads to merge');
      return;
    }

    // open modal immediately and show loading state while we fetch previews in parallel
    setMergeOpen(true);
    setMergeLoading(true);

    // helper: fetch with timeout (longer default to avoid premature aborts for GridFS reads)
    const fetchWithTimeout = (url: string, opts: any = {}, ms = 30000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), ms);
      return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
    };

    const results = await Promise.allSettled(ids.map(async (id) => {
      try{
  const res = await fetchWithTimeout(`${API_URL}/m01/uploads/${id}/preview?page=1&perPage=6&workspace=${workspace}`, { headers: getAuthHeaders() }, 30000);
        if (res.status === 404) return { id, ok: false, error: 'missing' };
        const j = await res.json();

        // If server returned no header and no sample rows, try again requesting a wider scan
        if ((!(j.header && j.header.length > 0)) && (!j.rows || j.rows.length === 0)) {
          try {
            const res2 = await fetchWithTimeout(`${API_URL}/m01/uploads/${id}/preview?page=1&perPage=0&workspace=${workspace}`, { headers: getAuthHeaders() }, 40000);
            if (res2.status === 404) return { id, ok: false, error: 'missing' };
            const j2 = await res2.json();
            return { id, ok: true, header: j2.header || [], rows: j2.rows || [], headerPromoted: !!j2.headerPromoted, headerIndex: typeof j2.headerIndex === 'number' ? j2.headerIndex : null };
          } catch (e) {
            // fall through to return original result below
          }
        }

        return { id, ok: true, header: j.header || [], rows: j.rows || [], headerPromoted: !!j.headerPromoted, headerIndex: typeof j.headerIndex === 'number' ? j.headerIndex : null };
      }catch(err:any){
        return { id, ok: false, error: err?.message || 'fetch error' };
      }
    }));

    const hBy: Record<string,string[]> = {};
    const samplesBy: Record<string,string[][]> = {};
    const headerPromotedMap: Record<string, boolean> = {};
    const fetchErrors: string[] = [];

  const headerIndexMap: Record<string, number|null> = {};
  // collect column types from server or client inference in a local map, then set state once
  // column type hints disabled
    for (const r of results){
      if (r.status === 'fulfilled'){
        const v: any = r.value;
        if (!v.ok) {
          fetchErrors.push(`${uploads.find(u=>u._id===v.id)?.filename || v.id}: ${v.error}`);
          hBy[v.id] = [];
          samplesBy[v.id] = [];
          headerPromotedMap[v.id] = false;
          headerIndexMap[v.id] = null;
        } else {
          hBy[v.id] = v.header || [];
          samplesBy[v.id] = v.rows || [];
          headerPromotedMap[v.id] = !!v.headerPromoted;
          headerIndexMap[v.id] = typeof v.headerIndex === 'number' ? v.headerIndex : null;
          // record server-provided column types if available (store in temp map)
          // ignore server-provided columnTypes
        }
      } else {
        // rejected promise
        const reason = (r as any).reason;
        fetchErrors.push(`fetch failed: ${String(reason)}`);
      }
    }

    if (fetchErrors.length) setMessage(`Preview fetch issues: ${fetchErrors.join('; ')}`);

    // If server didn't provide headers, attempt to detect a header row from sample rows on the client
    for (const id of Object.keys(hBy)){
      if ((!hBy[id] || hBy[id].length === 0) && (samplesBy[id] || []).length > 0){
        const samples = samplesBy[id];
        // simple heuristic: find the earliest row where majority of cells contain letters (not pure numbers)
        const looksLikeHeader = (cell: string) => {
          if (!cell) return false;
          const s = String(cell).trim();
          if (s.length === 0) return false;
          // if cell is just numbers (int/float) consider it not a header
          if (/^-?\d+(?:\.\d+)?$/.test(s)) return false;
          // otherwise prefer cells with letters or typical header characters
          return /[A-Za-z_\- ]/.test(s);
        };

        let detected: string[] | null = null;
        let detectedIndex: number | null = null;
        for (let ri = 0; ri < Math.min(5, samples.length); ri++){
          const row = samples[ri] || [];
          if (row.length === 0) continue;
          const total = row.length;
          const headerLike = row.reduce((acc, c) => acc + (looksLikeHeader(c) ? 1 : 0), 0);
          if (headerLike / total >= 0.6){
            detected = row.map(c => String(c));
            detectedIndex = ri;
            break;
          }
        }

          if (detected){
          hBy[id] = detected;
          headerPromotedMap[id] = true;
          headerIndexMap[id] = detectedIndex;
          // remove detected header row from samples so type inference uses the following rows
          samplesBy[id] = samples.slice((detectedIndex || 0) + 1);
          // infer types client-side for this file (if server didn't provide them)
          // Client-side type inference disabled
          }
      }
    }
    setHeadersByUpload(hBy);
  // sample rows not stored in component state
    setHeaderPromotedByUpload(headerPromotedMap);
    setHeaderIndexByUpload(headerIndexMap);
  // initialize useDetectedHeader: default true when we have a detected header
  const ud: Record<string, boolean> = {};
  for (const id of Object.keys(hBy)) ud[id] = !!headerPromotedMap[id] || (hBy[id] && hBy[id].length > 0);
  setUseDetectedHeader(ud);
  // reset mappings handled via mappingsByFile initialization above
    // initialize matchingColumns and mappingsByFile
    const mc: Record<string,string> = {};
    const mbf: Record<string, Array<{ source: string; target: string; customName?: string }>> = {};
    const globallyUsedTargets = new Set<string>();
    for (const id of ids) {
      const hdrs = hBy[id] || [];
      // choose a best-match key heuristically
      const chooseBest = (hdr: string[], typesArr: string[]) => {
        if (!hdr || hdr.length === 0) return '';
        const lower = hdr.map(h => String(h).toLowerCase());
        // prefer email-like
        for (let i = 0; i < lower.length; i++) if (/email|e-?mail|contact/.test(lower[i])) return hdr[i];
        // prefer explicit id-like
        for (let i = 0; i < lower.length; i++) if (/\b(id|identifier|uid|lead_id|leadid)\b/.test(lower[i])) return hdr[i];
        // prefer numeric id column
        for (let i = 0; i < typesArr.length; i++) if (typesArr[i] === 'integer' && /id$/i.test(lower[i] || '')) return hdr[i];
        // fallback: first non-empty header
        for (const h of hdr) if (h && String(h).trim().length > 0) return h;
        return '';
      };
  mc[id] = chooseBest(hdrs, []);
      // initialize source-first mapping with auto-mapping defaults when names match target keys/labels
      const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetByNorm: Record<string, string> = {};
      for (const meta of MERGED_COLUMNS) {
        targetByNorm[normalize(meta.key)] = meta.key;
        targetByNorm[normalize(meta.label)] = meta.key;
      }
      const rows = hdrs.map((h) => {
        const n = normalize(h);
        const proposed = targetByNorm[n];
        // Auto-map by name only (ignore type for auto assignment). We'll still validate later.
        if (proposed && proposed !== targetKey && !globallyUsedTargets.has(proposed)) {
          globallyUsedTargets.add(proposed);
          return { source: h, target: proposed };
        }
        return { source: h, target: '__skip' };
      });
      mbf[id] = rows;
    }
    setMatchingColumns(mc);
    setMappingsByFile(mbf);
    setStep(1);
    setMergeLoading(false);
  }

  // mapping is managed per-source-column via mappingsByFile

  // Helpers for new source-first mapping UI
  const computeUsedTargets = (mbf: Record<string, Array<{ source: string; target: string }>>) => {
    const s = new Set<string>();
    for (const arr of Object.values(mbf || {})) {
      for (const m of arr) {
        if (!m) continue;
        if (m.target && m.target !== '__skip' && m.target !== '__custom') s.add(m.target);
      }
    }
    return s;
  };

  const usedTargets = computeUsedTargets(mappingsByFile);
  const allTargetKeys = MERGED_COLUMNS.map(c => c.key);

  const availableTargetsFor = (_fileId: string, current?: string) => {
    const used = new Set(usedTargets);
    // Exclude the selected targetKey from all dropdowns; it's supplied by the matching key automatically
    if (targetKey) used.add(targetKey);
    if (current && current !== '__skip' && current !== '__custom') used.delete(current);
    const keys = allTargetKeys.filter(k => !used.has(k));
    return keys.sort((a,b) => {
      const la = (MERGED_COLUMNS.find(c=>c.key===a)?.label || a).toLowerCase();
      const lb = (MERGED_COLUMNS.find(c=>c.key===b)?.label || b).toLowerCase();
      if (la < lb) return -1; if (la > lb) return 1; return a < b ? -1 : (a > b ? 1 : 0);
    });
  };

  const setMapping = (fileId: string, source: string, target: string) => {
    setMappingsByFile(prev => {
      const copy: Record<string, any[]> = { ...prev };
      copy[fileId] = (copy[fileId] || []).map(m => {
        if (m.source !== source) return m;
        if (target === '__custom' && (!m.customName || m.customName.trim() === '')) {
          // Prefill custom field name with the source column name
          return { ...m, target, customName: source };
        }
        return { ...m, target };
      });
      return copy;
    });
  };

  const setCustomName = (fileId: string, source: string, name: string) => {
    setMappingsByFile(prev => {
      const copy: Record<string, any[]> = { ...prev };
      copy[fileId] = (copy[fileId] || []).map(m => m.source === source ? { ...m, customName: name } : m);
      return copy;
    });
  };

  // Type-related helpers removed (no type checks/warnings)

  const matchingKeysCompatible = () => {
    // Simplified: matching keys are considered compatible as long as each file has a selected matching column
    for (const fid of Object.keys(mappingsByFile || {})) {
      const col = matchingColumns[fid];
      if (!col) return false;
    }
    return Object.keys(mappingsByFile || {}).length > 0;
  };

  // If targetKey changes, clear any accidental assignments to it in existing mappings
  useEffect(() => {
    setMappingsByFile(prev => {
      const copy: typeof prev = {} as any;
      for (const [fid, arr] of Object.entries(prev)){
        copy[fid] = (arr || []).map(m => (m.target === targetKey ? { ...m, target: '__skip' } : m));
      }
      return copy;
    });
  }, [targetKey]);

  // lead_id (or whichever targetKey is selected) will be populated from the matching key, not via mapping
  const REQUIRED_TARGETS = new Set<string>([]);

  const requiredTargetsSatisfied = () => {
    for (const rt of REQUIRED_TARGETS) {
      if (!usedTargets.has(rt)) return false;
    }
    for (const rt of REQUIRED_TARGETS) {
      let count = 0;
      for (const arr of Object.values(mappingsByFile)) {
        for (const m of arr) if (m.target === rt) count++;
      }
      if (count !== 1) return false;
    }
    return true;
  };

  function validateMappings(): { ok: boolean; message?: string }{
    // Ensure no duplicate assignment of the same target across files (UI enforces, but double-check)
    const seen = new Set<string>();
    for (const arr of Object.values(mappingsByFile)) {
      for (const m of arr) {
        if (!m || m.target === '__skip' || m.target === '__custom') continue;
        if (m.target === targetKey) continue; // excluded from mapping
        if (seen.has(m.target)) return { ok: false, message: `Target ${m.target} mapped more than once` };
        seen.add(m.target);
      }
    }
    return { ok: true };
  }

  function buildMappingsPayload(){
    const out: Array<{ target: string; source?: string; custom?: boolean; customName?: string }> = [];
    for (const [fid, arr] of Object.entries(mappingsByFile)){
      for (const m of arr){
        if (!m) continue;
        if (m.target === '__skip') continue;
        if (m.target === targetKey) continue; // join key set by server
        if (m.target === '__custom') {
          if (m.customName && m.customName.trim().length > 0) out.push({ target: m.customName, custom: true, customName: m.customName });
          continue;
        }
        out.push({ target: m.target, source: `${fid}::${m.source}` });
      }
    }
    return out;
  }

  async function submitMerge(){
    const ids = Object.keys(selectedForMerge).filter(k => selectedForMerge[k]);
    const v = validateMappings();
    if(!v.ok) return setMessage(v.message || 'invalid mappings');
    const finalMappings = buildMappingsPayload();
    const payload = { workspace, uploadIds: ids, mappings: finalMappings, matchingColumns, targetKey, name: mergedName };
    try{
      const res = await fetch(`${API_URL}/m01/uploads/merge`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
      const j = await res.json().catch(async () => ({ ok: false, error: await res.text() }));
      if(!res.ok || !j?.ok){ return setMessage(j?.error || 'merge failed'); }
      setMergedResultId(j.mergedId || null);
    }catch(e){ setMessage('merge error'); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div className="mb-12">
          <button type="button" className="btn-ghost" onClick={goBack}>Back</button>
        </div>

        <h2>Module 01 — Upload CSV</h2>

        <form onSubmit={handleSubmit}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit">Upload</button>
        </form>
  {message && <div className="mt-8">{message}</div>}

          <div className="mt-12 mb-8">
          <button type="button" className={`btn-ghost ${statusView==='active'?'font-700':''}`} onClick={() => setStatusView('active')}>All Uploads</button>
          <button type="button" className={`btn-ghost ml-8 ${statusView==='archived'?'font-700':''}`} onClick={() => setStatusView('archived')}>Archive</button>
          <button
            type="button"
            className="btn-primary ml-12"
            onClick={openMergeModal}
            disabled={Object.keys(selectedForMerge).filter(k => selectedForMerge[k]).length < 2}
            title={Object.keys(selectedForMerge).filter(k => selectedForMerge[k]).length < 2 ? 'Select at least 2 uploads to enable' : 'Open merge dialog'}
          >
            Merge Selected
          </button>
        </div>

        <h3>Uploads ({statusView})</h3>
        <ul>
          {uploads.map((u:any) => (
            <li key={u._id} className="list-item">
              <div className="meta">{u.filename} — {u.contentType} — {new Date(u.createdAt).toLocaleString()}</div>
              <div>
                {statusView === 'active' && <input type="checkbox" checked={!!selectedForMerge[u._id]} onChange={() => toggleSelectForMerge(u._id)} title="Select for merge" />}
                <button type="button" className="ml-6" onClick={() => { if(workspace) window.location.hash = `#/m01/upload/preview/${u._id}?workspace=${workspace}`; else window.location.hash = `#/m01/upload/preview/${u._id}`; }}>Preview</button>
                <button type="button" className="ml-6" onClick={async () => {
                  // open details
                  const res = await fetch(`${API_URL}/m01/uploads/${u._id}?workspace=${workspace}`, { headers: getAuthHeaders() });
                  const j = await res.json();
                  if (j?.ok) setDetailsItem(j.item); else setMessage('failed to load details');
                }}>⋯</button>
                {statusView === 'active' ? (
                  <button type="button" className="ml-6" onClick={() => archiveUpload(u._id)}>Archive</button>
                ) : (
                  <>
                    <button type="button" className="ml-6" onClick={() => restoreUpload(u._id)}>Restore</button>
                    <button type="button" className="ml-6" onClick={() => permanentDelete(u._id)}>Permanently Delete</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Preview moved to dedicated screen (UploadPreview). Inline preview removed. */}

        {/* Confirmation modal (in-app) */}
        {confirmAction && (
          <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm</h3>
              <div className="mt-8">
                {confirmAction.type === 'archive' && <div>Move this upload to archive?</div>}
                {confirmAction.type === 'restore' && <div>Restore this upload to active?</div>}
                {confirmAction.type === 'permanent' && <div>Permanently delete this upload? This cannot be undone.</div>}
              </div>
              <div className="mt-12 flex justify-between">
                <div>
                  <button type="button" className="btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
                </div>
                <div>
                  <button type="button" className="btn-primary" onClick={() => performConfirmedAction(confirmAction)}>Confirm</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {detailsItem && (
          <div className="modal-overlay" onClick={() => setDetailsItem(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Upload details</h3>
              <div><strong>Filename:</strong> {detailsItem.filename}</div>
              <div><strong>Original name:</strong> {detailsItem.originalName}</div>
              <div><strong>Content type:</strong> {detailsItem.contentType}</div>
              <div><strong>Uploaded by:</strong> {detailsItem.uploadedBy?.fullName || detailsItem.uploadedBy?.email || 'Unknown'}</div>
              <div><strong>Workspace:</strong> {detailsItem.workspace}</div>
              <div><strong>Created at:</strong> {new Date(detailsItem.createdAt).toLocaleString()}</div>
              <div className="mt-12"><button type="button" onClick={() => setDetailsItem(null)}>Close</button></div>
            </div>
          </div>
        )}

        {mergeOpen && (
          <div className="modal-overlay" onClick={() => setMergeOpen(false)}>
            <div className="modal-content max-width-900" onClick={(e) => e.stopPropagation()}>
              <h3>Merge uploads</h3>
              <div className="mb-8 muted">Follow the two-step merge: 1) choose matching key per file; 2) map source columns to target schema (source-first).</div>
              <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                {mergeLoading ? (
                  <div style={{ padding: 20 }}>Loading previews…</div>
                ) : (
                  <>
                {/* Step 1: choose matching column per file */}
                {step === 1 && (
                  <div>
                    <div style={{ marginBottom: 8 }}>Choose a single matching column in each file.</div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ marginRight: 8 }}>Target column to store the matching key</label>
                      <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                        {MERGED_COLUMNS.map(c => (
                          <option key={c.key} value={c.key}>{c.label} ({c.key})</option>
                        ))}
                      </select>
                    </div>
                    {/* Type casting options removed */}
                    <div style={{ display: 'grid', gap: 8 }}>
                      {Object.keys(headersByUpload).map(uid => (
                        <div key={uid} style={{ padding: 8, border: '1px solid #eee' }}>
                          <div style={{ fontWeight: 700 }}>{uploads.find(u=>u._id===uid)?.filename || uid}</div>
                          <div style={{ marginTop: 6 }}>
                            { (headersByUpload[uid] && headersByUpload[uid].length > 0) ? (
                              <div>
                                {headerPromotedByUpload[uid] && (
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ marginRight: 8 }}>
                                      <input type="checkbox" checked={!!useDetectedHeader[uid]} onChange={(e) => setUseDetectedHeader(prev => ({ ...prev, [uid]: e.target.checked }))} />
                                      {' '}Use detected header
                                    </label>
                                  </div>
                                )}
                                { useDetectedHeader[uid] ? (
                                  <select value={matchingColumns[uid] ?? ''} onChange={(e) => setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))}>
                                    <option value="">-- select matching column --</option>
                                    {(headersByUpload[uid] || []).map((h) => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                ) : (
                                  <div>
                                    <div style={{ marginBottom: 6, color: '#cfc' }}>
                                      Using manual column name — you unchecked the detected header. Enter the matching column name below.
                                    </div>
                                    <input placeholder="Enter matching column name" value={matchingColumns[uid] ?? ''} onChange={(e) => setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))} />
                                  </div>
                                ) }
                              </div>
                            ) : (
                              <div>
                                <div style={{ marginBottom: 6, color: '#cfc' }}>
                                  No header row detected for this file — enter the matching column name manually or check the CSV.
                                </div>
                                <input placeholder="Enter matching column name" value={matchingColumns[uid] ?? ''} onChange={(e) => setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))} />
                              </div>
                            ) }
                            { headerPromotedByUpload[uid] && (
                              <div style={{ marginTop: 6, color: 'orange' }}>
                                {headerIndexByUpload[uid] != null ?
                                  `Auto-detected header at row ${headerIndexByUpload[uid] + 1}. Please verify.` :
                                  'Auto-detected header. Please verify.'
                                }
                              </div>
                            ) }
                          </div>
                          {/* Sample type display removed per request */}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <button disabled={!matchingKeysCompatible()} onClick={() => setStep(2)}>Next →</button>
                    </div>
                  </div>
                )}

                {/* Step 2: source-first mapping blocks */}
                {step === 2 && (
                  <div>
                    <div style={{ marginBottom: 8 }}>Map each source column (left) to a single merged target column (right). The selected join key “{targetKey}” will be filled automatically from your matching columns and is excluded from the options.</div>
                    {/* Type warning legend removed per request */}
                    <div style={{ marginBottom: 8 }}>
                      <label>Merge name (optional): </label>
                      <input placeholder="Give this merged CSV a name" value={mergedName} onChange={(e)=>setMergedName(e.target.value)} style={{ marginLeft: 8, width: '50%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {Object.keys(headersByUpload).map(uid => (
                        <div key={uid} style={{ flex: 1, border: '1px solid #eee', padding: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>{uploads.find(u=>u._id===uid)?.filename || uid}</div>
                          <div style={{ maxHeight: 420, overflow: 'auto' }}>
                            {(mappingsByFile[uid] || []).filter(r => r.source !== matchingColumns[uid]).map(row => {
                              // Type info removed; mappings are permissive
                              return (
                                <div key={row.source} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                  <div style={{ width: '45%', fontFamily: 'monospace' }}>{row.source}</div>
                                  <div style={{ width: '55%' }}>
                                    <select value={row.target} onChange={(e) => setMapping(uid, row.source, e.target.value)} style={{ width: '100%' }}>
                                      <option value="__skip">Skip Column</option>
                                      <option value="__custom">Custom Field…</option>
                                      {availableTargetsFor(uid, row.target).map(k => {
                                        const meta = MERGED_COLUMNS.find(c => c.key === k);
                                        const label = meta ? `${meta.label} (${meta.key})` : k;
                                        return <option key={k} value={k}>{label}</option>;
                                      })}
                                    </select>
                                    {row.target === '__custom' && (
                                      <div style={{ marginTop: 6 }}>
                                        <input placeholder="custom name" value={row.customName || ''} onChange={(e) => setCustomName(uid, row.source, e.target.value)} style={{ width: '100%' }} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ marginBottom: 8 }}>Selected targets: {Array.from(usedTargets).join(', ') || '<none>'}</div>
                      {/* Type mismatch blocking removed per request */}
                      {!requiredTargetsSatisfied() && (
                        <div style={{ color: 'red', marginBottom: 6 }}>Map all required merged columns (e.g. {Array.from(REQUIRED_TARGETS).join(', ')}) exactly once.</div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setStep(1)}>← Back</button>
                        <button onClick={submitMerge} disabled={!requiredTargetsSatisfied()}>Merge and save</button>
                        {mergedResultId && (
                          <button type="button" onClick={() => {
                            if(workspace) window.location.hash = `#/m01/merged?workspace=${workspace}&open=${mergedResultId}`;
                            else window.location.hash = `#/m01/merged`;
                          }}>Open / View merged CSVs</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
              <div className="mt-12 flex justify-between">
                <div>
                  <button type="button" className="btn-ghost" onClick={() => setMergeOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
