import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import Autocomplete from '../../components/Autocomplete';
import { createDeal, importDealsCSV, searchLeads } from './services/deals';
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

export default function DealInput(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
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

  // CSV wizard state
  const [csvText, setCsvText] = useState('');
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
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
    else {
      setToast({ msg:'Deal created', type:'success'});
      setLeadQuery(''); setLeadId(''); setDealId(''); setAmount(''); setClosedAt(''); setNotes('');
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
    setMapDealId('');
    setMapLead('');
    setMapAmount('');
    setMapCurrency('');
    setMapClosedWon('');
    setMapClosedAt('');
    setMapStage('');
    setMapNotes('');
    setStartRow(1);
    setEndRow(undefined);
    setUploadSummary(null);
    setMappingConfirmed(false);
    setImporting(false);
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
      setMapDealId(prev => pickHeader(prev, ['deal_id','deal id']));
      setMapLead(prev => pickHeader(prev, ['lead_id','lead email','lead','lead_email'], 0));
      setMapAmount(prev => pickHeader(prev, ['amount','value','deal_amount'], 1));
      setMapCurrency(prev => pickHeader(prev, ['currency','deal_currency']));
      setMapClosedWon(prev => pickHeader(prev, ['closed_won','is_closed_won']));
      setMapClosedAt(prev => pickHeader(prev, ['closed_at','close_date','date','closed at'], 2));
      setMapStage(prev => pickHeader(prev, ['stage','deal_stage']));
      setMapNotes(prev => pickHeader(prev, ['notes','description','details']));
      setUploadSummary(null);
      setMappingConfirmed(false);
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
    if(!mapAmount) missing.push('amount');
    if(!mapClosedAt) missing.push('closed_at');
    if(missing.length){
      setToast({ msg:`Missing mappings: ${missing.join(', ')}`, type:'error' });
      return null;
    }
    const resolved = {
      deal_id: resolveHeader(mapDealId),
      lead: resolveHeader(mapLead),
      amount: resolveHeader(mapAmount),
      currency: resolveHeader(mapCurrency),
      closed_won: resolveHeader(mapClosedWon),
      closed_at: resolveHeader(mapClosedAt),
      stage: resolveHeader(mapStage),
      notes: resolveHeader(mapNotes),
    } as const;
    const mismatched: string[] = [];
    if(!resolved.lead) mismatched.push(`lead column "${mapLead}"`);
    if(!resolved.amount) mismatched.push(`amount column "${mapAmount}"`);
    if(!resolved.closed_at) mismatched.push(`closed_at column "${mapClosedAt}"`);
    if(mismatched.length){
      setToast({ msg:`Mapped headers not found: ${mismatched.join(', ')}`, type:'error' });
      return null;
    }
    return resolved;
  }

  async function submitCsv(){
    if(!workspaceId){ setToast({ msg:'Open a workspace first', type:'error' }); return; }
    if(!csvText.trim()) { setToast({ msg:'Upload a CSV file first', type:'error'}); return; }
    const resolvedMap = verifyRequiredMappings();
    if(!resolvedMap) return;
    if(!mappingConfirmed){ setToast({ msg:'Confirm mappings checkbox', type:'error'}); return; }
    setImporting(true);
    setUploadSummary(null);
    try {
      const map = {
        deal_id: resolvedMap.deal_id || undefined,
        lead: resolvedMap.lead!,
        amount: resolvedMap.amount!,
        currency: resolvedMap.currency || undefined,
        closed_won: resolvedMap.closed_won || undefined,
        closed_at: resolvedMap.closed_at!,
        stage: resolvedMap.stage || undefined,
        notes: resolvedMap.notes || undefined,
      };
      const summary = await importDealsCSV({
        csv: csvText,
        map,
        startRow: Number(startRow || 1),
        endRow,
        duplicatePolicy
      });
      setUploadSummary(summary);
      if(summary && summary.inserted){
        setToast({ msg:`Imported ${summary.inserted} deals`, type:'success'});
      } else if(summary && summary.failed){
        setToast({ msg:`Import finished with ${summary.failed} failures`, type:'error'});
      } else {
        setToast({ msg:'Import completed', type:'success'});
      }
    } catch (err){
      setToast({ msg:'Failed to import CSV', type:'error'});
    }
    setImporting(false);
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
          <div style={{ marginTop:16, padding:16, background:'#fff', borderRadius:10, boxShadow:'0 4px 20px rgba(17,24,39,0.08)' }}>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:13, color:'#4b5563' }}>Required: Lead, Amount, and Closed date if marked closed-won. Keep currency codes short (USD, EUR).</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Lead *</label>
                <Autocomplete
                  value={leadQuery}
                  placeholder="Lead id / name / company"
                  fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads || []; }}
                  formatItem={(l:any)=>`#${l.lead_id} ${l.First_Name||''} ${l.Last_Name||''}`.trim()}
                  getValue={(l:any)=>String(l.lead_id)}
                  onChange={(val, item)=>{ setLeadQuery(val); setLeadId(item ? String(item.lead_id) : ''); }}
                />
                {formErrors.lead && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.lead}</div>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Deal ID (optional)</label>
                <input value={dealId} onChange={e=>setDealId(e.target.value)} placeholder="CRM deal id" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Amount *</label>
                <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g., 15000" />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Numbers only; positive values.</div>
                {formErrors.amount && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.amount}</div>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Currency</label>
                <input value={currency} onChange={e=>setCurrency(e.target.value)} placeholder="USD" />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>3-4 letter code.</div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Closed won?</label>
                <select value={String(closedWon)} onChange={e=>setClosedWon(e.target.value==='true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Closed at {closedWon && '*'}</label>
                <input type="datetime-local" value={closedAt} onChange={e=>setClosedAt(e.target.value)} />
                {formErrors.closed_at && <div style={{ color:'#c33', fontSize:11 }}>{formErrors.closed_at}</div>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600 }}>Stage</label>
                <input value={stage} onChange={e=>setStage(e.target.value)} />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>e.g., Discovery, Proposal, Closed Won.</div>
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={{ fontSize:12, fontWeight:600 }}>Notes</label>
                <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional context for this deal" style={{ width:'100%' }} />
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Keep it short—help teammates understand status fast.</div>
              </div>
            </div>
            <div style={{ marginTop:12, display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={submitForm}>Save Deal</button>
            </div>
          </div>
        )}
        {tab==='csv' && (
          <div style={{ marginTop:16, padding:12, background:'#fff', borderRadius:8 }}>
            <h4>Bulk Import via CSV</h4>
            <div style={{ fontSize:12, color:'#555', marginBottom:12 }}>Upload a CSV file with deal data. Required headers: lead, amount, closed_at.</div>
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
                <div style={{ fontSize:12 }}>Deal ID</div>
                <input list="deal-upload-headers" value={mapDealId} onChange={e=>setMapDealId(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Lead *</div>
                <input list="deal-upload-headers" value={mapLead} onChange={e=>setMapLead(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Amount *</div>
                <input list="deal-upload-headers" value={mapAmount} onChange={e=>setMapAmount(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Currency</div>
                <input list="deal-upload-headers" value={mapCurrency} onChange={e=>setMapCurrency(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed won</div>
                <input list="deal-upload-headers" value={mapClosedWon} onChange={e=>setMapClosedWon(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Closed at *</div>
                <input list="deal-upload-headers" value={mapClosedAt} onChange={e=>setMapClosedAt(e.target.value)} placeholder="Column name" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Stage</div>
                <input list="deal-upload-headers" value={mapStage} onChange={e=>setMapStage(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12 }}>Notes</div>
                <input list="deal-upload-headers" value={mapNotes} onChange={e=>setMapNotes(e.target.value)} placeholder="Optional" style={{ width:'100%' }} />
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
            <datalist id="deal-upload-headers">
              {headerOptions.map(opt => (
                <option key={opt.value} value={opt.value} />
              ))}
            </datalist>
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
        {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
      </main>
    </Layout>
  );
}
