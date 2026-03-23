import { useEffect, useState } from "react";
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import MERGED_COLUMNS from '../m01/mergedColumns';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function UploadM02(){
  function getAuthHeaders(extra: Record<string,string> = {}){
    try{
      const token = localStorage.getItem('token');
      return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
    }catch(e){ return extra; }
  }
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [detailsItem, setDetailsItem] = useState<any|null>(null);
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [statusView, setStatusView] = useState<'active'|'archived'>('active');
  const [selectedForMerge, setSelectedForMerge] = useState<Record<string, boolean>>({});
  const [headersByUpload, setHeadersByUpload] = useState<Record<string, string[]>>({});
  const [headerPromotedByUpload, setHeaderPromotedByUpload] = useState<Record<string, boolean>>({});
  const [headerIndexByUpload, setHeaderIndexByUpload] = useState<Record<string, number|null>>({});
  const [useDetectedHeader, setUseDetectedHeader] = useState<Record<string, boolean>>({});
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [step, setStep] = useState<1|2>(1);
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

  const setPreviewReturn = () => {
    try { sessionStorage.setItem('m02_preview_return', window.location.hash || ''); } catch (e) { /* ignore */ }
  };

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
    try { console.debug('[m02.upload] openMergeModal invoked'); } catch (e) {}
    const ids = Object.keys(selectedForMerge).filter(k => selectedForMerge[k]);
    if(ids.length < 2) {
      setMessage('Select at least 2 uploads to merge');
      return;
    }

    setMergeOpen(true);
    setMergeLoading(true);

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

        if ((!(j.header && j.header.length > 0)) && (!j.rows || j.rows.length === 0)) {
          try {
            const res2 = await fetchWithTimeout(`${API_URL}/m01/uploads/${id}/preview?page=1&perPage=0&workspace=${workspace}`, { headers: getAuthHeaders() }, 40000);
            if (res2.status === 404) return { id, ok: false, error: 'missing' };
            const j2 = await res2.json();
            return { id, ok: true, header: j2.header || [], rows: j2.rows || [], headerPromoted: !!j2.headerPromoted, headerIndex: typeof j2.headerIndex === 'number' ? j2.headerIndex : null };
          } catch (e) {
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
        }
      } else {
        const reason = (r as any).reason;
        fetchErrors.push(`fetch failed: ${String(reason)}`);
      }
    }

    if (fetchErrors.length) setMessage(`Preview fetch issues: ${fetchErrors.join('; ')}`);

    for (const id of Object.keys(hBy)){
      if ((!hBy[id] || hBy[id].length === 0) && (samplesBy[id] || []).length > 0){
        const samples = samplesBy[id];
        const looksLikeHeader = (cell: string) => {
          if (!cell) return false;
          const s = String(cell).trim();
          if (s.length === 0) return false;
          if (/^-?\d+(?:\.\d+)?$/.test(s)) return false;
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
          samplesBy[id] = samples.slice((detectedIndex || 0) + 1);
        }
      }
    }
    setHeadersByUpload(hBy);
    setHeaderPromotedByUpload(headerPromotedMap);
    setHeaderIndexByUpload(headerIndexMap);
    const ud: Record<string, boolean> = {};
    for (const id of Object.keys(hBy)) ud[id] = !!headerPromotedMap[id] || (hBy[id] && hBy[id].length > 0);
    setUseDetectedHeader(ud);
    const mc: Record<string,string> = {};
    const mbf: Record<string, Array<{ source: string; target: string; customName?: string }>> = {};
    const globallyUsedTargets = new Set<string>();
    for (const id of ids) {
      const hdrs = hBy[id] || [];
      const chooseBest = (hdr: string[]) => {
        if (!hdr || hdr.length === 0) return '';
        const lower = hdr.map(h => String(h).toLowerCase());
        for (let i = 0; i < lower.length; i++) if (/email|e-?mail|contact/.test(lower[i])) return hdr[i];
        for (let i = 0; i < lower.length; i++) if (/\b(id|identifier|uid|lead_id|leadid)\b/.test(lower[i])) return hdr[i];
        for (const h of hdr) if (h && String(h).trim().length > 0) return h;
        return '';
      };
      mc[id] = chooseBest(hdrs);
      const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetByNorm: Record<string, string> = {};
      for (const meta of MERGED_COLUMNS) {
        targetByNorm[normalize(meta.key)] = meta.key;
        targetByNorm[normalize(meta.label)] = meta.key;
      }
      const rows = hdrs.map((h) => {
        const n = normalize(h);
        const proposed = targetByNorm[n];
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

  const matchingKeysCompatible = () => {
    for (const fid of Object.keys(mappingsByFile || {})) {
      const col = matchingColumns[fid];
      if (!col) return false;
    }
    return Object.keys(mappingsByFile || {}).length > 0;
  };

  useEffect(() => {
    setMappingsByFile(prev => {
      const copy: typeof prev = {} as any;
      for (const [fid, arr] of Object.entries(prev)){
        copy[fid] = (arr || []).map(m => (m.target === targetKey ? { ...m, target: '__skip' } : m));
      }
      return copy;
    });
  }, [targetKey]);

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
    const seen = new Set<string>();
    for (const arr of Object.values(mappingsByFile)) {
      for (const m of arr) {
        if (!m || m.target === '__skip' || m.target === '__custom') continue;
        if (m.target === targetKey) continue;
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
        if (m.target === targetKey) continue;
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
      <div className="mb-12" style={{ display: 'flex', alignItems: 'center' }}>
        <ModuleBackButton toSuffix="" />
        <h2 style={{ margin: 0 }}>Module 02 - Upload CSV</h2>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "nowrap"
        }}
      >
        <label
          style={{
            background: "#0f4258",
            color: "white",
            padding: "10px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            minWidth: "100px",
            textAlign: "center"
          }}
        >
          Choose File
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          style={{
            background: "#0f4258",
            color: "white",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
            height: "40px",
            minWidth: "100px"
          }}
        >
          Upload
        </button>

        <button
          type="button"
          onClick={() => setStatusView("active")}
          style={{
            background: "#0f4258",
            color: "white",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
            height: "40px",
            minWidth: "100px"
          }}
        >
          All Uploads
        </button>

        <button
          type="button"
          onClick={() => setStatusView("archived")}
          style={{
            background: "#0f4258",
            color: "white",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
            height: "40px",
            minWidth: "100px"
          }}
        >
          Archive
        </button>

        <button
          type="button"
          onClick={openMergeModal}
          disabled={Object.keys(selectedForMerge).filter(k => selectedForMerge[k]).length < 2}
          style={{
            background: "#0f4258",
            color: "white",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
            height: "40px",
            minWidth: "100px",
             opacity: 1 
          }}
        >
          Merge Selected
        </button>
      </div>

      {message && <div className="mt-8">{message}</div>}

      <h3>Uploads ({statusView})</h3>
      <ul>
        {uploads.map((u: any) => (
          <li key={u._id} className="list-item">
            <div className="meta">
              {u.filename} - {u.contentType} - {new Date(u.createdAt).toLocaleString()}
            </div>

            <div>
              {statusView === "active" && (
                <input
                  type="checkbox"
                  checked={!!selectedForMerge[u._id]}
                  onChange={() => toggleSelectForMerge(u._id)}
                />
              )}

              <button
                type="button"
                className="ml-6"
                onClick={() => {
                  setPreviewReturn();
                  if (workspace)
                    window.location.hash = `#/workspace/${workspace}/m02/upload/preview/${u._id}`;
                  else window.location.hash = `#/m02/upload/preview/${u._id}`;
                }}
                style={{
                  background: "#0f4258",
                  color: "white",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Preview
              </button>

              <button
                type="button"
                className="ml-6"
                onClick={async () => {
                  const res = await fetch(
                    `${API_URL}/m01/uploads/${u._id}?workspace=${workspace}`,
                    { headers: getAuthHeaders() }
                  );
                  const j = await res.json();
                  if (j?.ok) setDetailsItem(j.item);
                  else setMessage("failed to load details");
                }}
                style={{
                  background: "#0f4258",
                  color: "white",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Details
              </button>

              {statusView === "active" ? (
                <button
                  type="button"
                  className="ml-6"
                  onClick={() => archiveUpload(u._id)}
                  style={{
                    background: "#0f4258",
                    color: "white",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  Archive
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="ml-6"
                    onClick={() => restoreUpload(u._id)}
                    style={{
                      background: "#0f4258",
                      color: "white",
                      borderRadius: "6px",
                      padding: "8px 14px",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    Restore
                  </button>

                  <button
                    type="button"
                    className="ml-6"
                    onClick={() => permanentDelete(u._id)}
                    style={{
                      background: "red",
                      color: "white",
                      borderRadius: "6px",
                      padding: "8px 14px",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    Permanently Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm</h3>
            <div className="mt-8">
              {confirmAction.type === "archive" && <div>Move this upload to archive?</div>}
              {confirmAction.type === "restore" && <div>Restore this upload to active?</div>}
              {confirmAction.type === "permanent" && (
                <div>Permanently delete this upload? This cannot be undone.</div>
              )}
            </div>
            <div className="mt-12 flex justify-between">
              <div>
                <button type="button" className="btn-ghost" onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
              </div>
              <div>
                <button type="button" className="btn-primary" onClick={() => performConfirmedAction(confirmAction)}>
                  Confirm
                </button>
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
            <div><strong>Uploaded by:</strong> {detailsItem.uploadedBy?.fullName || detailsItem.uploadedBy?.email || "Unknown"}</div>
            <div><strong>Workspace:</strong> {detailsItem.workspace}</div>
            <div><strong>Created at:</strong> {new Date(detailsItem.createdAt).toLocaleString()}</div>
            <div className="mt-12">
              <button type="button" onClick={() => setDetailsItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {mergeOpen && (
        <div className="modal-overlay" onClick={() => setMergeOpen(false)}>
          <div className="modal-content max-width-900" onClick={(e) => e.stopPropagation()}>
            <h3>Merge uploads</h3>
            <div className="mb-8 muted">
              Follow the two-step merge: 1) choose matching key per file; 2) map source columns to target schema.
            </div>

            <div style={{ maxHeight: "60vh", overflow: "auto" }}>
              {mergeLoading ? (
                <div style={{ padding: 20 }}>Loading previews…</div>
              ) : (
                <>
                  {/* step 1 */}
                  {step === 1 && (
                    <div>
                      <div style={{ marginBottom: 8 }}>Choose a matching column in each file.</div>

                      <div style={{ marginBottom: 8 }}>
                        <label style={{ marginRight: 8 }}>Target column for match:</label>
                        <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                          {MERGED_COLUMNS.map(c => (
                            <option key={c.key} value={c.key}>
                              {c.label} ({c.key})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {Object.keys(headersByUpload).map(uid => (
                          <div key={uid} style={{ padding: 8, border: "1px solid #eee" }}>
                            <div style={{ fontWeight: 700 }}>
                              {uploads.find(u => u._id === uid)?.filename || uid}
                            </div>

                            <div style={{ marginTop: 6 }}>
                              {(headersByUpload[uid] && headersByUpload[uid].length > 0) ? (
                                <div>
                                  {headerPromotedByUpload[uid] && (
                                    <div style={{ marginBottom: 6 }}>
                                      <label>
                                        <input
                                          type="checkbox"
                                          checked={!!useDetectedHeader[uid]}
                                          onChange={(e) =>
                                            setUseDetectedHeader(prev => ({
                                              ...prev,
                                              [uid]: e.target.checked
                                            }))
                                          }
                                        />
                                        {" "}Use detected header
                                      </label>
                                    </div>
                                  )}

                                  {useDetectedHeader[uid] ? (
                                    <select
                                      value={matchingColumns[uid] ?? ""}
                                      onChange={(e) =>
                                        setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))
                                      }
                                    >
                                      <option value="">-- select --</option>
                                      {(headersByUpload[uid] || []).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div>
                                      <input
                                        placeholder="Enter matching column name"
                                        value={matchingColumns[uid] ?? ""}
                                        onChange={(e) =>
                                          setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <input
                                    placeholder="Enter matching column name"
                                    value={matchingColumns[uid] ?? ""}
                                    onChange={(e) =>
                                      setMatchingColumns(prev => ({ ...prev, [uid]: e.target.value }))
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => setStep(2)}
                          disabled={!matchingKeysCompatible()}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* step 2 */}
                  {step === 2 && (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        Map each source column to a merged target field.
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label>Merge name: </label>
                        <input
                          placeholder="Optional name"
                          value={mergedName}
                          onChange={(e) => setMergedName(e.target.value)}
                          style={{ marginLeft: 8, width: "50%" }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        {Object.keys(headersByUpload).map(uid => (
                          <div key={uid} style={{ flex: 1, border: "1px solid #eee", padding: 8 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>
                              {uploads.find(u => u._id === uid)?.filename || uid}
                            </div>

                            <div style={{ maxHeight: 420, overflow: "auto" }}>
                              {(mappingsByFile[uid] || [])
                                .filter(r => r.source !== matchingColumns[uid])
                                .map(row => (
                                  <div
                                    key={row.source}
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                      marginBottom: 6
                                    }}
                                  >
                                    <div style={{ width: "45%", fontFamily: "monospace" }}>
                                      {row.source}
                                    </div>

                                    <div style={{ width: "55%" }}>
                                      <select
                                        value={row.target}
                                        onChange={(e) => setMapping(uid, row.source, e.target.value)}
                                        style={{ width: "100%" }}
                                      >
                                        <option value="__skip">Skip</option>
                                        <option value="__custom">Custom</option>
                                        {availableTargetsFor(uid, row.target).map(k => {
                                          const meta = MERGED_COLUMNS.find(c => c.key === k);
                                          const label = meta ? `${meta.label} (${meta.key})` : k;
                                          return (
                                            <option key={k} value={k}>
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </select>

                                      {row.target === "__custom" && (
                                        <div style={{ marginTop: 6 }}>
                                          <input
                                            placeholder="custom name"
                                            value={row.customName || ""}
                                            onChange={(e) =>
                                              setCustomName(uid, row.source, e.target.value)
                                            }
                                            style={{ width: "100%" }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div style={{ marginBottom: 8 }}>
                          Selected targets: {Array.from(usedTargets).join(", ") || "<none>"}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setStep(1)}>Back</button>
                          <button onClick={submitMerge}>Merge and Save</button>

                          {mergedResultId && (
                            <button
                              type="button"
                              onClick={() => {
                                if (workspace)
                                  window.location.hash = `#/workspace/${workspace}/m02/merged?open=${mergedResultId}`;
                                else window.location.hash = `#/m02/merged`;
                              }}
                            >
                              View Merged CSVs
                            </button>
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
                <button type="button" className="btn-ghost" onClick={() => setMergeOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </Layout>
);
}
