import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import { createTouch, importTouchesCSV, searchCampaigns, searchLeads } from './services/touches';
import Autocomplete from '../../components/Autocomplete';

function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  );
}

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function CampaignTouchInput(){
  const workspaceId = useWorkspaceIdFromHash();
  const [activeTab, setActiveTab] = useState<'form'|'csv'>('form');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

  // Form state
  const [leadQuery, setLeadQuery] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<any[]>([]); // placeholder
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
  const [headers, setHeaders] = useState<string[]>([]);
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
  const [diagnostics, setDiagnostics] = useState<{rows:number;blank:number;}|null>(null);
  const [forceImport, setForceImport] = useState(false);

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
      try { metadataObj = JSON.parse(metadata); } catch(e){ setToast({ msg:'Metadata must be valid JSON', type:'error'}); return; }
    }
    const res = await createTouch({ leadId: selectedLead, campaignId: selectedCampaign, type, channel, touched_at: touchedAt, metadata: metadataObj });
    if((res as any).error) { setToast({ msg:'Error creating touch', type:'error'}); }
    else { setToast({ msg:'Touch created', type:'success'}); setSelectedLead(''); setSelectedCampaign(''); setTouchedAt(''); setMetadata(''); }
  }

  useEffect(()=>{
    if(!csvText.trim()) { setHeaders([]); setDiagnostics(null); return; }
    const lines = csvText.replace(/\r\n?/g,'\n').split('\n');
    if(lines.length){
      const hdrLine = lines[0];
      // Simple CSV split (no quoted commas); can enhance later
      const hdrs = hdrLine.split(',').map(h=>h.trim()).filter(Boolean);
      setHeaders(hdrs);
      const dataLines = lines.slice(1).filter(l=>l.trim().length>0);
      setDiagnostics({ rows: dataLines.length, blank: lines.slice(1).length - dataLines.length });
      // Auto-suggest mappings if blank
      function suggest(target:string){
        const lower = hdrs.map(h=>h.toLowerCase());
        const idx = lower.indexOf(target);
        return idx>=0?hdrs[idx]:'';
      }
      if(!mapLead) setMapLead(suggest('lead_id') || suggest('lead') || '');
      if(!mapCampaign) setMapCampaign(suggest('campaign') || suggest('campaign_id') || '');
      if(!mapChannel) setMapChannel(suggest('channel') || '');
      if(!mapType) setMapType(suggest('type') || '');
      if(!mapTouchedAt) setMapTouchedAt(suggest('touched_at') || suggest('timestamp') || suggest('date') || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[csvText]);

  function verifyRequiredMappings(){
    const missing:string[] = [];
    if(!mapLead) missing.push('lead');
    if(!mapCampaign) missing.push('campaign');
    if(!mapType) missing.push('type');
    if(!mapTouchedAt) missing.push('touched_at');
    if(missing.length){ setToast({ msg:`Missing required mappings: ${missing.join(', ')}`, type:'error'}); return false; }
    return true;
  }

  async function submitCsv(){
    if(!csvText.trim()) { setToast({ msg:'Paste CSV text first', type:'error'}); return; }
    if(!verifyRequiredMappings()) return;
    if(!mappingConfirmed && !forceImport){ setToast({ msg:'Confirm mappings or use Force Import', type:'error'}); return; }
    setImporting(true); setUploadSummary(null);
    const map = { lead: mapLead, campaign: mapCampaign, channel: mapChannel, type: mapType, touched_at: mapTouchedAt };
    const summary = await importTouchesCSV({ csv: csvText, map, startRow, endRow, campaignIdentifier:'name', duplicatePolicy });
    setImporting(false); setUploadSummary(summary);
    if(summary && summary.inserted){ setToast({ msg:`Imported ${summary.inserted} touches`, type:'success'}); }
    else if(summary && summary.failed){ setToast({ msg:`Import finished with ${summary.failed} failures`, type:'error'}); }
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
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Campaign Touch Import</h2>
        <div style={{ fontSize:12, color:'#555' }}>Connect leads to campaigns via interaction events.</div>
        <div style={{ marginTop:16, display:'flex', gap:12 }}>
          <button className={activeTab==='form'?'btn-primary':'btn-ghost'} onClick={()=>setActiveTab('form')}>Single Touch Form</button>
          <button className={activeTab==='csv'?'btn-primary':'btn-ghost'} onClick={()=>setActiveTab('csv')}>Bulk CSV Import</button>
        </div>
        {activeTab==='form' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <h4>Add Single Touch</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:12 }}>Lead search</div>
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
                <div style={{ fontSize:12 }}>Campaign search</div>
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
                <div style={{ fontSize:12 }}>Channel</div>
                <select value={channel} onChange={e=>setChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="ads">Ads</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="webinar">Webinar</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Type</div>
                <select value={type} onChange={e=>setType(e.target.value)}>
                  <option value="email_open">Email Open</option>
                  <option value="email_click">Email Click</option>
                  <option value="ad_click">Ad Click</option>
                  <option value="webinar">Webinar</option>
                  <option value="form_submit">Form Submit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Touched at (datetime)</div>
                <input type="datetime-local" value={touchedAt} onChange={e=>setTouchedAt(e.target.value)} />
                {formErrors.touched_at && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.touched_at}</div>}
              </div>
              <div>
                <div style={{ fontSize:12 }}>Metadata (JSON)</div>
                <textarea rows={3} value={metadata} onChange={e=>setMetadata(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <button className="btn-primary" onClick={submitForm}>Create Touch</button>
            </div>
          </div>
        )}
        {activeTab==='csv' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <h4>Bulk Import via CSV</h4>
            <div style={{ fontSize:12, color:'#555', marginBottom:8 }}>Map columns then import. Required: lead, campaign, type, touched_at.</div>
            <textarea rows={10} style={{ width:'100%', fontFamily:'monospace' }} placeholder="Paste CSV here (first row headers)" value={csvText} onChange={e=>setCsvText(e.target.value)} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:12 }}>
              <div>
                <div style={{ fontSize:12 }}>Lead column *</div>
                <select value={mapLead} onChange={e=>setMapLead(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Campaign column *</div>
                <select value={mapCampaign} onChange={e=>setMapCampaign(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Channel column</div>
                <select value={mapChannel} onChange={e=>setMapChannel(e.target.value)}>
                  <option value="">-- optional --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Type column *</div>
                <select value={mapType} onChange={e=>setMapType(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Touched at column *</div>
                <select value={mapTouchedAt} onChange={e=>setMapTouchedAt(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Start row</div>
                <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>End row (optional)</div>
                <input type="number" min={1} value={endRow!==undefined?String(endRow):''} placeholder="auto" onChange={e=>setEndRow(e.target.value?Number(e.target.value):undefined)} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Duplicate policy</div>
                <select value={duplicatePolicy} onChange={e=>setDuplicatePolicy(e.target.value as any)}>
                  <option value="skip">Skip duplicates</option>
                  <option value="allow">Allow duplicates</option>
                </select>
              </div>
            </div>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12 }}>
              <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
              <span style={{ fontSize:12 }}>I have reviewed my mappings and understand they will write interaction data.</span>
            </label>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:4 }}>
              <input type="checkbox" checked={forceImport} onChange={e=>setForceImport(e.target.checked)} />
              <span style={{ fontSize:12 }}>Force import without confirmation (advanced)</span>
            </label>
            {diagnostics && (
              <div style={{ marginTop:8, fontSize:11, color:'#555' }}>Rows: {diagnostics.rows}, Blank lines: {diagnostics.blank}, Headers detected: {headers.length}</div>
            )}
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
