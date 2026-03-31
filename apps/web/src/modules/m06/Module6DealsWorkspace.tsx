import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import Autocomplete from '../../components/Autocomplete';
import { useWorkspaceId } from '../../utils/workspace';
import {
  archiveDeal,
  createDeal,
  deleteDealPermanent,
  importDealsCSV,
  listDeals,
  searchLeads,
  updateDeal,
} from './services/deals';
import type { Deal } from './services/deals';
import './module6.css';

const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

type DealTab = 'list' | 'form' | 'csv';

function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8 }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop:6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  );
}

function formatLeadOption(lead: any) {
  const name = String(lead?.name || lead?.First_Name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [name || (leadId ? `#${leadId}` : ''), email].filter(Boolean).join(' • ') || 'Unknown lead';
}

export default function Module6DealsWorkspace(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [activeTab, setActiveTab] = useState<DealTab>('list');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);

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

  const [filterLeadQuery, setFilterLeadQuery] = useState('');
  const [filterLeadId, setFilterLeadId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('closed_won');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string|undefined>(undefined);
  const [editing, setEditing] = useState<string|null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editClosedWon, setEditClosedWon] = useState('true');
  const [editClosedAt, setEditClosedAt] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 90);
    setFrom(past.toISOString().slice(0,10));
    setTo(now.toISOString().slice(0,10));
    setStatus('closed_won');
  }, []);

  function validateForm(){
    const errs: Record<string,string> = {};
    if(!leadId) errs.lead = 'Lead required';
    const amt = Number(amount);
    if(Number.isNaN(amt) || amt <= 0) errs.amount = 'Amount must be a positive number';
    if(closedWon && !closedAt) errs.closed_at = 'Closed date required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitForm(){
    if(!workspaceId) { setToast({ msg:'Open a workspace first', type:'error'}); return; }
    if(!validateForm()) return;
    const res = await createDeal({
      lead_id: leadId,
      deal_id: dealId || undefined,
      amount: Number(amount),
      currency,
      closed_won: closedWon,
      closed_at: closedAt || undefined,
      stage,
      notes
    });
    if((res as any).error) setToast({ msg:'Error creating deal', type:'error'});
    else {
      setToast({ msg:'Deal created', type:'success'});
      setLeadQuery('');
      setLeadId('');
      setDealId('');
      setAmount('');
      setClosedAt('');
      setNotes('');
      setActiveTab('list');
      load();
    }
  }

  async function load(){
    if(!workspaceId){
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    const params: any = { from, to, status, stage: filterStage, includeArchived };
    if(filterLeadId) params.leadId = filterLeadId;
    if(minAmount) params.minAmount = Number(minAmount);
    if(maxAmount) params.maxAmount = Number(maxAmount);
    try {
      const data = await listDeals(params);
      setRows(Array.isArray(data) ? data : []);
    } catch(e:any){
      setLoadError(e?.message || 'Failed to load deals');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterLeadId, from, to, status, minAmount, maxAmount, filterStage, includeArchived, workspaceId]);

  function startEdit(r: Deal){
    setEditing(r._id!);
    setEditAmount(String(r.amount || ''));
    setEditClosedWon(String(r.closed_won));
    setEditClosedAt((r.closed_at || '').slice(0,16));
    setEditStage(r.stage || '');
    setEditNotes(r.notes || '');
    setModalOpen(true);
  }

  async function saveEdit(){
    if(!editing) return;
    const payload: any = {
      amount: Number(editAmount),
      closed_won: editClosedWon === 'true',
      closed_at: editClosedAt || undefined,
      stage: editStage || undefined,
      notes: editNotes || undefined
    };
    const res = await updateDeal(editing, payload);
    if((res as any).error) setToast({ msg:'Update failed', type:'error' });
    else {
      setToast({ msg:'Updated', type:'success' });
      setEditing(null);
      setModalOpen(false);
      load();
    }
  }

  async function doArchive(id:string){
    if(!confirm('This will archive the deal. It will stay available for historical reporting. Proceed?')) return;
    const res = await archiveDeal(id);
    if((res as any).error) setToast({ msg:'Archive failed', type:'error' });
    else {
      setToast({ msg:'Archived', type:'success' });
      load();
    }
  }

  async function doDelete(id:string){
    const deal = rows.find(r => r._id === id);
    const extId = deal?.deal_id || '';
    const msg = extId ? `Type the Deal ID (${extId}) to confirm permanent deletion:` : 'Type DELETE to confirm permanent deletion:';
    const input = prompt(msg, '');
    if(extId){
      if(input !== extId) return;
    } else if((input || '').toUpperCase() !== 'DELETE') {
      return;
    }
    const res = await deleteDealPermanent(id);
    if((res as any).error) setToast({ msg:'Delete failed', type:'error' });
    else {
      setToast({ msg:'Deleted', type:'success' });
      load();
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
      if(cols.length < 2) setHeaderError('Could not detect valid headers. Ensure first row has column names.');
      else setHeaderError(null);
    };
    reader.onerror = () => {
      resetCsvState();
      setToast({ msg: 'Failed to read file', type: 'error' });
    };
    reader.readAsText(f);
    input.value = '';
  }

  const headerOptions = useMemo(() => headersPreview.map(value => ({ value, label: value })), [headersPreview]);

  useEffect(() => {
    setPreviewPage(prev => {
      if(!rowsPreview.length) return 0;
      const maxIndex = Math.max(0, Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) - 1);
      return Math.min(prev, maxIndex);
    });
  }, [rowsPreview]);

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
      if(summary && summary.inserted) setToast({ msg:`Imported ${summary.inserted} deals`, type:'success'});
      else if(summary && summary.failed) setToast({ msg:`Import finished with ${summary.failed} failures`, type:'error'});
      else setToast({ msg:'Import completed', type:'success'});
      setActiveTab('list');
      load();
    } catch {
      setToast({ msg:'Failed to import CSV', type:'error'});
    }
    setImporting(false);
  }

  function downloadFailedCSV(){
    if(!uploadSummary || !uploadSummary.failedRows || uploadSummary.failedRows.length===0) return;
    const rowsCsv = uploadSummary.failedRows as Array<{row:number;error:string}>;
    const lines = ['row,error'];
    for(const r of rowsCsv){
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
      <main className="page-root m06-page">
        <div className="m06-leads-shell">
          <div className="m06-leads-toprow">
            <ModuleBackButton toSuffix="" />
          </div>

          <section className="m06-hero">
            <div className="m06-hero-inner m06-leads-hero-grid">
              <div className="m06-leads-hero-copy">
                <div className="m06-pill">M06 Deal Workspace</div>
                <h1 style={{ fontSize: 38 }}>Deal Operations</h1>
                <div className="m06-hero-copy">
                  Review deal records, add a single closed deal, or import deal batches from CSV in one workspace.
                  This keeps pipeline-supporting revenue records in the same operational screen.
                </div>
              </div>
              <div className="m06-leads-stat-grid">
                <div className="m06-kpi-card">
                  <div className="label">Visible deals</div>
                  <div className="value">{rows.length}</div>
                </div>
                <div className="m06-kpi-card">
                  <div className="label">Current mode</div>
                  <div className="value" style={{ fontSize: 22 }}>{activeTab === 'list' ? 'View' : activeTab === 'form' ? 'Add' : 'CSV import'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Deal Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Manage deals from one screen</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>
              Switch between reviewing existing deals, adding one deal manually, and importing CRM exports through CSV.
            </div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <span className="step">1</span>
                <span className="meta">
                  <strong>View deals</strong>
                  <span>Filter, edit, archive, and delete deal records</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'form' ? 'active' : ''}`} onClick={() => setActiveTab('form')}>
                <span className="step">2</span>
                <span className="meta">
                  <strong>Add deal</strong>
                  <span>Create one revenue record with amount, stage, and close date</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>
                <span className="step">3</span>
                <span className="meta">
                  <strong>CSV import</strong>
                  <span>Preview rows and map deal fields before import</span>
                </span>
              </button>
            </div>
          </section>

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Deal Table</h3>
              <div className="m06-helper">
                Filter by lead, close window, status, amount range, and stage before editing or archiving deal records.
              </div>
              <div className="m06-campaign-filter-grid" style={{ marginTop: 16 }}>
                <div>
                  <label>Lead</label>
                  <Autocomplete
                    value={filterLeadQuery}
                    placeholder="Lead id / name / company"
                    fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads || []; }}
                    formatItem={formatLeadOption}
                    getValue={formatLeadOption}
                    onChange={(val,item)=>{ setFilterLeadQuery(val); setFilterLeadId(item ? String(item.lead_id || item._id) : ''); }}
                  />
                </div>
                <div>
                  <label>Closed from</label>
                  <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
                </div>
                <div>
                  <label>Closed to</label>
                  <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
                </div>
                <div>
                  <label>Status</label>
                  <select value={status} onChange={e=>setStatus(e.target.value)}>
                    <option value="">All</option>
                    <option value="closed_won">Closed Won</option>
                    <option value="closed_lost">Closed Lost</option>
                    <option value="open">Open</option>
                  </select>
                </div>
                <div>
                  <label>Min amount</label>
                  <input value={minAmount} onChange={e=>setMinAmount(e.target.value)} placeholder="1000" />
                </div>
                <div>
                  <label>Max amount</label>
                  <input value={maxAmount} onChange={e=>setMaxAmount(e.target.value)} placeholder="50000" />
                </div>
                <div>
                  <label>Stage</label>
                  <input value={filterStage} onChange={e=>setFilterStage(e.target.value)} placeholder="Closed Won" />
                </div>
                <div>
                  <label>Archive filter</label>
                  <label className="toggle" style={{ minHeight: 46 }}>
                    <input type="checkbox" checked={includeArchived} onChange={e=>setIncludeArchived(e.target.checked)} />
                    Include archived
                  </label>
                </div>
              </div>

              <div className="m06-toolbar" style={{ marginTop: 14 }}>
                <div className="m06-inline-note">Deals default to a rolling 90-day closed-won window when the page first opens.</div>
                <button className="btn-ghost" onClick={() => load()}>Reload</button>
              </div>

              <div className="m06-leads-table-wrap">
                {loadError && <div style={{ background:'#fee', color:'#900', padding:'8px 10px', border:'1px solid #f99', borderRadius:6, marginBottom:8 }}>Could not load deals: {loadError}</div>}
                {loading && <div className="m06-inline-note">Loading deals...</div>}
                {!loading && rows.length === 0 && <div className="m06-leads-empty">No deals found.</div>}
                {!loading && rows.length > 0 && (
                  <div className="m06-table-shell" style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Deal ID</th>
                          <th>Lead</th>
                          <th>Amount</th>
                          <th>Currency</th>
                          <th>Status</th>
                          <th>Closed at</th>
                          <th>Stage</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const isEditing = editing === r._id;
                          return (
                            <tr key={r._id}>
                              <td>{r.deal_id || '-'}</td>
                              <td>#{r.lead_id}</td>
                              <td>{isEditing ? <input value={editAmount} onChange={e=>setEditAmount(e.target.value)} /> : r.amount}</td>
                              <td>{r.currency || 'USD'}</td>
                              <td>{isEditing ? (
                                <select value={editClosedWon} onChange={e=>setEditClosedWon(e.target.value)}>
                                  <option value="true">Closed Won</option>
                                  <option value="false">Not Won</option>
                                </select>
                              ) : (r.closed_won ? 'Closed Won' : 'Open/Other')}</td>
                              <td>{isEditing ? <input type="datetime-local" value={editClosedAt} onChange={e=>setEditClosedAt(e.target.value)} /> : (r.closed_at ? new Date(r.closed_at).toLocaleString() : '-')}</td>
                              <td>{isEditing ? <input value={editStage} onChange={e=>setEditStage(e.target.value)} /> : (r.stage || '-')}</td>
                              <td style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {!isEditing ? (
                                  <>
                                    <button className="btn-ghost" onClick={()=>startEdit(r)}>Edit</button>
                                    <button className="btn-ghost" onClick={()=>doArchive(r._id!)}>Archive</button>
                                    <button className="btn-danger" onClick={()=>doDelete(r._id!)}>Delete</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn-primary" onClick={saveEdit}>Save</button>
                                    <button className="btn-ghost" onClick={()=>{ setModalOpen(false); setEditing(null); }}>Cancel</button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'form' && (
            <section className="m06-panel">
              <div className="m06-section-label">Add Deal</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Single Deal Form</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Add one revenue record with lead linkage, amount, win state, close date, stage, and short deal context.
              </div>
              <div className="m06-form-grid">
                <div>
                  <label>Lead *</label>
                  <Autocomplete
                    value={leadQuery}
                    placeholder="Lead id / name / company"
                    fetchItems={async (q)=>{ const r = await searchLeads(q); return r.leads || []; }}
                    formatItem={formatLeadOption}
                    getValue={formatLeadOption}
                    onChange={(val, item)=>{ setLeadQuery(val); setLeadId(item ? String(item._id) : ''); }}
                  />
                  {formErrors.lead && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.lead}</div>}
                </div>
                <div>
                  <label>Deal ID</label>
                  <input value={dealId} onChange={e=>setDealId(e.target.value)} placeholder="CRM deal id" />
                </div>
                <div>
                  <label>Amount *</label>
                  <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="15000" />
                  {formErrors.amount && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.amount}</div>}
                </div>
                <div>
                  <label>Currency</label>
                  <input value={currency} onChange={e=>setCurrency(e.target.value)} placeholder="USD" />
                </div>
                <div>
                  <label>Closed won?</label>
                  <select value={String(closedWon)} onChange={e=>setClosedWon(e.target.value==='true')}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label>Closed at {closedWon ? '*' : ''}</label>
                  <input type="datetime-local" value={closedAt} onChange={e=>setClosedAt(e.target.value)} />
                  {formErrors.closed_at && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.closed_at}</div>}
                </div>
                <div>
                  <label>Stage</label>
                  <input value={stage} onChange={e=>setStage(e.target.value)} />
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label>Notes</label>
                  <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} style={{ width:'100%' }} />
                </div>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <button className="btn-primary" onClick={submitForm}>Save Deal</button>
              </div>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Import</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Import Deal CSV</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Upload a CSV file with deal data, verify the preview, then map the lead, amount, and close date fields required for import.
              </div>
              <div className="m06-file-drop">
                <div className="m06-inline-note" style={{ marginBottom: 10 }}>
                  Select a deal CSV file. Required columns are lead, amount, and closed_at.
                </div>
                <input type="file" accept=".csv" onChange={onFileChange} />
              </div>
              {headerError && <div style={{ marginTop:8, fontSize:12, color:'#c33' }}>{headerError}</div>}
              {!headerError && headersPreview.length > 0 && <div className="m06-inline-note" style={{ marginTop:8 }}>Detected headers: {headersPreview.join(', ')}</div>}
              {rowsPreview.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div className="m06-preview-head">
                    Previewing rows {previewStartIndex}-{previewEndIndex} of {rowsPreview.length}
                    {previewLimited ? ` (showing first ${rowsPreview.length} of ${totalPreviewRows})` : totalPreviewRows ? ` (total rows: ${totalPreviewRows})` : ''}
                    {blankRowCount > 0 ? ` | Blank lines skipped: ${blankRowCount}` : ''}
                  </div>
                  <div className="m06-preview-shell">
                    <div className="m06-preview-table-wrap">
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr>
                            {headersPreview.map((header, idx)=><th key={idx}>{header}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {previewPageRows.map((row, rIdx)=>(
                            <tr key={rIdx}>
                              {headersPreview.map((_, cIdx)=><td key={cIdx}>{row[cIdx] ?? ''}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <div className="m06-mapping-grid">
                <div>
                  <label>Deal ID</label>
                  <input list="deal-upload-headers" value={mapDealId} onChange={e=>setMapDealId(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Lead *</label>
                  <input list="deal-upload-headers" value={mapLead} onChange={e=>setMapLead(e.target.value)} placeholder="Column name" />
                </div>
                <div>
                  <label>Amount *</label>
                  <input list="deal-upload-headers" value={mapAmount} onChange={e=>setMapAmount(e.target.value)} placeholder="Column name" />
                </div>
                <div>
                  <label>Currency</label>
                  <input list="deal-upload-headers" value={mapCurrency} onChange={e=>setMapCurrency(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Closed won</label>
                  <input list="deal-upload-headers" value={mapClosedWon} onChange={e=>setMapClosedWon(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Closed at *</label>
                  <input list="deal-upload-headers" value={mapClosedAt} onChange={e=>setMapClosedAt(e.target.value)} placeholder="Column name" />
                </div>
                <div>
                  <label>Stage</label>
                  <input list="deal-upload-headers" value={mapStage} onChange={e=>setMapStage(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Notes</label>
                  <input list="deal-upload-headers" value={mapNotes} onChange={e=>setMapNotes(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Start row</label>
                  <input type="number" min={1} value={String(startRow)} onChange={e=>setStartRow(Number(e.target.value||1))} />
                </div>
                <div>
                  <label>End row</label>
                  <input type="number" min={1} value={endRow!==undefined?String(endRow):''} placeholder="auto" onChange={e=>setEndRow(e.target.value?Number(e.target.value):undefined)} />
                </div>
                <div>
                  <label>Duplicate policy</label>
                  <select value={duplicatePolicy} onChange={e=>setDuplicatePolicy(e.target.value as any)}>
                    <option value="skip">Skip duplicates</option>
                    <option value="allow">Allow duplicates</option>
                  </select>
                </div>
              </div>
              <datalist id="deal-upload-headers">
                {headerOptions.map(opt => <option key={opt.value} value={opt.value} />)}
              </datalist>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12 }}>
                <input type="checkbox" checked={mappingConfirmed} onChange={e=>setMappingConfirmed(e.target.checked)} />
                <span className="m06-inline-note">I have reviewed my mappings and understand they will create deal records.</span>
              </label>
              <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn-primary" disabled={importing} onClick={submitCsv}>{importing?'Importing...':'Import CSV'}</button>
                {uploadSummary && <span className="m06-inline-note">Processed {uploadSummary.processed}, Inserted {uploadSummary.inserted}, Failed {uploadSummary.failed}, Duplicates {uploadSummary.duplicates}</span>}
                {uploadSummary && uploadSummary.failedRows && uploadSummary.failedRows.length>0 && (
                  <button className="btn-ghost" onClick={downloadFailedCSV}>Download failed rows CSV</button>
                )}
              </div>
            </section>
          )}

          {modalOpen && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3 style={{ marginTop:0 }}>Edit Deal</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10 }}>
                  <label>
                    <div style={{ fontSize:12 }}>Amount</div>
                    <input value={editAmount} onChange={e=>setEditAmount(e.target.value)} />
                  </label>
                  <label>
                    <div style={{ fontSize:12 }}>Closed won</div>
                    <select value={editClosedWon} onChange={e=>setEditClosedWon(e.target.value)}>
                      <option value="true">Closed Won</option>
                      <option value="false">Not Won</option>
                    </select>
                  </label>
                  <label>
                    <div style={{ fontSize:12 }}>Closed at</div>
                    <input type="datetime-local" value={editClosedAt} onChange={e=>setEditClosedAt(e.target.value)} />
                  </label>
                  <label>
                    <div style={{ fontSize:12 }}>Stage</div>
                    <input value={editStage} onChange={e=>setEditStage(e.target.value)} />
                  </label>
                  <label>
                    <div style={{ fontSize:12 }}>Notes</div>
                    <textarea rows={3} value={editNotes} onChange={e=>setEditNotes(e.target.value)} />
                  </label>
                </div>
                <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button className="btn-ghost" onClick={()=>{ setModalOpen(false); setEditing(null); }}>Cancel</button>
                  <button className="btn-primary" onClick={saveEdit}>Save</button>
                </div>
              </div>
            </div>
          )}

          {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
        </div>
      </main>
    </Layout>
  );
}
