import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useState, useEffect } from 'react';
import Autocomplete from '../../components/Autocomplete';
import { createDeal, importDealsCSV, searchLeads } from './services/deals';

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function DealInput(){
  const workspaceId = useWorkspaceIdFromHash();
  const [tab, setTab] = useState<'form'|'csv'>('form');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

  // Form state
  const [leadQuery, setLeadQuery] = useState('');
  const [leadId, setLeadId] = useState<string>('');
  const [dealId, setDealId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [closedWon, setClosedWon] = useState(true);
  const [closedAt, setClosedAt] = useState('');
  const [stage, setStage] = useState('Closed Won');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});

  // CSV state
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapDealId, setMapDealId] = useState('');
  const [mapLead, setMapLead] = useState('');
  const [mapAmount, setMapAmount] = useState('');
  const [mapCurrency, setMapCurrency] = useState('');
  const [mapClosedWon, setMapClosedWon] = useState('');
  const [mapClosedAt, setMapClosedAt] = useState('');
  const [mapStage, setMapStage] = useState('');
  const [mapNotes, setMapNotes] = useState('');
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number|undefined>(undefined);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip'|'allow'>('skip');
  const [uploadSummary, setUploadSummary] = useState<any|null>(null);
  const [importing, setImporting] = useState(false);

  function validateForm(){
    const errs: Record<string,string> = {};
    if(!leadId) errs.lead = 'Lead required';
    const amt = Number(amount);
    if(isNaN(amt) || amt <= 0) errs.amount = 'Amount must be positive number';
    if(closedWon && !closedAt) errs.closed_at = 'Closed date required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitForm(){
    if(!workspaceId) { setToast({ msg:'Open a workspace first', type:'error'}); return; }
    if(!validateForm()) return;
    const res = await createDeal({ lead_id: leadId, deal_id: dealId || undefined, amount: Number(amount), currency, closed_won: closedWon, closed_at: closedAt || undefined, stage, notes });
    if((res as any).error) setToast({ msg:'Error creating deal', type:'error'});
    else { setToast({ msg:'Deal created', type:'success'}); setLeadQuery(''); setLeadId(''); setDealId(''); setAmount(''); setClosedAt(''); setNotes(''); }
  }

  useEffect(()=>{
    if(!csvText.trim()){ setHeaders([]); return; }
    const lines = csvText.replace(/\r\n?/g,'\n').split('\n');
    const hdrs = lines[0]?.split(',').map(s=>s.trim()).filter(Boolean) || [];
    setHeaders(hdrs);
    function suggest(target:string){ const lower = hdrs.map(h=>h.toLowerCase()); const idx = lower.indexOf(target); return idx>=0?hdrs[idx]:''; }
    if(!mapDealId) setMapDealId(suggest('deal_id'));
    if(!mapLead) setMapLead(suggest('lead_id') || suggest('lead_email') || suggest('lead'));
    if(!mapAmount) setMapAmount(suggest('amount') || suggest('value'));
    if(!mapCurrency) setMapCurrency(suggest('currency'));
    if(!mapClosedWon) setMapClosedWon(suggest('closed_won'));
    if(!mapClosedAt) setMapClosedAt(suggest('closed_at') || suggest('date'));
    if(!mapStage) setMapStage(suggest('stage'));
    if(!mapNotes) setMapNotes(suggest('notes'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[csvText]);

  function verifyMappings(){
    const missing: string[] = [];
    if(!mapLead) missing.push('lead');
    if(!mapAmount) missing.push('amount');
    if(!mapClosedAt) missing.push('closed_at');
    if(missing.length){ setToast({ msg:`Missing mappings: ${missing.join(', ')}`, type:'error' }); return false; }
    return true;
  }

  async function submitCsv(){
    if(!csvText.trim()) { setToast({ msg:'Paste CSV text first', type:'error'}); return; }
    if(!verifyMappings()) return;
    if(!mappingConfirmed){ setToast({ msg:'Confirm mappings checkbox', type:'error'}); return; }
    setImporting(true); setUploadSummary(null);
    const map = { deal_id: mapDealId, lead: mapLead, amount: mapAmount, currency: mapCurrency, closed_won: mapClosedWon, closed_at: mapClosedAt, stage: mapStage, notes: mapNotes };
    const summary = await importDealsCSV({ csv: csvText, map, startRow, endRow, duplicatePolicy });
    setImporting(false); setUploadSummary(summary);
    if(summary && summary.inserted){ setToast({ msg:`Imported ${summary.inserted} deals`, type:'success'}); }
    else if(summary && summary.failed){ setToast({ msg:`Import finished with ${summary.failed} failures`, type:'error'}); }
  }

  function downloadFailedCSV(){
    if(!uploadSummary || !uploadSummary.failedRows || uploadSummary.failedRows.length===0) return;
    const rows = uploadSummary.failedRows as Array<{row:number;error:string}>;
    const lines = ['row,error'];
    for(const r of rows){
      const safeErr = String(r.error).replace(/"/g,'""');
      lines.push(`${r.row},"${safeErr}"`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deal_import_failed_rows.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Deal Input</h2>
        <div style={{ fontSize:12, color:'#555' }}>Upload closed deals from your CRM.</div>
        <div style={{ marginTop:16, display:'flex', gap:12 }}>
          <button className={tab==='form'?'btn-primary':'btn-ghost'} onClick={()=>setTab('form')}>Add single deal</button>
          <button className={tab==='csv'?'btn-primary':'btn-ghost'} onClick={()=>setTab('csv')}>Bulk import via CSV</button>
        </div>
        {tab==='form' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:12 }}>Lead</div>
                <Autocomplete
                  value={leadQuery}
                  placeholder="Lead id / name / company"
                  fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads || []; }}
                  formatItem={(l:any)=>`#${l.lead_id} ${l.First_Name||''} ${l.Last_Name||''}`.trim()}
                  getValue={(l:any)=>String(l.lead_id)}
                  onChange={(val, item)=>{ setLeadQuery(val); if(item) setLeadId(String(item.lead_id)); }}
                />
                {formErrors.lead && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.lead}</div>}
              </div>
              <div>
                <div style={{ fontSize:12 }}>Deal ID (optional)</div>
                <input value={dealId} onChange={e=>setDealId(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Amount</div>
                <input value={amount} onChange={e=>setAmount(e.target.value)} />
                {formErrors.amount && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.amount}</div>}
              </div>
              <div>
                <div style={{ fontSize:12 }}>Currency</div>
                <input value={currency} onChange={e=>setCurrency(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed won?</div>
                <select value={String(closedWon)} onChange={e=>setClosedWon(e.target.value==='true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed at</div>
                <input type="datetime-local" value={closedAt} onChange={e=>setClosedAt(e.target.value)} />
                {formErrors.closed_at && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.closed_at}</div>}
              </div>
              <div>
                <div style={{ fontSize:12 }}>Stage</div>
                <input value={stage} onChange={e=>setStage(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Notes</div>
                <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <button className="btn-primary" onClick={submitForm}>Save Deal</button>
            </div>
          </div>
        )}
        {tab==='csv' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <div style={{ fontSize:12, color:'#555', marginBottom:8 }}>Map columns then import. Required: lead, amount, closed_at.</div>
            <textarea rows={10} style={{ width:'100%', fontFamily:'monospace' }} placeholder="Paste CSV here (first row headers)" value={csvText} onChange={e=>setCsvText(e.target.value)} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:12 }}>
              <div>
                <div style={{ fontSize:12 }}>Deal ID</div>
                <select value={mapDealId} onChange={e=>setMapDealId(e.target.value)}>
                  <option value="">-- optional --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Lead *</div>
                <select value={mapLead} onChange={e=>setMapLead(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Amount *</div>
                <select value={mapAmount} onChange={e=>setMapAmount(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Currency</div>
                <select value={mapCurrency} onChange={e=>setMapCurrency(e.target.value)}>
                  <option value="">-- optional --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed won</div>
                <select value={mapClosedWon} onChange={e=>setMapClosedWon(e.target.value)}>
                  <option value="">-- optional --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed at *</div>
                <select value={mapClosedAt} onChange={e=>setMapClosedAt(e.target.value)}>
                  <option value="">-- select --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Stage</div>
                <select value={mapStage} onChange={e=>setMapStage(e.target.value)}>
                  <option value="">-- optional --</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option> )}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Notes</div>
                <select value={mapNotes} onChange={e=>setMapNotes(e.target.value)}>
                  <option value="">-- optional --</option>
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
              <span style={{ fontSize:12 }}>I have reviewed my mappings and understand they will create deal records.</span>
            </label>
            <div style={{ marginTop:12 }}>
              <button className="btn-primary" disabled={importing} onClick={submitCsv}>{importing?'Importing...':'Import CSV'}</button>
              {uploadSummary && (
                <span style={{ marginLeft:12, fontSize:12 }}>Processed {uploadSummary.processed}, Inserted {uploadSummary.inserted}, Failed {uploadSummary.failed}, Duplicates {uploadSummary.duplicates}</span>
              )}
              {uploadSummary && uploadSummary.failedRows && uploadSummary.failedRows.length>0 && (
                <button className="btn-ghost" style={{ marginLeft:12 }} onClick={downloadFailedCSV}>Download failed rows CSV</button>
              )}
            </div>
          </div>
        )}
        {toast && (
          <div style={{ position:'fixed', right:16, bottom:16, background: toast.type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
            <div>{toast.msg}</div>
            <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={()=>setToast(null)}>Close</button>
          </div>
        )}
      </main>
    </Layout>
  );
}
