import { useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function StageAddUpload(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<{ lead_id: string; stage_name: string; entered_at: string; exited_at?: string }>({ lead_id: '', stage_name: '', entered_at: '' });

  function getAuthHeaders(extra: Record<string,string> = {}){
    try{ const token = localStorage.getItem('token'); return token ? { ...extra, Authorization: `Bearer ${token}` } : extra; } catch(e){ return extra; }
  }

  async function saveManual(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('workspace required');
    const form = (e.target as HTMLFormElement);
    const data = Object.fromEntries(new FormData(form) as any);
    try{
      const res = await fetch(`${API_URL}/m07/stages`, { method: 'POST', headers: getAuthHeaders({'Content-Type':'application/json'}), body: JSON.stringify({ workspaceId: workspace, ...data }) });
      const j = await res.json();
      if(res.ok && j?.ok){ setMessage('Stage saved'); form.reset(); } else setMessage(j?.error || `save failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  async function uploadPreview(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('workspace required');
    if(!file) return setMessage('choose a CSV file');
    setMessage('Uploading for preview...');
    const fd = new FormData(); fd.append('file', file, file.name); fd.append('workspace', workspace);
    try{
      const res = await fetch(`${API_URL}/m07/stages/upload/preview`, { method: 'POST', body: fd, headers: getAuthHeaders() });
      const j = await res.json();
      if(res.ok && j?.ok){ setPreview({ columns: j.columns || [], rows: j.previewRows || [] }); setMessage(null); }
      else setMessage(j?.error || `preview failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  async function commitPreview(){
    if(!workspace) return setMessage('workspace required');
    if(!preview) return setMessage('no preview available');
    const cols = preview.columns; const rows = preview.rows;
    if(!mapping.lead_id || !mapping.stage_name || !mapping.entered_at) return setMessage('map lead_id, stage_name and entered_at');
    const leadIdx = cols.indexOf(mapping.lead_id); const stageIdx = cols.indexOf(mapping.stage_name); const enteredIdx = cols.indexOf(mapping.entered_at);
    if(leadIdx === -1 || stageIdx === -1 || enteredIdx === -1) return setMessage('mapped columns not found');
    const payloadRows = rows.map(r => ({ lead_id: r[leadIdx] || '', stage_name: r[stageIdx] || '', entered_at: r[enteredIdx] || '', exited_at: mapping.exited_at ? r[cols.indexOf(mapping.exited_at)] : null }));
    try{
      const res = await fetch(`${API_URL}/m07/stages/upload/commit`, { method: 'POST', headers: getAuthHeaders({'Content-Type':'application/json'}), body: JSON.stringify({ workspaceId: workspace, rows: payloadRows, overwriteMode: 'overwrite_existing' }) });
      const j = await res.json();
      if(res.ok && j?.ok){ setMessage(`Imported ${j.importedCount} updated ${j.updatedCount} skipped ${j.skippedCount}`); setPreview(null); setFile(null); }
      else setMessage(j?.error || `commit failed: HTTP ${res.status}`);
    }catch(e){ setMessage('network error: ' + String((e as any).message || e)); }
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" />
          <h2 style={{ margin: 0 }}>Module 07 - Stage History (Add / Upload)</h2>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginTop: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(17, 24, 39, 0.08)', maxWidth: 1100 }}>
            <h4 style={{ margin: 0 }}>Manual Add Stage Record</h4>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Each record represents a lead's time in a stage. Lead must exist.</div>
            <form onSubmit={saveManual} style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Lead ID *</label><input name="lead_id" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Stage Name *</label><input name="stage_name" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Entered At *</label><input name="entered_at" type="date" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Exited At</label><input name="exited_at" type="date" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Stage Status</label><select name="stage_status" style={{ width: '100%' }}><option value="active">active</option><option value="completed">completed</option><option value="dropped">dropped</option></select></div>
                <div><label style={{ fontSize:12, fontWeight:600 }}>Next Stage</label><input name="next_stage" style={{ width: '100%' }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize:12, fontWeight:600 }}>Notes</label><textarea name="notes" rows={3} style={{ width: '100%' }} /></div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button className="btn-primary" type="submit">Save Stage Record</button>
                <button className="btn-ghost" type="button" onClick={()=>setMessage(null)}>Reset</button>
              </div>
            </form>
          </div>

          <div style={{ marginTop: 16, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(17, 24, 39, 0.08)', maxWidth: 1100 }}>
            <h4 style={{ margin: 0 }}>CSV Upload (Stage History)</h4>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>CSV must include at least lead_id, stage_name, entered_at. Use mapping to align columns.</div>
            <form onSubmit={uploadPreview} style={{ marginTop: 12 }}>
              <input type="file" accept=".csv" onChange={(e)=> setFile(e.target.files ? e.target.files[0] : null)} />
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary" type="submit">Preview CSV</button>
                <button className="btn-ghost" type="button" style={{ marginLeft: 8 }} onClick={()=>{ setFile(null); setPreview(null); }}>Clear</button>
              </div>
            </form>

            {preview && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>Detected columns: {preview.columns.join(', ')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div><div style={{ fontSize:12 }}>Map lead_id *</div><input list="stage-headers" value={mapping.lead_id} onChange={e=>setMapping(m=>({ ...m, lead_id: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map stage_name *</div><input list="stage-headers" value={mapping.stage_name} onChange={e=>setMapping(m=>({ ...m, stage_name: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map entered_at *</div><input list="stage-headers" value={mapping.entered_at} onChange={e=>setMapping(m=>({ ...m, entered_at: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map exited_at</div><input list="stage-headers" value={mapping.exited_at || ''} onChange={e=>setMapping(m=>({ ...m, exited_at: e.target.value }))} /></div>
                </div>
                <datalist id="stage-headers">{preview.columns.map(c=>(<option key={c} value={c}/>))}</datalist>

                <div style={{ marginTop: 12 }}>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fb' }}>{preview.columns.map((c, idx)=>(<th key={idx} style={{ padding:8, borderBottom:'1px solid #e2e8f0' }}>{c}</th>))}</tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i)=>(<tr key={i} style={{ background: i%2===0? '#fff':'#fafbff' }}>{preview.columns.map((_,j)=>(<td key={j} style={{ padding:8, borderBottom:'1px solid #edf2f7' }}>{r[j] ?? ''}</td>))}</tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={commitPreview}>Import Previewed Rows</button>
                  <button className="btn-ghost" onClick={()=>{ setPreview(null); setFile(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {message && <div className="muted" style={{ marginTop: 12 }}>{message}</div>}
        </div>
      </div>
    </Layout>
  );
}
