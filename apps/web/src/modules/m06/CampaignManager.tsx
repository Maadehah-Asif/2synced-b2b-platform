import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceId } from '../../utils/workspace'
function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop: 6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  )
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const ALLOWED_CHANNELS = new Set(['email','ads','linkedin','webinar','other'])
const MAX_PREVIEW_ROWS = 200
const PREVIEW_PAGE_SIZE = 12

export default function CampaignManager(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
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
  const [csvText, setCsvText] = useState('');
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: '', channel: 'email', startDate: '', endDate: '', description: '', tags: '', spend: '' });
  const [formErrors, setFormErrors] = useState<{[k:string]:string}>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [mapNameCol, setMapNameCol] = useState('name');
  const [mapChannelCol, setMapChannelCol] = useState('channel');
  const [mapCampaignIdCol, setMapCampaignIdCol] = useState('');
  const [mapStartDateCol, setMapStartDateCol] = useState('start_date');
  const [mapEndDateCol, setMapEndDateCol] = useState('end_date');
  const [mapDescriptionCol, setMapDescriptionCol] = useState('description');
  const [mapSpendCol, setMapSpendCol] = useState('spend');
  const [blockingWarnings, setBlockingWarnings] = useState<string[]>([]);
  const [nonBlockingWarnings, setNonBlockingWarnings] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
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
      const res = await fetch(`${API_URL}/m06/campaigns?${params.toString()}`);
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
    if(!f) {
      setHeadersPreview([]);
      setRowsPreview([]);
      setTotalPreviewRows(0);
      setPreviewPage(0);
      setPreviewLimited(false);
      setBlankRowCount(0);
      setCsvText('');
      setImportSummary(null);
      setSubmitStatus(null);
      setMappingConfirmed(false);
      setForceImport(false);
      return;
    }
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
      setCsvText(text);
      const normalized = text.replace(/\r\n?/g, '\n');
      const lines = normalized.split('\n');
      const headerLine = lines[0] || '';
      const cols = headerLine.split(',').map(s=>s.trim());
      setHeadersPreview(cols);
      const dataLines = lines.slice(1);
      const nonBlankLines = dataLines.filter(line => line.trim().length > 0);
      const limitedRows = nonBlankLines.slice(0, MAX_PREVIEW_ROWS).map(line => line.split(',').map(s=>s.trim()));
      setRowsPreview(limitedRows);
      setTotalPreviewRows(nonBlankLines.length);
      setPreviewLimited(nonBlankLines.length > MAX_PREVIEW_ROWS);
      setBlankRowCount(dataLines.length - nonBlankLines.length);
      setPreviewPage(0);
      const lowerCols = cols.map(c => c.toLowerCase());
      const pickHeader = (current: string, candidates: string[], fallbackIndex?: number) => {
        if(current && cols.includes(current)) return current;
        for(const candidate of candidates){
          const idx = lowerCols.indexOf(candidate);
          if(idx !== -1) return cols[idx];
        }
        if(fallbackIndex !== undefined && cols[fallbackIndex]) return cols[fallbackIndex];
        return '';
      };
      setMapNameCol(prev => pickHeader(prev, ['name','campaign','campaign_name','campaign name'], 0));
      setMapChannelCol(prev => pickHeader(prev, ['channel','utm_medium','source','utm_source']));
      setMapStartDateCol(prev => pickHeader(prev, ['start_date','start date','start','startdate','begin_date']));
      setMapEndDateCol(prev => pickHeader(prev, ['end_date','end date','end','finish_date']));
      setMapDescriptionCol(prev => pickHeader(prev, ['description','campaign description','details','notes']));
      setMapSpendCol(prev => pickHeader(prev, ['spend','amount','cost','budget']));
      setMapCampaignIdCol(prev => pickHeader(prev, ['campaign_id','campaign id','campaignid','id','camp_id','campaign identifier']));
      setImportSummary(null);
      setSubmitStatus(null);
      setMappingConfirmed(false);
      setForceImport(false);
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
      const findIdx = (value: string) => {
        if(!value) return -1;
        const exact = headersPreview.indexOf(value);
        if(exact >= 0) return exact;
        const lower = value.toLowerCase();
        return headersPreview.findIndex(h => h.toLowerCase() === lower);
      };
      const nameIdx = findIdx(mapNameCol);
      const channelIdx = findIdx(mapChannelCol);
      if(!mapNameCol) blocking.push('Select a column for campaign name');
      else if(nameIdx === -1) blocking.push(`Column "${mapNameCol}" not found for campaign name`);
      if(!mapChannelCol) blocking.push('Select a column for campaign channel');
      else if(channelIdx === -1) blocking.push(`Column "${mapChannelCol}" not found for campaign channel`);

      if(mapStartDateCol){
        const idx = findIdx(mapStartDateCol);
        if(idx === -1) nonBlocking.push(`Column "${mapStartDateCol}" not found for start date`);
        else if(rowsPreview.length){
          const badDates = rowsPreview.filter(r=>{
            const v = (r[idx] || '').trim();
            return v && Number.isNaN(Date.parse(v));
          }).length;
          if(badDates) nonBlocking.push(`Start date format issue: ${badDates}/${rowsPreview.length} rows look invalid`);
        }
      }

      if(mapEndDateCol){
        const idx = findIdx(mapEndDateCol);
        if(idx === -1) nonBlocking.push(`Column "${mapEndDateCol}" not found for end date`);
        else if(rowsPreview.length){
          const badDates = rowsPreview.filter(r=>{
            const v = (r[idx] || '').trim();
            return v && Number.isNaN(Date.parse(v));
          }).length;
          if(badDates) nonBlocking.push(`End date format issue: ${badDates}/${rowsPreview.length} rows look invalid`);
        }
      }

      if(mapSpendCol){
        const idx = findIdx(mapSpendCol);
        if(idx === -1) nonBlocking.push(`Column "${mapSpendCol}" not found for spend`);
        else if(rowsPreview.length){
          const badAmts = rowsPreview.filter(r=>{
            const v = (r[idx] || '').trim();
            if(!v) return false;
            const numeric = Number(String(v).replace(/[^0-9.-]/g,''));
            return Number.isNaN(numeric);
          }).length;
          if(badAmts) blocking.push(`Spend format issue: ${badAmts}/${rowsPreview.length} values not numeric`);
        }
      }

      if(mapDescriptionCol && findIdx(mapDescriptionCol) === -1){
        nonBlocking.push(`Column "${mapDescriptionCol}" not found for description`);
      }

      if(nameIdx >= 0 && rowsPreview.length){
        const seen = new Set<string>();
        const dups = new Set<string>();
        rowsPreview.forEach(r=>{
          const v = (r[nameIdx] || '').trim();
          if(!v) return;
          if(seen.has(v)) dups.add(v); else seen.add(v);
        });
        if(dups.size) nonBlocking.push(`Potential duplicate names: ${Array.from(dups).slice(0,5).join(', ')}${dups.size>5?'…':''}`);
      }

      if(channelIdx >= 0 && rowsPreview.length){
        const unknown = new Set<string>();
        rowsPreview.forEach(r=>{
          const v = (r[channelIdx] || '').trim().toLowerCase();
          if(v && !ALLOWED_CHANNELS.has(v)) unknown.add(v);
        });
        if(unknown.size) nonBlocking.push(`Unknown channel values detected: ${Array.from(unknown).slice(0,5).join(', ')}${unknown.size>5?'…':''}`);
      }

      if(mapCampaignIdCol){
        const idx = findIdx(mapCampaignIdCol);
        if(idx === -1) nonBlocking.push(`Column "${mapCampaignIdCol}" not found for campaign ID`);
      }
    }
    setBlockingWarnings(blocking);
    setNonBlockingWarnings(nonBlocking);
  },[headersPreview, rowsPreview, mapNameCol, mapChannelCol, mapStartDateCol, mapEndDateCol, mapDescriptionCol, mapSpendCol, mapCampaignIdCol]);

  useEffect(()=>{
    setPreviewPage(prev => {
      if(!rowsPreview.length) return 0;
      const maxIndex = Math.max(0, Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) - 1);
      return Math.min(prev, maxIndex);
    });
  },[rowsPreview]);

  const previewPageCount = rowsPreview.length ? Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) : 1;
  const currentPreviewPage = rowsPreview.length ? Math.min(previewPage, previewPageCount - 1) : 0;
  const previewPageRows = rowsPreview.slice(currentPreviewPage * PREVIEW_PAGE_SIZE, (currentPreviewPage * PREVIEW_PAGE_SIZE) + PREVIEW_PAGE_SIZE);
  const previewStartIndex = rowsPreview.length ? (currentPreviewPage * PREVIEW_PAGE_SIZE) + 1 : 0;
  const previewEndIndex = rowsPreview.length ? Math.min(rowsPreview.length, previewStartIndex + PREVIEW_PAGE_SIZE - 1) : 0;

  async function submitWizard(){
    if(!workspaceId) return;
    if(!file){ alert('Select a CSV file'); return; }
    if(!csvText.trim()){ setToast({ msg: 'Unable to read CSV file contents', type: 'error' }); return; }
    setSubmitStatus(null);
    if(!mapNameCol || !mapChannelCol){ setToast({ msg: 'Campaign name and channel mappings are required', type: 'error' }); return; }
    if(!mappingConfirmed){ setToast({ msg: 'Confirm mappings with the checkbox', type: 'error' }); return; }
    if(blockingWarnings.length && !forceImport){ setToast({ msg: 'Blocking issues present. Fix or enable Force Import.', type: 'error' }); return; }
    const resolveHeader = (value: string | null | undefined) => {
      if(!value) return null;
      const match = headersPreview.find(h => h.toLowerCase() === value.toLowerCase());
      return match || null;
    };
    const resolvedName = resolveHeader(mapNameCol);
    const resolvedChannel = resolveHeader(mapChannelCol);
    if(!resolvedName || !resolvedChannel){ setToast({ msg: 'Mapped columns do not match CSV headers', type: 'error' }); return; }
    const payload:any = {
      projectId: workspaceId,
      csv: csvText,
      map: {
        campaign_id: resolveHeader(mapCampaignIdCol),
        name: resolvedName,
        channel: resolvedChannel,
        start_date: resolveHeader(mapStartDateCol),
        end_date: resolveHeader(mapEndDateCol),
        description: resolveHeader(mapDescriptionCol),
        spend: resolveHeader(mapSpendCol),
      },
      startRow: Number(startRow || 1),
    };
    if(endRow) payload.endRow = Number(endRow);
    try{
      const res = await fetch(`${API_URL}/m06/campaigns/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if(!res.ok){
        setSubmitStatus(j && j.error ? String(j.error) : 'Import failed');
        setImportSummary(null);
      }
      else {
        setSubmitStatus(`Imported ${j.created || 0} campaigns (${j.skipped || 0} skipped)`);
        setImportSummary({
          created: j.created ?? 0,
          skipped: j.skipped ?? 0,
          selected: j.selected ?? 0,
          errors: Array.isArray(j.errors) ? j.errors : []
        });
        setToast({ msg: `CSV import finished – ${j.created || 0} created`, type: 'success' });
        fetchCampaigns();
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
      const url = selected ? `${API_URL}/m06/campaigns/${selected.id}` : `${API_URL}/m06/campaigns`;
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

  async function archive(c:any){ if(!confirm('Archive this campaign?')) return; const res = await fetch(`${API_URL}/m06/campaigns/${encodeURIComponent(c.id)}/archive`, { method: 'POST' }); if(res.ok) fetchCampaigns(); }

  async function addSpend(c:any){ const date = prompt('Enter date (YYYY-MM-DD)'); const amount = prompt('Amount'); if(!date || !amount) return; const res = await fetch(`${API_URL}/m06/campaigns/${encodeURIComponent(c.id)}/spend`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ date, amount }) }); if(res.ok) fetchCampaigns(); else { const j = await res.json(); alert('Error: ' + (j && j.error)); } }

  // per-campaign CSV paste was removed — use 'Add Spend' for single entries or the workspace import below

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop: 16 }}>Add Campaigns</h2>
        <div style={{ marginTop: 8 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>
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
            <div style={{ marginTop: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(17, 24, 39, 0.08)', maxWidth: 1100 }}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0 }}>{selected ? 'Edit Campaign' : 'New Campaign'}</h4>
                <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Required: name, channel, start date. Optional: spend and tags. Keep dates in YYYY-MM-DD.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Name *</label>
                  <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="e.g., Q1 ABM pilot" style={{ width:'100%' }} />
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>3-80 characters; something your team recognizes.</div>
                  {formErrors.name && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.name}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Channel *</label>
                  <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} style={{ width:'100%' }}>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Sets default channel for touches and reporting.</div>
                  {formErrors.channel && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.channel}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Start date *</label>
                  <input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate: e.target.value})} style={{ width:'100%' }} />
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Use YYYY-MM-DD; we use this for timelines.</div>
                  {formErrors.startDate && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.startDate}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>End date</label>
                  <input type="date" value={form.endDate} onChange={e=>setForm({...form, endDate: e.target.value})} style={{ width:'100%' }} />
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Optional; leave blank for ongoing.</div>
                  {formErrors.endDate && <div style={{ color:'#c33', fontSize:12 }}>{formErrors.endDate}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Total spend</label>
                  <input value={form.spend} onChange={e=>setForm({...form, spend: e.target.value})} placeholder="e.g., 25000" style={{ width:'100%' }} />
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Numbers only; used for ROI.</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Tags</label>
                  <input value={form.tags} onChange={e=>setForm({...form, tags: e.target.value})} placeholder="brand, paid-social" style={{ width:'100%' }} />
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Comma-separated; 3-5 short tags recommended.</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Description</label>
                <textarea rows={3} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Short summary for the team" style={{ width:'100%', marginTop:6 }} />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>1-2 sentences to remind teammates what this campaign does.</div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={submitForm}>Save</button>
                <button className="btn-ghost" onClick={()=>{ setShowForm(false); setSelected(null); }}>Cancel</button>
              </div>
            </div>
          )}
          {/* Bulk CSV wizard */}
          {showWizard && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 920 }}>
                <h3>Upload Campaigns CSV</h3>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>First row must contain headers. Preview is limited to the first {MAX_PREVIEW_ROWS} rows.</div>
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept=".csv" onChange={onFileChange} />
                </div>
                {headerError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#c33' }}>{headerError}</div>
                )}
                {!headerError && headersPreview.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>Detected headers: {headersPreview.join(', ')}</div>
                )}
                {rowsPreview.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      Previewing rows {previewStartIndex}-{previewEndIndex} of {rowsPreview.length}
                      {previewLimited ? ` (showing first ${rowsPreview.length} of ${totalPreviewRows})` : totalPreviewRows ? ` (total rows: ${totalPreviewRows})` : ''}
                      {blankRowCount > 0 ? ` • Blank lines skipped: ${blankRowCount}` : ''}
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fb' }}>
                            {headersPreview.map((h, idx) => (
                              <th key={idx} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewPageRows.map((row, rIdx) => (
                            <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#fff' : '#fafbff' }}>
                              {headersPreview.map((_, cIdx) => (
                                <td key={cIdx} style={{ padding: 8, borderBottom: '1px solid #edf2f7', fontSize: 12 }}>
                                  {row[cIdx] ?? ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rowsPreview.length > PREVIEW_PAGE_SIZE && (
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: '#555' }}>Page {currentPreviewPage + 1} of {previewPageCount}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-ghost" disabled={currentPreviewPage === 0} onClick={() => setPreviewPage(p => Math.max(0, p - 1))}>Prev</button>
                          <button className="btn-ghost" disabled={currentPreviewPage >= previewPageCount - 1} onClick={() => setPreviewPage(p => Math.min(previewPageCount - 1, p + 1))}>Next</button>
                        </div>
                      </div>
                    )}
                    {previewLimited && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#777' }}>Showing a sample of the first {MAX_PREVIEW_ROWS} rows for validation.</div>
                    )}
                  </div>
                )}
                {rowsPreview.length === 0 && headersPreview.length > 0 && totalPreviewRows === 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>No data rows detected after the header.</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16, alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: 12 }}>Campaign name header *</div>
                    <input list="campaign-upload-headers" value={mapNameCol} onChange={e=>setMapNameCol(e.target.value)} placeholder="Column name" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Channel header *</div>
                    <input list="campaign-upload-headers" value={mapChannelCol} onChange={e=>setMapChannelCol(e.target.value)} placeholder="Column name" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Campaign ID header</div>
                    <input list="campaign-upload-headers" value={mapCampaignIdCol} onChange={e=>setMapCampaignIdCol(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Start date header</div>
                    <input list="campaign-upload-headers" value={mapStartDateCol} onChange={e=>setMapStartDateCol(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>End date header</div>
                    <input list="campaign-upload-headers" value={mapEndDateCol} onChange={e=>setMapEndDateCol(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Description header</div>
                    <input list="campaign-upload-headers" value={mapDescriptionCol} onChange={e=>setMapDescriptionCol(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>Spend header</div>
                    <input list="campaign-upload-headers" value={mapSpendCol} onChange={e=>setMapSpendCol(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
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
                <datalist id="campaign-upload-headers">
                  {headerOptions.map(opt => (
                    <option key={opt.value} value={opt.value} />
                  ))}
                </datalist>
                {(blockingWarnings.length || nonBlockingWarnings.length) && (
                  <div style={{ marginTop: 8, background:'#fff3cd', color:'#664d03', padding:10, borderRadius:8, fontSize:12 }}>
                    <div style={{ fontWeight:600, marginBottom:4 }}>Import diagnostics</div>
                    {blockingWarnings.map((w,i)=> (<div key={'b'+i}>• {w} (blocking)</div>))}
                    {nonBlockingWarnings.map((w,i)=> (<div key={'n'+i}>• {w}</div>))}
                  </div>
                )}
                <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 12 }}>
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
                    <div>Selected rows: {importSummary.selected}</div>
                    <div>Created: {importSummary.created}</div>
                    <div>Skipped: {importSummary.skipped}</div>
                    <div>Errors: {importSummary.errors ? importSummary.errors.length : 0}</div>
                    {importSummary.errors && importSummary.errors.length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ marginBottom:6 }}>
                          {importSummary.errors.slice(0,3).map((err:any, idx:number)=>(
                            <div key={idx}>Row {err.row}: {String(err.reason || '')}</div>
                          ))}
                          {importSummary.errors.length > 3 && <div>…and {importSummary.errors.length - 3} more</div>}
                        </div>
                        <button className="btn-ghost" disabled={downloadingErrors} onClick={()=>{
                          if(!importSummary.errors || !importSummary.errors.length) return;
                          try {
                            setDownloadingErrors(true);
                            const header = ['row','reason'];
                            const lines = [header.join(',')].concat(importSummary.errors.map((fr:any)=> `${fr.row},"${String(fr.reason||'').replace(/"/g,'""')}"`));
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
                    {(!importSummary.errors || importSummary.errors.length === 0) && (
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
