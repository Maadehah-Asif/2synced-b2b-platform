import { useEffect, useState } from 'react';
import ModuleBackButton from '../../components/ModuleBackButton';
import MERGED_COLUMNS from './mergedColumns';
// This app uses a simple hash-based router. Read query params from location.hash
function readSearchParams() {
  const m = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(m);
}

function getAuthHeaders(extra: Record<string,string> = {}){
  try{
    const token = localStorage.getItem('token');
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }catch(e){ return extra; }
}

// Simple Merge UI skeleton.
// Usage: navigate to /m01/merge?uploads=<id1>,<id2>&workspace=<workspaceId>
// The component will fetch headers for each upload and let you pick matching columns.

type FileHeaders = { id: string; filename?: string; header: string[]; sampleRows?: string[][]; headerPromoted?: boolean; headerIndex?: number; columnTypes?: string[] };

// Required target columns (frontend-side); keep in sync with backend TARGET_SCHEMA.required
const REQUIRED_TARGETS = new Set<string>(['lead_id']);

export default function MergeCSV() {
  const sp = readSearchParams();
  const uploadsParam = sp.get('uploads') || '';
  const workspace = sp.get('workspace') || undefined;
  const uploadIds = uploadsParam.split(',').map(s => s.trim()).filter(Boolean);

  const [files, setFiles] = useState<FileHeaders[]>([]);
  const [useDetectedHeader, setUseDetectedHeader] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchingColumns, setMatchingColumns] = useState<Record<string,string>>({});
  const [joinType] = useState<'outer'|'inner'>('outer');
  const [conflictPolicy] = useState<'first_non_empty'|'last_non_empty'|'prefer_file'>('last_non_empty');

  useEffect(() => {
    if (uploadIds.length === 0) return;
    setLoading(true);
    setError(null);
    const headers: FileHeaders[] = [];
    (async () => {
      try {
        const auth = getAuthHeaders();
        for (const id of uploadIds) {
          const url = `/api/m01/uploads/${id}/preview?perPage=3&page=1${workspace ? `&workspace=${workspace}` : ''}`;
          // fetch header using preview endpoint
          // eslint-disable-next-line no-await-in-loop
          const r = await fetch(url, { headers: { ...auth } });
          if (!r.ok) throw new Error(`failed to fetch preview for ${id}: ${r.statusText}`);
          const j = await r.json();
          headers.push({ id, filename: j.item?.filename ?? j.filename ?? id, header: j.header || [], sampleRows: j.rows || [], headerPromoted: !!j.headerPromoted, headerIndex: j.headerIndex, columnTypes: j.columnTypes || [] });
        }
        setFiles(headers);
        // default matching columns: first header value for each file
        const mc: Record<string,string> = {};
        for (const f of headers) {
          // choose best match heuristically
          const chooseBest = (hdr: string[], typesArr: string[]) => {
            if (!hdr || hdr.length === 0) return '';
            const lower = hdr.map(h => String(h).toLowerCase());
            for (let i = 0; i < lower.length; i++) if (/email|e-?mail|contact/.test(lower[i])) return hdr[i];
            for (let i = 0; i < lower.length; i++) if (/\b(id|identifier|uid|lead_id|leadid)\b/.test(lower[i])) return hdr[i];
            for (let i = 0; i < (typesArr || []).length; i++) if (typesArr[i] === 'integer' && /id$/i.test(lower[i] || '')) return hdr[i];
            for (const h of hdr) if (h && String(h).trim().length > 0) return h;
            return '';
          };
          mc[f.id] = chooseBest(f.header, f.columnTypes || []);
        }
        setMatchingColumns(mc);
        // default useDetectedHeader for promoted headers
        const ud: Record<string, boolean> = {};
        for (const f of headers) ud[f.id] = !!f.headerPromoted || (f.header && f.header.length > 0);
        setUseDetectedHeader(ud);
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadsParam, workspace]);

  const handleChangeMatching = (fileId: string, col: string) => {
    setMatchingColumns(prev => ({ ...prev, [fileId]: col }));
  };

  const doMerge = async () => {
    setError(null);
    // build mappings array from mappingsByFile
    const mappings: any[] = [];
    for (const [fileId, arr] of Object.entries(mappingsByFile || {})) {
      for (const m of arr) {
        if (!m || !m.source) continue;
        if (m.target === '__skip') continue;
        if (m.target === '__custom') {
          if (!m.customName) continue;
          mappings.push({ target: m.customName, source: `${fileId}::${m.source}` });
        } else {
          mappings.push({ target: m.target, source: `${fileId}::${m.source}` });
        }
      }
    }
    if (!Array.isArray(mappings) || mappings.length === 0) { setError('No mappings selected'); return; }
    if (uploadIds.length === 0) { setError('no uploads provided'); return; }
    try {
      setLoading(true);
      const body = { workspace, uploadIds, mappings, matchingColumns, joinType, conflictPolicy };
      const auth = getAuthHeaders();
      const r = await fetch('/api/m01/uploads/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`merge failed: ${r.status} ${txt}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // --- two-step UI state & helpers ---
  const [step, setStep] = useState<1|2>(1);
  // Casting toggle removed — all types treated permissively
  const [mappingsByFile, setMappingsByFile] = useState<Record<string, Array<{ source: string; target: string; customName?: string }>>>({});

  // initialize mappingsByFile when files change (default skip)
  useEffect(() => {
    if (!files || files.length === 0) return;
    setMappingsByFile(prev => {
      const out: Record<string, any[]> = { ...prev };
      for (const f of files) {
        if (!out[f.id]) out[f.id] = f.header.map(h => ({ source: h, target: '__skip' }));
      }
      return out;
    });
  }, [files]);

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
    if (current && current !== '__skip' && current !== '__custom') used.delete(current);
    return allTargetKeys.filter(k => !used.has(k));
  };

  // check matching-key compatibility across files
  const matchingKeysCompatible = () => files.length > 0 && files.every(f => matchingColumns[f.id] && matchingColumns[f.id].length > 0);

  const setMapping = (fileId: string, source: string, target: string) => {
    setMappingsByFile(prev => {
      const copy: Record<string, any[]> = { ...prev };
      copy[fileId] = (copy[fileId] || []).map(m => m.source === source ? { ...m, target, customName: m.customName } : m);
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

  const allMatchingSelected = files.length > 0 && files.every(f => matchingColumns[f.id] && matchingColumns[f.id].length > 0);
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

  // Type inference removed

  // Mapping templates: load/save
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const fetchTemplates = async () => {
    if (!workspace) return;
    try {
      const auth = getAuthHeaders();
      const r = await fetch(`/api/m01/templates?workspace=${workspace}`, { headers: auth });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.ok) setTemplates(j.items || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { fetchTemplates(); }, [workspace]);

  const handleLoadTemplate = async (id: string) => {
    if (!id) return;
    try {
      const auth = getAuthHeaders();
      const r = await fetch(`/api/m01/templates/${id}?workspace=${workspace}`, { headers: auth });
      if (!r.ok) throw new Error('failed to load template');
      const j = await r.json();
      if (j?.ok && j.item) {
        // expect mapping structure: { matchingColumns, mappings }
        const m = j.item.mapping || {};
        if (m.matchingColumns) setMatchingColumns(m.matchingColumns);
        // convert mappings array (target + source as file::col) into mappingsByFile
        if (Array.isArray(m.mappings)) {
          const newMap: Record<string, Array<{ source: string; target: string; customName?: string }>> = {};
          for (const mm of m.mappings) {
            const src: string = mm.source || '';
            const [fid, col] = src.split('::');
            if (!fid || !col) continue;
            if (!newMap[fid]) newMap[fid] = [];
            // if target looks like a known target, map directly, else treat as custom
            const isKnown = MERGED_COLUMNS.find(c => c.key === mm.target);
            if (isKnown) newMap[fid].push({ source: col, target: mm.target });
            else newMap[fid].push({ source: col, target: '__custom', customName: mm.target });
          }
          setMappingsByFile(prev => ({ ...prev, ...newMap }));
        }
        setSelectedTemplateId(id);
      }
    } catch (e) { setError(String(e)); }
  };

  const handleSaveTemplate = async () => {
    if (!workspace) return setError('workspace is required to save template');
    const name = window.prompt('Template name');
    if (!name) return;
    // build mappings array from mappingsByFile
    const mappingsArr: any[] = [];
    for (const [fileId, arr] of Object.entries(mappingsByFile || {})) {
      for (const m of arr) {
        if (!m || !m.source) continue;
        if (m.target === '__skip') continue;
        if (m.target === '__custom') {
          if (!m.customName) continue;
          mappingsArr.push({ target: m.customName, source: `${fileId}::${m.source}` });
        } else {
          mappingsArr.push({ target: m.target, source: `${fileId}::${m.source}` });
        }
      }
    }
    const mappingObj = { matchingColumns, mappings: mappingsArr };
    try {
      const auth = getAuthHeaders();
      const r = await fetch('/api/m01/templates', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ workspace, name, schemaVersion: 'v1', mapping: mappingObj }) });
      if (!r.ok) throw new Error('failed to save');
      const j = await r.json();
      if (j?.ok) {
        await fetchTemplates();
        setSelectedTemplateId(j.id);
      }
    } catch (e) { setError(String(e)); }
  };

  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <ModuleBackButton toSuffix="/m01" />
        <h2 style={{ margin: 0 }}>Merge CSVs</h2>
      </div>
      <p style={{ color: '#666' }}>Uploads: {uploadIds.join(', ') || '<none>'}</p>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{error}</div>}

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Template</label>
        <select value={selectedTemplateId ?? ''} onChange={(e) => { const v = e.target.value; setSelectedTemplateId(v || null); if (v) handleLoadTemplate(v); }}>
          <option value="">-- none --</option>
          {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <button style={{ marginLeft: 8 }} onClick={handleSaveTemplate}>Save template</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3>Files & matching columns</h3>
          {files.map(f => (
            <div key={f.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #eee' }}>
              <div style={{ fontWeight: 600 }}>{f.filename} ({f.id})</div>
              <div style={{ marginTop: 8 }}>
                <label style={{ marginRight: 8 }}>Matching column</label>
                            <div>
                              {f.headerPromoted && (
                                <div style={{ marginBottom: 6 }}>
                                  <label style={{ marginRight: 8 }}>
                                    <input type="checkbox" checked={!!useDetectedHeader[f.id]} onChange={(e) => setUseDetectedHeader(prev => ({ ...prev, [f.id]: e.target.checked }))} />
                                    {' '}Use detected header
                                  </label>
                                </div>
                              )}
                              { useDetectedHeader[f.id] ? (
                                <select value={matchingColumns[f.id] ?? ''} onChange={(e) => handleChangeMatching(f.id, e.target.value)}>
                                  <option value="">-- select --</option>
                                  {f.header.map((h) => <option key={h} value={h}>{h}</option>)}
                                </select>
                              ) : (
                                <input placeholder="Enter matching column name" value={matchingColumns[f.id] ?? ''} onChange={(e) => handleChangeMatching(f.id, e.target.value)} />
                              ) }
                            </div>
              </div>
              <div style={{ marginTop: 8, color: '#444' }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Header preview:</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{f.header.join(', ')}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: 420 }}>
          <h3>Mappings</h3>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Step {step} of 2</div>
            {step === 1 ? (
              <div>
                <div style={{ marginBottom: 8 }}>Choose a single matching column per file (used as the join key). The chosen column will be reserved for the join and will not be available to map below.</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {files.map(f => {
                    return (
                      <div key={f.id} style={{ padding: 8, border: '1px solid #eee' }}>
                        <div style={{ fontWeight: 600 }}>{f.filename}</div>
                        <div style={{ marginTop: 6 }}>
                          <select value={matchingColumns[f.id] ?? ''} onChange={(e) => handleChangeMatching(f.id, e.target.value)}>
                            <option value="">-- select matching column --</option>
                            {f.header.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          {f.headerPromoted && (
                            <div style={{ marginTop: 6, color: 'orange' }}>No header row detected in file — promoted row {typeof f.headerIndex === 'number' ? f.headerIndex + 1 : '(unknown)'} to header. Please verify.</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button disabled={!allMatchingSelected || !matchingKeysCompatible()} onClick={() => setStep(2)}>Next →</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 8 }}>Map source columns to target schema. Choose one target per target column across all files (selected targets are removed from other dropdowns).</div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Special options: <strong>Custom Field</strong> (enter a new target name) or <strong>Skip Column</strong>.</div>

                <div style={{ maxHeight: 420, overflow: 'auto', paddingRight: 8 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #eee' }}>
                      <div style={{ fontWeight: 600 }}>{f.filename}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>Matching column reserved: <strong>{matchingColumns[f.id]}</strong></div>
                      <div style={{ marginTop: 8 }}>
                        { (mappingsByFile[f.id] || []).filter(r => r.source !== matchingColumns[f.id]).map(row => {
                          const avail = availableTargetsFor(f.id, row.target);
                          return (
                            <div key={row.source} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ width: 140, fontFamily: 'monospace', fontSize: 12 }}>{row.source}</div>
                              <select value={row.target} onChange={(e) => setMapping(f.id, row.source, e.target.value)}>
                                <option value="__skip">Skip Column</option>
                                <option value="__custom">Custom Field…</option>
                                {avail.map(k => {
                                  const meta = MERGED_COLUMNS.find(c => c.key === k);
                                  const label = meta ? `${meta.label} (${meta.key})` : k;
                                  return <option key={k} value={k}>{label}</option>;
                                })}
                              </select>
                              {row.target === '__custom' && (
                                <input placeholder="custom name" value={row.customName || ''} onChange={(e) => setCustomName(f.id, row.source, e.target.value)} />
                              )}
                            </div>
                          );
                        }) }
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Selected targets: {Array.from(usedTargets).join(', ') || '<none>'}</div>
                  {!requiredTargetsSatisfied() && (
                    <div style={{ color: 'red', marginBottom: 6 }}>Map all required merged columns (e.g. {Array.from(REQUIRED_TARGETS).join(', ')}) exactly once.</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setStep(1)}>← Back</button>
                    <button onClick={doMerge} disabled={loading || !requiredTargetsSatisfied()}>Merge & Download</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
