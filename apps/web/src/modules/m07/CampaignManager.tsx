import Layout from '../../components/Layout'
import { useEffect, useMemo, useState } from 'react'
function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop: 6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  )
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function CampaignManager(){
  const workspaceId = useWorkspaceIdFromHash();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [endRow, setEndRow] = useState<number | undefined>(undefined);
  const [showWizard, setShowWizard] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: '', channel: 'email', startDate: '', endDate: '', description: '', tags: '', spend: '' });
  const [formErrors, setFormErrors] = useState<{[k:string]:string}>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [multiCsvText, setMultiCsvText] = useState('');
  const [mapCampaignCol, setMapCampaignCol] = useState('campaign');
  const [mapDateCol, setMapDateCol] = useState('date');
  const [mapAmountCol, setMapAmountCol] = useState('amount');
  const [blockingWarnings, setBlockingWarnings] = useState<string[]>([]);
  const [nonBlockingWarnings, setNonBlockingWarnings] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [toast, setToast] = useState<{msg:string, type:'success'|'error'}|null>(null);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  async function fetchCampaigns(){
    if(!workspaceId) return;
    setLoading(true); setError(null);
    try{
      const params = new URLSearchParams({
        projectId: workspaceId,
        search,
        channel: channelFilter,
        includeArchived: String(includeArchived),
        createdFrom,
        createdTo,
        startFrom,
        startTo,
      });
      const res = await fetch(`${API_URL}/m07/campaigns?${params.toString()}`);
      const j = await res.json();
      if(!res.ok) { setError(j && j.error ? j.error : 'error'); setCampaigns([]); }
      else setCampaigns(j.campaigns || []);
    }catch(e){ setError('network error'); }
    setLoading(false);
  }

  useEffect(()=>{ fetchCampaigns() },[workspaceId, search, channelFilter, includeArchived, createdFrom, createdTo, startFrom, startTo])
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    if(!f) { setHeadersPreview([]); setRowsPreview([]); return; }
    // basic file validations
    if(!f.name.toLowerCase().endsWith('.csv')){
      setToast({ msg: 'Please select a .csv file', type: 'error' });
      return;
    }
    if(f.size > 5 * 1024 * 1024){
      setToast({ msg: 'File too large (max 5MB)', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
      const firstLine = lines[0] || '';
      const cols = firstLine.split(',').map(s=>s.trim());
      setHeadersPreview(cols);
      const previewRows: string[][] = lines.slice(1, 6).map(line => line.split(',').map(s=>s.trim()));
      setRowsPreview(previewRows);
      if(cols.length < 2){
        setHeaderError('Could not detect valid headers. Ensure first row has column names.');
      } else {
        setHeaderError(null);
      }
    };
    reader.readAsText(f);
  }

  // derive dropdown options and mapping warnings
  const headerOptions = useMemo(()=>headersPreview.map(h=>({ value: h, label: h })),[headersPreview]);
  useEffect(()=>{
    const blocking:string[] = [];
    const nonBlocking:string[] = [];
    if(headersPreview.length){
      if(!headersPreview.includes(mapCampaignCol)) blocking.push(`Missing campaign header: "${mapCampaignCol}"`);
      if(!headersPreview.includes(mapDateCol)) blocking.push(`Missing date header: "${mapDateCol}"`);
      if(!headersPreview.includes(mapAmountCol)) blocking.push(`Missing amount header: "${mapAmountCol}"`);
      const dateIdx = headersPreview.indexOf(mapDateCol);
      const amtIdx = headersPreview.indexOf(mapAmountCol);
      if(dateIdx >= 0 && rowsPreview.length){
        const badDates = rowsPreview.filter(r=>{
          const v = r[dateIdx] || '';
          return v && !/^\d{4}-\d{2}-\d{2}$/.test(v);
        }).length;
        if(badDates){ nonBlocking.push(`Date format issue: ${badDates}/${rowsPreview.length} rows not YYYY-MM-DD`); }
      }
      if(amtIdx >= 0 && rowsPreview.length){
        const badAmts = rowsPreview.filter(r=>{
          const v = r[amtIdx] || '';
          return v && isNaN(Number(v));
        }).length;
        if(badAmts){ blocking.push(`Amount format issue: ${badAmts}/${rowsPreview.length} non-numeric values`); }
      }
      const campIdx = headersPreview.indexOf(mapCampaignCol);
      if(campIdx >= 0 && rowsPreview.length){
        const seen = new Set<string>();
        const dups = new Set<string>();
        rowsPreview.forEach(r=>{ const v = r[campIdx]; if(v){ if(seen.has(v)) dups.add(v); else seen.add(v); } });
        if(dups.size){ nonBlocking.push(`Potential duplicate names: ${Array.from(dups).slice(0,5).join(', ')}${dups.size>5?'…':''}`); }
      }
    }
    setBlockingWarnings(blocking);
    setNonBlockingWarnings(nonBlocking);
  },[headersPreview, rowsPreview, mapCampaignCol, mapDateCol, mapAmountCol]);

  async function submitWizard(){
    if(!workspaceId) return;
    if(!file){ alert('Select a CSV file'); return; }
    setSubmitStatus(null);
    if(!mapCampaignCol || !mapDateCol || !mapAmountCol){ setToast({ msg: 'Fill all mapping fields', type: 'error' }); return; }
    if(!mappingConfirmed){ setToast({ msg: 'Confirm mappings with the checkbox', type: 'error' }); return; }
    if(blockingWarnings.length && !forceImport){ setToast({ msg: 'Blocking issues present. Fix or enable Force Import.', type: 'error' }); return; }
    const form = new FormData();
    form.append('projectId', workspaceId);
    form.append('file', file);
    form.append('mapCampaignCol', mapCampaignCol);
    form.append('mapDateCol', mapDateCol);
    form.append('mapAmountCol', mapAmountCol);
    form.append('startRow', String(startRow||1));
    if(endRow) form.append('endRow', String(endRow));
    try{
      const res = await fetch(`${API_URL}/m07/campaigns/import/csv`, { method: 'POST', body: form });
      const j = await res.json();
      if(!res.ok){ setSubmitStatus(j && j.error ? String(j.error) : 'Import failed'); }
      else {
        setSubmitStatus(`Imported ${j.inserted || 0} campaigns`);
        setImportSummary({
          processed: j.processed ?? j.inserted ?? 0,
          imported: j.inserted ?? 0,
          failed: (j.failedRows && Array.isArray(j.failedRows)) ? j.failedRows.length : (j.failed ?? 0),
          failedRows: j.failedRows || null
        });
        setToast({ msg: `CSV import finished – ${j.inserted || 0} imported`, type: 'success' });
      }
    }catch(e){ alert('Network error'); }
  }

  async function submitForm(){
    if(!workspaceId) return;
    const errs:any = {};
    if(!form.name) errs.name = 'Name is required';
    if(!form.channel) errs.channel = 'Channel is required';
    if(!form.startDate) errs.startDate = 'Start date is required';
    if(form.endDate && form.startDate && new Date(form.endDate) < new Date(form.startDate)) errs.endDate = 'End date cannot be before start date';
    setFormErrors(errs);
    if(Object.keys(errs).length) return;
    const payload: any = { name: form.name, channel: form.channel, startDate: form.startDate || undefined, endDate: form.endDate || undefined, description: form.description || undefined, tags: form.tags ? form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean) : [], spend: form.spend ? Number(form.spend) : 0 };
    try{
      const url = selected ? `${API_URL}/m07/campaigns/${selected.id}` : `${API_URL}/m07/campaigns`;
      const method = selected ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if(!res.ok) { setToast({ msg: 'Error: ' + (j && j.error || 'Failed to save'), type: 'error' }); return; }
      setShowForm(false); setSelected(null); setForm({ name: '', channel: 'email', startDate: '', endDate: '', description: '', tags: '', spend: '' });
      fetchCampaigns();
      setToast({ msg: selected ? 'Campaign updated' : 'Campaign created successfully', type: 'success' });
    }catch(e){ alert('network error'); }
  }

  async function openEdit(c:any){ setSelected(c); setForm({ name: c.name||'', channel: c.channel||'email', startDate: c.start_date? new Date(c.start_date).toISOString().slice(0,10):'', endDate: c.end_date? new Date(c.end_date).toISOString().slice(0,10):'', description: c.description||'', tags: (c.tags||[]).join(', '), spend: c.spend||0 }); setShowForm(true); }

  async function archive(c:any){ if(!confirm('Archive this campaign?')) return; const res = await fetch(`${API_URL}/m07/campaigns/${encodeURIComponent(c.id)}/archive`, { method: 'POST' }); if(res.ok) fetchCampaigns(); }

  async function addSpend(c:any){ const date = prompt('Enter date (YYYY-MM-DD)'); const amount = prompt('Amount'); if(!date || !amount) return; const res = await fetch(`${API_URL}/m07/campaigns/${encodeURIComponent(c.id)}/spend`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ date, amount }) }); if(res.ok) fetchCampaigns(); else { const j = await res.json(); alert('Error: ' + (j && j.error)); } }

  // per-campaign CSV paste was removed — use 'Add Spend' for single entries or the workspace import below

  async function uploadCsvMulti(){
    if(!workspaceId) return alert('Open a workspace first');
    if(!multiCsvText) return alert('Paste CSV text into textarea');
    setImportResult(null);
    const payload:any = { csv: multiCsvText, campaignColumn: mapCampaignCol || null, dateColumn: mapDateCol || null, amountColumn: mapAmountCol || null, startRow: Number(startRow), projectId: workspaceId };
    try{
      const res = await fetch(`${API_URL}/m07/campaigns/spend/csv`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if(!res.ok) { alert('Import error: ' + (j && j.error)); setImportResult({ error: j && j.error }); return; }
      setImportResult(j);
      setMultiCsvText('');
      fetchCampaigns();
    }catch(e){ alert('Network error'); }
  }

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop: 16 }}>Add Campaigns</h2>
        {!workspaceId && <div style={{ fontSize: 13 }}>Open a workspace to manage campaigns.</div>}
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <button className="btn-primary" onClick={()=>{ setShowForm(true); setSelected(null); }}>New Campaign</button>
            <button className="btn-ghost" onClick={fetchCampaigns} style={{ marginLeft: 8 }}>Refresh</button>
            <button className="btn-ghost" onClick={()=>setShowWizard(true)} style={{ marginLeft: 8 }}>Upload CSV (Wizard)</button>
          </div>

          {/* This page is for adding only; listing moved to ViewCampaigns */}
          {/* Listing removed; see ViewCampaigns page */}
          {showForm && (
            <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
              <h4>{selected ? 'Edit Campaign' : 'New Campaign'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12 }}>Name</div>
                  <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                  {formErrors.name && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.name}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Channel</div>
                  <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})}>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                  {formErrors.channel && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.channel}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Start date</div>
                  <input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate: e.target.value})} />
                  {formErrors.startDate && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.startDate}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>End date</div>
                  <input type="date" value={form.endDate} onChange={e=>setForm({...form, endDate: e.target.value})} />
                  {formErrors.endDate && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.endDate}</div>}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12 }}>Description</div>
                  <input value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Tags (comma separated)</div>
                  <input value={form.tags} onChange={e=>setForm({...form, tags: e.target.value})} />
                </div>
                <div>
                  <div style={{ fontSize: 12 }}>Total spend</div>
                  <input value={form.spend} onChange={e=>setForm({...form, spend: e.target.value})} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={submitForm}>Save</button>
                <button className="btn-ghost" onClick={()=>{ setShowForm(false); setSelected(null); }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Removed duplicate paste-based CSV import. Use the Wizard below for uploads. */}

          {showWizard && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 800 }}>
                <h3>Upload Campaigns CSV</h3>
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept=".csv" onChange={onFileChange} />
                </div>
                {headersPreview.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    Detected headers: {headersPreview.join(', ')}
                  </div>
                )}
                {headerError && (
                  <div style={{ marginTop: 8, fontSize: 12, color:'#c33' }}>{headerError}</div>
                )}
                {rowsPreview.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>Preview (first {rowsPreview.length} rows):</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                          {headersPreview.map((h,i)=>(<th key={i} style={{ padding: 6, borderBottom: '1px solid #eee' }}>{h}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsPreview.map((r,ri)=>(
                          <tr key={ri}>
                            {headersPreview.map((_,ci)=>(<td key={ci} style={{ padding: 6, borderBottom: '1px solid #f3f3f3' }}>{r[ci]||''}</td>))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px 160px', gap: 12, marginTop: 12, alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: 12 }}>Campaign column header</div>
                    <select value={mapCampaignCol} onChange={e=>setMapCampaignCol(e.target.value)} style={{ width: '100%' }}>
                      {headerOptions.length ? headerOptions.map(h=> (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      )) : (<option value={mapCampaignCol}>{mapCampaignCol}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Date column header</div>
                    <select value={mapDateCol} onChange={e=>setMapDateCol(e.target.value)} style={{ width: '100%' }}>
                      {headerOptions.length ? headerOptions.map(h=> (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      )) : (<option value={mapDateCol}>{mapDateCol}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Amount column header</div>
                    <select value={mapAmountCol} onChange={e=>setMapAmountCol(e.target.value)} style={{ width: '100%' }}>
                      {headerOptions.length ? headerOptions.map(h=> (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      )) : (<option value={mapAmountCol}>{mapAmountCol}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Start row</div>
                    <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>End row</div>
                    <input type="number" min={1} placeholder="auto" value={endRow !== undefined ? String(endRow) : ''} onChange={e=>{
                      const v = e.target.value;
                      setEndRow(v ? Number(v) : undefined);
                    }} style={{ width: '100%' }} />
                  </div>
                </div>
                {(blockingWarnings.length || nonBlockingWarnings.length) && (
                  <div style={{ marginTop: 8, background:'#fff3cd', color:'#664d03', padding:10, borderRadius:8, fontSize:12 }}>
                    <div style={{ fontWeight:600, marginBottom:4 }}>Import diagnostics</div>
                    {blockingWarnings.map((w,i)=> (<div key={'b'+i}>• {w} (blocking)</div>))}
                    {nonBlockingWarnings.map((w,i)=> (<div key={'n'+i}>• {w}</div>))}
                  </div>
                )}
                <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 10 }}>
                  <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
                  <span style={{ fontSize: 12 }}>I have reviewed my mappings and confirm they are correct.</span>
                </label>
                {blockingWarnings.length > 0 && (
                  <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6 }}>
                    <input type="checkbox" checked={forceImport} onChange={e=>setForceImport(e.target.checked)} />
                    <span style={{ fontSize: 12 }}>Force import despite blocking issues</span>
                  </label>
                )}
                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary" onClick={submitWizard}>Submit</button>
                  <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={()=>setShowWizard(false)}>Cancel</button>
                </div>
                {submitStatus && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {submitStatus}
                  </div>
                )}
                {importSummary && (
                  <div style={{ marginTop: 12, background:'#f5f7fa', padding:12, borderRadius:8, fontSize:12 }}>
                    <div style={{ fontWeight:600, marginBottom:4 }}>Import Summary</div>
                    <div>Processed: {importSummary.processed}</div>
                    <div>Imported: {importSummary.imported}</div>
                    <div>Failed: {importSummary.failed}</div>
                    {importSummary.failedRows && importSummary.failedRows.length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <button className="btn-ghost" disabled={downloadingErrors} onClick={()=>{
                          if(!importSummary.failedRows) return;
                          try {
                            setDownloadingErrors(true);
                            const header = ['row','error'];
                            const lines = [header.join(',')].concat(importSummary.failedRows.map((fr:any)=> `${fr.rowNumber},"${(fr.error||'').replace(/"/g,'""')}"`));
                            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = 'import_errors.csv'; a.click();
                            setTimeout(()=>{ URL.revokeObjectURL(url); setDownloadingErrors(false); }, 1000);
                          } catch(err){ setDownloadingErrors(false); setToast({ msg:'Failed to download error CSV', type:'error' }); }
                        }}>Download error CSV</button>
                        <button className="btn-primary" style={{ marginLeft:8 }} onClick={()=>{
                          setImportSummary(null); setSubmitStatus(null); setForceImport(false); setMappingConfirmed(false);
                        }}>Retry</button>
                      </div>
                    )}
                    {!importSummary.failedRows && importSummary.failed === 0 && (
                      <div style={{ marginTop:8, color:'#0a7' }}>All rows imported successfully.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {toast && (
          <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />
        )}

        </div>
      </main>
    </Layout>
  )
}
