import { useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function LeadAddUpload(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<{ lead_id: string; full_name?: string; company?: string }>({ lead_id: '' });

  function getAuthHeaders(extra: Record<string,string> = {}){
    try{ const token = localStorage.getItem('token'); return token ? { ...extra, Authorization: `Bearer ${token}` } : extra; } catch(e){ return extra; }
  }

  async function uploadPreview(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('workspace required');
    if(!file) return setMessage('choose a CSV file');
    setMessage('Uploading for preview...');
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('workspace', workspace);
    try{
      const res = await fetch(`${API_URL}/m07/leads/upload/preview`, { method: 'POST', body: fd, headers: getAuthHeaders() });
      let j: any = null;
      try { j = await res.json(); } catch (err) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      if(res.ok && j?.ok){
        setPreview({ columns: j.columns || [], rows: j.previewRows || [] });
        // set sensible defaults
        setMapping({ lead_id: (j.columns && j.columns[0]) || '' , full_name: j.columns && j.columns[1] ? j.columns[1] : '', company: '' });
        setMessage(null);
      } else setMessage(j?.error || `preview failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  async function commitPreview(){
    if(!workspace) return setMessage('workspace required');
    if(!preview) return setMessage('no preview available');
    const cols = preview.columns || [];
    const rows = preview.rows || [];
    const leadCol = mapping.lead_id;
    if(!leadCol) return setMessage('map lead_id column');
    const leadIndex = cols.findIndex(c => c === leadCol);
    if(leadIndex === -1) return setMessage('lead_id column not found');
    const payloadRows = rows.map(r => {
      const obj: any = {};
      obj.lead_id = r[leadIndex] || '';
      if(mapping.full_name){ const idx = cols.indexOf(mapping.full_name); if(idx !== -1) obj.full_name = r[idx]; }
      if(mapping.company){ const idx = cols.indexOf(mapping.company); if(idx !== -1) obj.company = r[idx]; }
      obj.raw = Object.fromEntries(cols.map((c,i) => [c, r[i] || '']));
      return obj;
    });

    try{
      const res = await fetch(`${API_URL}/m07/leads/upload/commit`, { method: 'POST', headers: getAuthHeaders({'Content-Type': 'application/json'}), body: JSON.stringify({ workspaceId: workspace, rows: payloadRows, overwriteMode: 'overwrite_existing' }) });
      let j: any = null;
      try { j = await res.json(); } catch (err) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      if(res.ok && j?.ok){ setMessage(`Imported ${j.importedCount} updated ${j.updatedCount} skipped ${j.skippedCount}`); setPreview(null); setFile(null); }
      else setMessage(j?.error || `commit failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  async function saveManual(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('workspace required');
    const form = (e.target as HTMLFormElement);
    const data = Object.fromEntries(new FormData(form) as any);
    try{
      const res = await fetch(`${API_URL}/m07/leads`, { method: 'POST', headers: getAuthHeaders({'Content-Type': 'application/json'}), body: JSON.stringify({ workspaceId: workspace, ...data }) });
      let j: any = null;
      try { j = await res.json(); } catch (err) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      if(res.ok && j?.ok){ setMessage('Lead saved'); form.reset(); } else setMessage(j?.error || `save failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m07" />
          <h2 style={{ margin: 0 }}>Module 07 - Funnel Leads (Add / Upload)</h2>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div style={{ marginTop: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(17, 24, 39, 0.08)', maxWidth: 1100 }}>
            <div style={{ marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Manual Add</h4>
              <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Add a single lead. Required: lead_id. Optional: name, company, source.</div>
            </div>
            <form onSubmit={saveManual}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Lead ID *</label>
                  <input name="lead_id" placeholder="unique lead id" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Full name</label>
                  <input name="full_name" placeholder="Full name" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Company</label>
                  <input name="company" placeholder="Company" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Source</label>
                  <input name="source" placeholder="e.g., Salesforce, Web" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="btn-primary" type="submit">Save Lead</button>
                <button className="btn-ghost" type="button" onClick={()=>{ setMessage(null); }}>Reset</button>
              </div>
            </form>
          </div>

          <div style={{ marginTop: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(17, 24, 39, 0.08)', maxWidth: 1100 }}>
            <div style={{ marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>CSV Upload (preview)</h4>
              <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Upload a CSV to preview and map columns before importing sample rows.</div>
            </div>
            <form onSubmit={uploadPreview}>
              <input type="file" accept=".csv,text/csv" onChange={(e)=> setFile(e.target.files ? e.target.files[0] : null)} />
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary" type="submit">Preview CSV</button>
                <button className="btn-ghost" type="button" style={{ marginLeft: 8 }} onClick={()=>{ setFile(null); setPreview(null); }}>Clear</button>
              </div>
            </form>

            {preview && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8, fontSize: 12 }}>Detected columns: {preview.columns.join(', ')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12 }}>Map lead_id *</div>
                    <input list="lead-upload-headers" value={mapping.lead_id} onChange={(e)=> setMapping(m => ({ ...m, lead_id: e.target.value }))} placeholder="Column name" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Map full_name</div>
                    <input list="lead-upload-headers" value={mapping.full_name || ''} onChange={(e)=> setMapping(m => ({ ...m, full_name: e.target.value }))} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Map company</div>
                    <input list="lead-upload-headers" value={mapping.company || ''} onChange={(e)=> setMapping(m => ({ ...m, company: e.target.value }))} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                </div>
                <datalist id="lead-upload-headers">
                  {preview.columns.map(c => (<option key={c} value={c} />))}
                </datalist>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>Preview rows (sample):</div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fb' }}>{preview.columns.map((c, idx) => <th key={idx} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12 }}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>{preview.columns.map((c, j) => <td key={j} style={{ padding: 8, borderBottom: '1px solid #edf2f7', fontSize: 12 }}>{r[j] ?? ''}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button className="btn-primary" onClick={commitPreview}>Import Previewed Rows</button>
                  <button className="btn-ghost" onClick={()=>{ setPreview(null); setFile(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {message && <div className="muted">{message}</div>}
        </div>
      </div>
    </Layout>
  );
}
