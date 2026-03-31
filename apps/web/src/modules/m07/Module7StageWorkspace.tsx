import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import './module7.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type PreviewState = { columns: string[]; rows: string[][] } | null;

function shell(title: string, subtitle: string) {
  return (
    <section
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid rgba(15,66,88,0.08)',
        boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
        background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
        color: '#fff',
      }}
    >
      <div style={{ padding: 28 }}>
        <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          M07 Stage Workspace
        </div>
        <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>{title}</h1>
        <div style={{ maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>{subtitle}</div>
      </div>
    </section>
  );
}

export default function Module7StageWorkspace(){
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [activeTab, setActiveTab] = useState<'list'|'manual'|'csv'>('list');
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [mapping, setMapping] = useState<{ lead_id: string; stage_name: string; entered_at: string; exited_at?: string }>({ lead_id: '', stage_name: '', entered_at: '' });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchList(); }, [workspace, search]);

  function getAuthHeaders(extra: Record<string,string> = {}){
    try {
      const token = localStorage.getItem('token');
      return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
    } catch {
      return extra;
    }
  }

  async function fetchList(){
    if(!workspace) return setMessage('workspace required');
    setLoading(true);
    setMessage(null);
    try{
      const params = new URLSearchParams({ workspace, search });
      const res = await fetch(`${API_URL}/m07/stages?${params.toString()}`);
      const j = await res.json();
      if(res.ok && j?.ok) setItems(j.items || []);
      else setMessage(j?.error || 'failed');
    }catch{
      setMessage('network error');
    }
    setLoading(false);
  }

  async function saveManual(e: React.FormEvent){
    e.preventDefault();
    if(!workspace) return setMessage('workspace required');
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form) as any);
    try{
      const res = await fetch(`${API_URL}/m07/stages`, {
        method: 'POST',
        headers: getAuthHeaders({'Content-Type':'application/json'}),
        body: JSON.stringify({ workspaceId: workspace, ...data })
      });
      const j = await res.json();
      if(res.ok && j?.ok){
        setMessage('Stage saved');
        form.reset();
        setActiveTab('list');
        fetchList();
      } else setMessage(j?.error || `save failed: HTTP ${res.status}`);
    }catch(e){
      setMessage('network error: ' + String((e as any).message || e));
    }
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
      const res = await fetch(`${API_URL}/m07/stages/upload/preview`, { method: 'POST', body: fd, headers: getAuthHeaders() });
      const j = await res.json();
      if(res.ok && j?.ok){
        setPreview({ columns: j.columns || [], rows: j.previewRows || [] });
        setMessage(null);
      } else setMessage(j?.error || `preview failed: HTTP ${res.status}`);
    }catch(e){
      setMessage('network error: ' + String((e as any).message || e));
    }
  }

  async function commitPreview(){
    if(!workspace) return setMessage('workspace required');
    if(!preview) return setMessage('no preview available');
    const cols = preview.columns;
    const rows = preview.rows;
    if(!mapping.lead_id || !mapping.stage_name || !mapping.entered_at) return setMessage('map lead_id, stage_name and entered_at');
    const leadIdx = cols.indexOf(mapping.lead_id);
    const stageIdx = cols.indexOf(mapping.stage_name);
    const enteredIdx = cols.indexOf(mapping.entered_at);
    if(leadIdx === -1 || stageIdx === -1 || enteredIdx === -1) return setMessage('mapped columns not found');
    const payloadRows = rows.map(r => ({
      lead_id: r[leadIdx] || '',
      stage_name: r[stageIdx] || '',
      entered_at: r[enteredIdx] || '',
      exited_at: mapping.exited_at ? r[cols.indexOf(mapping.exited_at)] : null
    }));
    try{
      const res = await fetch(`${API_URL}/m07/stages/upload/commit`, {
        method: 'POST',
        headers: getAuthHeaders({'Content-Type':'application/json'}),
        body: JSON.stringify({ workspaceId: workspace, rows: payloadRows, overwriteMode: 'overwrite_existing' })
      });
      const j = await res.json();
      if(res.ok && j?.ok){
        setMessage(`Imported ${j.importedCount} updated ${j.updatedCount} skipped ${j.skippedCount}`);
        setPreview(null);
        setFile(null);
        setActiveTab('list');
        fetchList();
      } else setMessage(j?.error || `commit failed: HTTP ${res.status}`);
    }catch(e){
      setMessage('network error: ' + String((e as any).message || e));
    }
  }

  function computeDurationDays(item:any){
    try{
      const entered = item.entered_at ? new Date(item.entered_at) : null;
      const exited = item.exited_at ? new Date(item.exited_at) : null;
      const now = new Date();
      if(entered && exited) return Math.round((exited.getTime() - entered.getTime()) / (1000*60*60*24));
      if(entered && !exited) return Math.round((now.getTime() - entered.getTime()) / (1000*60*60*24));
    }catch{}
    return '';
  }

  async function archive(id:string){
    if(!confirm('Archive this stage record?')) return;
    const res = await fetch(`${API_URL}/m07/stages/${id}/archive`, { method: 'POST' });
    if(res.ok) setItems(s => s.filter(x => x._id !== id));
  }

  async function remove(id:string){
    if(!confirm('Delete permanently?')) return;
    const res = await fetch(`${API_URL}/m07/stages/${id}/permanent`, { method: 'DELETE' });
    if(res.ok) setItems(s => s.filter(x => x._id !== id));
  }

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow">
          <ModuleBackButton toSuffix="" />
        </div>

        {shell(
          'Stage History Operations',
          'Review stage transition records, add one stage record manually, or import stage history in bulk from CSV without switching between separate M07 pages.'
        )}

        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-label">
            Stage Actions
          </div>
          <h3 className="m07-workspace-title">Manage stage records from one screen</h3>
          <div className="m07-workspace-copy">
            Switch between viewing funnel stage history, adding a single record, and importing batches from CSV.
          </div>
          <div className="m07-workspace-tabrow">
            {[
              ['list', 'View stages', 'Search, inspect, archive, and open stage records'],
              ['manual', 'Add stage', 'Create one stage history entry manually'],
              ['csv', 'CSV import', 'Preview and import mapped stage history rows'],
            ].map(([key, label, desc], idx) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`m07-workspace-tabbtn ${activeTab === key ? 'active' : ''}`}
              >
                <span className="m07-workspace-step">{idx + 1}</span>
                <span className="m07-workspace-tabmeta">
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'list' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Stage Table</h3>
            <div className="m07-workspace-toolbar">
              <input className="m07-workspace-search" placeholder="Search by lead or stage" value={search} onChange={e=>setSearch(e.target.value)} />
              <button className="btn-primary" onClick={fetchList}>Reload</button>
              <button className="btn-ghost" onClick={()=>{ setSearch(''); fetchList(); }}>Reset</button>
            </div>
            <div className="m07-workspace-sectiongap">
              {loading && <div style={{ fontSize: 12 }}>Loading...</div>}
              {message && <div className="muted">{message}</div>}
              {!loading && items.length === 0 && <div style={{ fontSize: 12 }}>No stage records found.</div>}
              {!loading && items.length > 0 && (
                <div className="m07-workspace-tablewrap">
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr style={{ background: '#f5f7fa' }}>
                        <th style={{ padding:6, textAlign:'left' }}>Lead ID</th>
                        <th style={{ padding:6, textAlign:'left' }}>Stage</th>
                        <th style={{ padding:6, textAlign:'left' }}>Entered</th>
                        <th style={{ padding:6, textAlign:'left' }}>Exited</th>
                        <th style={{ padding:6, textAlign:'left' }}>Status</th>
                        <th style={{ padding:6, textAlign:'left' }}>Duration (days)</th>
                        <th style={{ padding:6, textAlign:'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it._id} style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding:8 }}>{it.lead_id}</td>
                          <td style={{ padding:8 }}>{it.stage_name}</td>
                          <td style={{ padding:8 }}>{it.entered_at ? new Date(it.entered_at).toLocaleDateString() : ''}</td>
                          <td style={{ padding:8 }}>{it.exited_at ? new Date(it.exited_at).toLocaleDateString() : ''}</td>
                          <td style={{ padding:8 }}>{it.stage_status}</td>
                          <td style={{ padding:8 }}>{computeDurationDays(it)}</td>
                          <td style={{ padding:8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn-ghost" onClick={()=>{ if(workspace) window.location.hash = `#/workspace/${workspace}/m07/stages/${it._id}`; else window.location.hash = `#/m07/stages/${it._id}`; }}>View</button>
                            <button className="btn-ghost" onClick={()=>archive(it._id)}>Archive</button>
                            <button className="btn-danger" onClick={()=>remove(it._id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'manual' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Manual Add Stage Record</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">Each record represents a lead&apos;s time in a stage. Lead must already exist.</div>
            <form onSubmit={saveManual} style={{ marginTop: 14 }}>
              <div className="m07-workspace-formgrid">
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
          </section>
        )}

        {activeTab === 'csv' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>CSV Upload (Stage History)</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">CSV must include at least `lead_id`, `stage_name`, and `entered_at`.</div>
            <form onSubmit={uploadPreview} style={{ marginTop: 12 }}>
              <div className="m07-workspace-uploaderow">
                <input type="file" accept=".csv" onChange={(e)=> setFile(e.target.files ? e.target.files[0] : null)} />
              </div>
              <div className="m07-workspace-actionsrow">
                <button className="btn-primary" type="submit">Preview CSV</button>
                <button className="btn-ghost" type="button" style={{ marginLeft: 8 }} onClick={()=>{ setFile(null); setPreview(null); }}>Clear</button>
              </div>
            </form>

            {preview && (
              <div className="m07-workspace-sectiongap">
                <div className="m07-workspace-inlinehint">Detected columns: {preview.columns.join(', ')}</div>
                <div className="m07-workspace-formgrid m07-workspace-mappinggrid">
                  <div><div style={{ fontSize:12 }}>Map lead_id *</div><input list="stage-headers" value={mapping.lead_id} onChange={e=>setMapping(m=>({ ...m, lead_id: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map stage_name *</div><input list="stage-headers" value={mapping.stage_name} onChange={e=>setMapping(m=>({ ...m, stage_name: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map entered_at *</div><input list="stage-headers" value={mapping.entered_at} onChange={e=>setMapping(m=>({ ...m, entered_at: e.target.value }))} /></div>
                  <div><div style={{ fontSize:12 }}>Map exited_at</div><input list="stage-headers" value={mapping.exited_at || ''} onChange={e=>setMapping(m=>({ ...m, exited_at: e.target.value }))} /></div>
                </div>
                <datalist id="stage-headers">{preview.columns.map(c=>(<option key={c} value={c}/>))}</datalist>
                <div className="m07-workspace-tablewrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fb' }}>{preview.columns.map((c, idx)=>(<th key={idx} style={{ padding:8, borderBottom:'1px solid #e2e8f0' }}>{c}</th>))}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i)=>(<tr key={i} style={{ background: i%2===0? '#fff':'#fafbff' }}>{preview.columns.map((_,j)=>(<td key={j} style={{ padding:8, borderBottom:'1px solid #edf2f7' }}>{r[j] ?? ''}</td>))}</tr>))}
                    </tbody>
                  </table>
                </div>
                <div className="m07-workspace-actionsrow">
                  <button className="btn-primary" onClick={commitPreview}>Import Previewed Rows</button>
                  <button className="btn-ghost" onClick={()=>{ setPreview(null); setFile(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        {message && <div className="muted" style={{ marginTop: 12 }}>{message}</div>}
      </main>
    </Layout>
  );
}
