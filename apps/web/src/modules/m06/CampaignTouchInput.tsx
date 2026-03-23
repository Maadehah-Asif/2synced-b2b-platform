import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createTouch, importTouchesCSV, searchCampaigns, searchLeads } from './services/touches';
import Autocomplete from '../../components/Autocomplete';
import { useWorkspaceId } from '../../utils/workspace';

const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  );
}

export default function CampaignTouchInput(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [activeTab, setActiveTab] = useState<'form'|'csv'>('form');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

  // Form state
  const [leadQuery, setLeadQuery] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [channel, setChannel] = useState('email');
  const [type, setType] = useState('email_open');
  const [touchedAt, setTouchedAt] = useState('');
  const [metadata, setMetadata] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});

  // CSV wizard state
  const [csvText, setCsvText] = useState('');
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [mapLead, setMapLead] = useState('');
  const [mapCampaign, setMapCampaign] = useState('');
  const [mapChannel, setMapChannel] = useState('');
  const [mapType, setMapType] = useState('');
  const [mapTouchedAt, setMapTouchedAt] = useState('');
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number|undefined>(undefined);
  const [uploadSummary, setUploadSummary] = useState<any|null>(null);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip'|'allow'>('skip');
  const [importing, setImporting] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const [campaignIdentifier, setCampaignIdentifier] = useState<'name'|'campaign_id'>('name');

  useEffect(()=>{
    let ignore = false;
    async function run(){
      if(!campaignQuery) { setCampaignOptions([]); return; }
      const r = await searchCampaigns(campaignQuery);
      if(!ignore) setCampaignOptions(r.campaigns || []);
    }
    run();
    return ()=>{ ignore=true };
  },[campaignQuery]);

  useEffect(()=>{
    let ignore=false;
    async function run(){
      if(!leadQuery){ setLeadOptions([]); return; }
      const r = await searchLeads(leadQuery);
      if(!ignore) setLeadOptions(r.leads||[]);
    }
    run();
    return ()=>{ ignore=true };
  },[leadQuery]);

  function validateForm(){
    const errs: Record<string,string> = {};
    if(!selectedLead) errs.lead = 'Lead required';
    if(!selectedCampaign) errs.campaign = 'Campaign required';
    if(!touchedAt) errs.touched_at = 'Datetime required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitForm(){
    if(!workspaceId) { setToast({ msg:'Open a workspace first', type:'error'}); return; }
    if(!validateForm()) return;
    let metadataObj: any = undefined;
    if(metadata.trim()) {
      try {
        metadataObj = JSON.parse(metadata);
      } catch(e){
        setToast({ msg:'Metadata must be valid JSON', type:'error'});
        return;
      }
    }
    const res = await createTouch({ leadId: selectedLead, campaignId: selectedCampaign, type, channel, touched_at: touchedAt, metadata: metadataObj });
    if((res as any).error) {
      setToast({ msg:'Error creating touch', type:'error'});
    } else {
      setToast({ msg:'Touch created', type:'success'});
      setSelectedLead('');
      setSelectedCampaign('');
      setLeadQuery('');
      setCampaignQuery('');
      setTouchedAt('');
      setMetadata('');
      setFormErrors({});
    }
  }

  function resetCsvState(){
    setCsvText('');
    setHeadersPreview([]);
    setRowsPreview([]);
    setTotalPreviewRows(0);
    setPreviewLimited(false);
    setBlankRowCount(0);
    setPreviewPage(0);
    setHeaderError(null);
    setMapLead('');
    setMapCampaign('');
    setMapChannel('');
    setMapType('');
    setMapTouchedAt('');
    setStartRow(1);
    setEndRow(undefined);
    setUploadSummary(null);
    setMappingConfirmed(false);
    setForceImport(false);
    setImporting(false);
    setCampaignIdentifier('name');
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>){
    const input = e.target;
    const f = input.files && input.files[0];
    resetCsvState();
    if(!f){
      input.value = '';
      return;
    }
    if(!f.name.toLowerCase().endsWith('.csv')){
      setToast({ msg: 'Please select a .csv file', type: 'error' });
      input.value = '';
      return;
    }
    if(f.size > 5 * 1024 * 1024){
      setToast({ msg: 'File too large (max 5MB)', type: 'error' });
      input.value = '';
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
      const nextLead = pickHeader(mapLead, ['lead_id','lead','lead id'], 0);
      const nextCampaign = pickHeader(mapCampaign, ['campaign','campaign_id','campaign id','campaign name']);
      const nextChannel = pickHeader(mapChannel, ['channel','touch_channel']);
      const nextType = pickHeader(mapType, ['type','touch_type','interaction_type']);
      const nextTouched = pickHeader(mapTouchedAt, ['touched_at','timestamp','date','datetime','touch_time'], 1);
      setMapLead(nextLead);
      setMapCampaign(nextCampaign);
      setMapChannel(nextChannel);
      setMapType(nextType);
      setMapTouchedAt(nextTouched);
      if(nextCampaign && nextCampaign.toLowerCase().includes('id')) setCampaignIdentifier('campaign_id');
      setUploadSummary(null);
      setMappingConfirmed(false);
      setForceImport(false);
      if(cols.length < 2){
        setHeaderError('Could not detect valid headers. Ensure first row has column names.');
      } else {
        setHeaderError(null);
      }
    };
    reader.onerror = () => {
      resetCsvState();
      setToast({ msg: 'Failed to read file', type: 'error' });
    };
    reader.readAsText(f);
    input.value = '';
  }

  const headerOptions = useMemo(() => headersPreview.map(value => ({ value, label: value })), [headersPreview]);

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

  const resolveHeader = (value: string | null | undefined) => {
    if(!value) return null;
    const exact = headersPreview.find(h => h === value);
    if(exact) return exact;
    const lower = value.toLowerCase();
    const match = headersPreview.find(h => h.toLowerCase() === lower);
    return match || null;
  };

  function verifyRequiredMappings(){
    const missing: string[] = [];
    if(!mapLead) missing.push('lead');
    if(!mapCampaign) missing.push('campaign');
    if(!mapType) missing.push('type');
    if(!mapTouchedAt) missing.push('touched_at');
    if(missing.length){
      setToast({ msg: `Missing required mappings: ${missing.join(', ')}`, type: 'error' });
      return null;
    }
    const resolved = {
      lead: resolveHeader(mapLead),
      campaign: resolveHeader(mapCampaign),
      channel: resolveHeader(mapChannel),
      type: resolveHeader(mapType),
      touched_at: resolveHeader(mapTouchedAt),
    } as const;
    const mismatched: string[] = [];
    if(!resolved.lead) mismatched.push(`lead column "${mapLead}"`);
    if(!resolved.campaign) mismatched.push(`campaign column "${mapCampaign}"`);
    if(!resolved.type) mismatched.push(`type column "${mapType}"`);
    if(!resolved.touched_at) mismatched.push(`touched_at column "${mapTouchedAt}"`);
    if(mismatched.length){
      setToast({ msg: `Mapped headers not found: ${mismatched.join(', ')}`, type: 'error' });
      return null;
    }
    return resolved;
  }

  async function submitCsv(){
    if(!workspaceId){ setToast({ msg:'Open a workspace first', type:'error'}); return; }
    if(!csvText.trim()) { setToast({ msg:'Upload a CSV file first', type:'error'}); return; }
    const resolvedMap = verifyRequiredMappings();
    if(!resolvedMap) return;
    if(!mappingConfirmed && !forceImport){ setToast({ msg:'Confirm mappings or use Force Import', type:'error'}); return; }
    setImporting(true);
    setUploadSummary(null);
    try {
      let leadHint: 'id'|'email' = 'id';
      if (resolvedMap.lead && resolvedMap.lead.toLowerCase().includes('email')) {
        leadHint = 'email';
      }
      const summary = await importTouchesCSV({
        csv: csvText,
        map: resolvedMap,
        startRow: Number(startRow || 1),
        endRow,
        campaignIdentifier,
        leadIdentifier: leadHint,
        duplicatePolicy
      });
      setUploadSummary(summary);
      if(summary && summary.inserted){
        setToast({ msg:`Imported ${summary.inserted} touches`, type:'success'});
      } else if(summary && summary.failed){
        setToast({ msg:`Import finished with ${summary.failed} failures`, type:'error'});
      } else {
        setToast({ msg:'Import completed', type:'success'});
      }
    } catch (e){
      setToast({ msg:'Failed to import CSV', type:'error'});
    }
    setImporting(false);
  }

  function downloadErrors(){
    if(!uploadSummary || !uploadSummary.failedRows || !uploadSummary.failedRows.length) return;
    const rows = uploadSummary.failedRows.map((fr:any)=>`${fr.row},"${(fr.error||'').replace(/"/g,'""')}"`);
    const csv = ['row,error', ...rows].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'touch_import_errors.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="" />
        <h2 style={{ marginTop:16 }}>Campaign Touch Import</h2>
        <div style={{ fontSize:12, color:'#555' }}>Connect leads to campaigns via interaction events.</div>
        <div style={{ marginTop:16, display:'flex', gap:12 }}>
          <button className={activeTab==='form'?'btn-primary':'btn-ghost'} onClick={()=>setActiveTab('form')}>Single Touch Form</button>
          <button className={activeTab==='csv'?'btn-primary':'btn-ghost'} onClick={()=>setActiveTab('csv')}>Bulk CSV Import</button>
        </div>
        {activeTab==='form' && (
          <div style={{ marginTop:16, padding:16, background:'#fff', borderRadius:10, boxShadow:'0 4px 20px rgba(17,24,39,0.08)' }}>
            <h4 style={{ margin:'0 0 6px 0' }}>Add Single Touch</h4>
            <div style={{ fontSize:12, color:'#4b5563', marginBottom:10 }}>Required: Lead, Campaign, Type, and Touched at. Keep metadata JSON valid if used.</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Lead *</label>
                <Autocomplete
                  value={leadQuery}
                  placeholder="Lead id / name / company"
                  fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads || []; }}
                  formatItem={(l:any)=>`#${l.lead_id} ${l.First_Name||''} ${l.Last_Name||''}`.trim()}
                  getValue={(l:any)=>String(l.lead_id)}
                  onChange={(val, item)=>{ setLeadQuery(val); if(item) setSelectedLead(String(item.lead_id)); }}
                />
                {formErrors.lead && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.lead}</div>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Campaign *</label>
                <Autocomplete
                  value={campaignQuery}
                  placeholder="Campaign name"
                  fetchItems={async (q)=>{ const r = await searchCampaigns(q); return r.campaigns || []; }}
                  formatItem={(c:any)=>c.name}
                  getValue={(c:any)=>String(c.id)}
                  onChange={(val,item)=>{ setCampaignQuery(val); if(item) setSelectedCampaign(String(item.id)); }}
                />
                {formErrors.campaign && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.campaign}</div>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Type *</label>
                <select value={type} onChange={e=>setType(e.target.value)}>
                  <option value="email_open">Email Open</option>
                  <option value="email_click">Email Click</option>
                  <option value="ad_click">Ad Click</option>
                  <option value="webinar">Webinar</option>
                  <option value="form_submit">Form Submit</option>
                  <option value="other">Other</option>
                </select>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Pick the event that happened.</div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Channel</label>
                <select value={channel} onChange={e=>setChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="ads">Ads</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="webinar">Webinar</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Touched at *</label>
                <input type="datetime-local" value={touchedAt} onChange={e=>setTouchedAt(e.target.value)} />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Use your timezone; ISO format preferred.</div>
                {formErrors.touched_at && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.touched_at}</div>}
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={{ fontSize:12, fontWeight:600 }}>Metadata (JSON)</label>
                <textarea rows={3} value={metadata} onChange={e=>setMetadata(e.target.value)} style={{ width:'100%' }} />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Optional: add UTM, message id, or notes. Must be valid JSON.</div>
              </div>
            </div>
            <div style={{ marginTop:12, display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={submitForm}>Create Touch</button>
            </div>
          </div>
        )}
        {activeTab==='csv' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <h4>Bulk Import via CSV</h4>
            <div style={{ fontSize:12, color:'#555', marginBottom:12 }}>Upload a CSV file with touch activity. Required headers: lead, campaign, type, touched_at.</div>
            <div>
              <input type="file" accept=".csv" onChange={onFileChange} />
            </div>
            {headerError && (
              <div style={{ marginTop:8, fontSize:12, color:'#c33' }}>{headerError}</div>
            )}
            {!headerError && headersPreview.length > 0 && (
              <div style={{ marginTop:8, fontSize:12 }}>Detected headers: {headersPreview.join(', ')}</div>
            )}
            {rowsPreview.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, marginBottom:6 }}>
                  Previewing rows {previewStartIndex}-{previewEndIndex} of {rowsPreview.length}
                  {previewLimited ? ` (showing first ${rowsPreview.length} of ${totalPreviewRows})` : totalPreviewRows ? ` (total rows: ${totalPreviewRows})` : ''}
                  {blankRowCount > 0 ? ` • Blank lines skipped: ${blankRowCount}` : ''}
                </div>
                <div style={{ overflowX:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f8f9fb' }}>
                        {headersPreview.map((header, idx)=>(
                          <th key={idx} style={{ padding:8, borderBottom:'1px solid #e2e8f0', textAlign:'left', fontSize:12 }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewPageRows.map((row, rIdx)=>(
                        <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#fff' : '#fafbff' }}>
                          {headersPreview.map((_, cIdx)=>(
                            <td key={cIdx} style={{ padding:8, borderBottom:'1px solid #edf2f7', fontSize:12 }}>{row[cIdx] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rowsPreview.length > PREVIEW_PAGE_SIZE && (
                  <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:11, color:'#555' }}>Page {currentPreviewPage + 1} of {previewPageCount}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn-ghost" disabled={currentPreviewPage === 0} onClick={()=>setPreviewPage(p=>Math.max(0, p-1))}>Prev</button>
                      <button className="btn-ghost" disabled={currentPreviewPage >= previewPageCount - 1} onClick={()=>setPreviewPage(p=>Math.min(previewPageCount - 1, p+1))}>Next</button>
                    </div>
                  </div>
                )}
                {previewLimited && (
                  <div style={{ marginTop:4, fontSize:11, color:'#777' }}>Showing a sample of the first {MAX_PREVIEW_ROWS} rows for validation.</div>
                )}
              </div>
            )}
            {rowsPreview.length === 0 && headersPreview.length > 0 && totalPreviewRows === 0 && (
              <div style={{ marginTop:12, fontSize:12, color:'#555' }}>No data rows detected after the header.</div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginTop:16 }}>
              <div>
                <div style={{ fontSize:12 }}>Lead column *</div>
                <input list="touch-upload-headers" value={mapLead} onChange={e=>setMapLead(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Campaign column *</div>
                    <input
                      list="touch-upload-headers"
                      value={mapCampaign}
                      onChange={e=>{
                        const value = e.target.value;
                        setMapCampaign(value);
                        if(value && value.toLowerCase().includes('id')) setCampaignIdentifier('campaign_id');
                      }}
                      placeholder="Column name"
                      style={{ width:'100%' }}
                    />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Channel column</div>
                <input list="touch-upload-headers" value={mapChannel} onChange={e=>setMapChannel(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Type column *</div>
                <input list="touch-upload-headers" value={mapType} onChange={e=>setMapType(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Touched at column *</div>
                <input list="touch-upload-headers" value={mapTouchedAt} onChange={e=>setMapTouchedAt(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
                  <div>
                    <div style={{ fontSize:12 }}>Campaign identifier</div>
                    <select value={campaignIdentifier} onChange={e=>setCampaignIdentifier(e.target.value as 'name'|'campaign_id')} style={{ width:'100%' }}>
                      <option value="name">Campaign name</option>
                      <option value="campaign_id">Campaign ID</option>
                    </select>
                    <div style={{ fontSize:11, color:'#555', marginTop:4 }}>Choose how the campaign column should match existing campaigns.</div>
                  </div>
              <div>
                <div style={{ fontSize:12 }}>Start row</div>
                <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>End row (optional)</div>
                <input type="number" min={1} value={endRow!==undefined?String(endRow):''} placeholder="auto" onChange={e=>setEndRow(e.target.value?Number(e.target.value):undefined)} style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Duplicate policy</div>
                <select value={duplicatePolicy} onChange={e=>setDuplicatePolicy(e.target.value as any)}>
                  <option value="skip">Skip duplicates</option>
                  <option value="allow">Allow duplicates</option>
                </select>
              </div>
            </div>
            <datalist id="touch-upload-headers">
              {headerOptions.map(opt => (
                <option key={opt.value} value={opt.value} />
              ))}
            </datalist>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12 }}>
              <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
              <span style={{ fontSize:12 }}>I have reviewed my mappings and understand they will create touch records.</span>
            </label>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:4 }}>
              <input type="checkbox" checked={forceImport} onChange={e=>setForceImport(e.target.checked)} />
              <span style={{ fontSize:12 }}>Force import without confirmation (advanced)</span>
            </label>
            <div style={{ marginTop:12 }}>
              <button className="btn-primary" disabled={importing} onClick={submitCsv}>{importing?'Importing...':'Import CSV'}</button>
              {uploadSummary && (
                <span style={{ marginLeft:12, fontSize:12 }}>Processed {uploadSummary.processed}, Inserted {uploadSummary.inserted}, Failed {uploadSummary.failed}, Duplicates {uploadSummary.duplicates}</span>
              )}
              {uploadSummary && uploadSummary.failedRows && uploadSummary.failedRows.length>0 && (
                <button className="btn-ghost" style={{ marginLeft:12, fontSize:12 }} onClick={downloadErrors}>Download Error CSV</button>
              )}
            </div>
            {uploadSummary && uploadSummary.failedRows && uploadSummary.failedRows.length > 0 && (
              <details style={{ marginTop:8 }}>
                <summary style={{ cursor:'pointer', fontSize:12 }}>View failed rows</summary>
                <ul style={{ fontSize:12, marginTop:4 }}>
                  {uploadSummary.failedRows.slice(0,50).map((fr:any,i:number)=>(<li key={i}>Row {fr.row}: {fr.error}</li>))}
                </ul>
              </details>
            )}
          </div>
        )}
        {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
      </main>
    </Layout>
  );
}
