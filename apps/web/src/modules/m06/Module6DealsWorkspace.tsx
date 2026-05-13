import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import Autocomplete from '../../components/Autocomplete';
import { CSV_UPLOAD_LIMIT_BYTES, CSV_UPLOAD_LIMIT_LABEL } from '../../utils/csvUpload';
import ImportPreviewStep from './components/ImportPreviewStep';
import {
  archiveDeal,
  createDeal,
  deleteDealPermanent,
  importDealsCSV,
  listDeals,
  searchLeads,
  updateDeal,
  validateDealsCSV,
  type Deal,
  type DealImportSummary,
  type DealValidationResult,
} from './services/deals';
import {
  DEAL_CURRENCY_OPTIONS,
  DEAL_HEADER_ALIASES,
  DEAL_REQUIRED_FIELDS,
  defaultDealMapping,
  emptyDealForm,
  type DealFieldKey,
  type DealFormState,
  type DealMapping,
} from './dealInputSchema';
import './module6.css';

type DealTab = 'list' | 'form' | 'csv';
type CsvRow = { rowNumber: number; original: Record<string, string> };

function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: type === 'success' ? '#e9fff3' : '#fff1f1', color: type === 'success' ? '#0a7' : '#a22', border: `1px solid ${type === 'success' ? '#a6e7c3' : '#f3b6b6'}` }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Dismiss</button>
    </div>
  );
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { currentValue += '"'; index += 1; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      currentRow.push(currentValue.trim());
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }
    currentValue += char;
  }
  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    rows.push(currentRow);
  }
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(text: string) {
  return text.toLowerCase().replace(/[\s_-]+/g, '').replace(/s$/, '');
}

function autoMapHeaders(headers: string[]): DealMapping {
  const mapping = defaultDealMapping();
  const used = new Set<string>();
  (Object.keys(mapping) as DealFieldKey[]).forEach((field) => {
    const aliases = DEAL_HEADER_ALIASES[field].map(normalizeHeader);
    const match = headers.find((header) => !used.has(header) && aliases.includes(normalizeHeader(header)));
    mapping[field] = match || '';
    if (match) used.add(match);
  });
  return mapping;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatLeadDisplay(lead: any) {
  const name = String(lead?.full_name || lead?.name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [leadId ? `#${leadId}` : '', name, email].filter(Boolean).join(' | ') || 'Unknown lead';
}

function formatLeadOption(lead: any) {
  const name = String(lead?.full_name || lead?.name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [leadId ? `#${leadId}` : '', name, email].filter(Boolean).join(' • ') || 'Unknown lead';
}

export default function Module6DealsWorkspace(){
  const [activeTab, setActiveTab] = useState<DealTab>('list');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);
  const [leadQuery, setLeadQuery] = useState('');
  const [filterLeadQuery, setFilterLeadQuery] = useState('');
  const [form, setForm] = useState<DealFormState>(emptyDealForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<DealFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [filterLeadId, setFilterLeadId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('closed_won');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string|undefined>(undefined);
  const [editing, setEditing] = useState<string|null>(null);
  const [editState, setEditState] = useState({ revenue: '', closed_won: 'true', closed_at: '', currency: 'USD' });

  const [csvFileName, setCsvFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<DealMapping>(defaultDealMapping);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number|''>('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip'|'allow'>('skip');
  const [validationResult, setValidationResult] = useState<DealValidationResult | null>(null);
  const [uploadSummary, setUploadSummary] = useState<DealImportSummary|null>(null);
  const [validatingCsv, setValidatingCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 90);
    setFrom(past.toISOString().slice(0,10));
    setTo(now.toISOString().slice(0,10));
  }, []);

  function validateForm(nextForm: DealFormState) {
    const errors: Partial<Record<DealFieldKey, string>> = {};
    if (!nextForm.deal_id.trim()) errors.deal_id = 'Deal ID is required.';
    if (!nextForm.lead_id.trim()) errors.lead_id = 'Lead is required.';
    if (!nextForm.revenue.trim()) errors.revenue = 'Revenue is required.';
    else if (Number.isNaN(Number(nextForm.revenue)) || Number(nextForm.revenue) < 0) errors.revenue = 'Revenue must be 0 or higher.';
    if (!DEAL_CURRENCY_OPTIONS.includes(nextForm.currency as typeof DEAL_CURRENCY_OPTIONS[number])) errors.currency = 'Select a valid currency.';
    if (!['true','false'].includes(nextForm.closed_won)) errors.closed_won = 'Closed won must be true or false.';
    if (nextForm.closed_won === 'true' && !nextForm.closed_at.trim()) errors.closed_at = 'Closed at is required when closed won is true.';
    if (nextForm.closed_at && Number.isNaN(new Date(nextForm.closed_at).getTime())) errors.closed_at = 'Closed at must be a valid datetime.';
    return errors;
  }

  function validateMappingState(nextMapping: DealMapping) {
    const issues: string[] = [];
    const counts = new Map<string, number>();
    Object.values(nextMapping).forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    counts.forEach((count, header) => { if (count > 1) issues.push(`CSV column "${header}" is mapped more than once.`); });
    DEAL_REQUIRED_FIELDS.forEach((field) => { if (!nextMapping[field]) issues.push(`Required field "${field}" is not mapped.`); });
    return issues;
  }

  function validateRangeState(totalRows: number, start: number, end: number | '') {
    if (!totalRows) return 'Upload a CSV file first.';
    if (!Number.isInteger(start) || start < 1) return 'Start row must be 1 or greater.';
    const safeEnd = end === '' ? totalRows : Number(end);
    if (!Number.isInteger(safeEnd)) return 'End row must be a whole number.';
    if (safeEnd < start) return 'End row cannot be earlier than start row.';
    if (safeEnd > totalRows) return `End row cannot exceed ${totalRows}.`;
    return null;
  }

  function setFormValue(key: DealFieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setMappingValue(key: DealFieldKey, value: string) {
    const next = { ...mapping, [key]: value };
    setMapping(next);
    setMappingErrors(validateMappingState(next));
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
  }

  async function load(){
    setLoading(true);
    setLoadError(undefined);
    try {
      const data = await listDeals({
        leadId: filterLeadId || undefined,
        from,
        to,
        status,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        includeArchived,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error:any) {
      setLoadError(error?.message || 'Failed to load deals');
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [filterLeadId, from, to, status, minAmount, maxAmount, includeArchived]);

  async function submitForm() {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { setToast({ msg:'Please fix the highlighted form errors.', type:'error' }); return; }
    if (!window.confirm('Are you sure you want to save this record?')) return;
    setSaving(true);
    try {
      await createDeal({
        deal_id: form.deal_id.trim(),
        lead_id: form.lead_id.trim(),
        revenue: Number(form.revenue),
        currency: form.currency,
        closed_won: form.closed_won === 'true',
        closed_at: form.closed_at || undefined,
      });
      setToast({ msg:'Deal record saved successfully.', type:'success' });
      setForm(emptyDealForm());
      setLeadQuery('');
      setActiveTab('list');
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to create deal.', type:'error' });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: Deal) {
    setEditing(row._id || null);
    setEditState({
      revenue: String(row.revenue || ''),
      closed_won: String(row.closed_won),
      closed_at: row.closed_at ? new Date(row.closed_at).toISOString().slice(0,16) : '',
      currency: row.currency || 'USD',
    });
  }

  async function saveEdit() {
    if(!editing) return;
    try {
      await updateDeal(editing, {
        revenue: Number(editState.revenue),
        closed_won: editState.closed_won === 'true',
        closed_at: editState.closed_at || undefined,
        currency: editState.currency,
      });
      setToast({ msg:'Updated', type:'success' });
      setEditing(null);
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Update failed', type:'error' });
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    setCsvFileName('');
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFileError(null);
    setMapping(defaultDealMapping());
    setMappingErrors([]);
    setStartRow(1);
    setEndRow('');
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
    if (!file) { input.value = ''; return; }
    if (!file.name.toLowerCase().endsWith('.csv')) { setCsvFileError('Only CSV files are supported.'); input.value = ''; return; }
    if (file.size <= 0) { setCsvFileError('Uploaded file is empty.'); input.value = ''; return; }
    if (file.size > CSV_UPLOAD_LIMIT_BYTES) { setCsvFileError(`File exceeds the ${CSV_UPLOAD_LIMIT_LABEL} size limit.`); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsedRows = parseCsvText(text);
        if (parsedRows.length < 2) { setCsvFileError('The uploaded file does not contain any data rows.'); return; }
        const headers = parsedRows[0];
        const dataRows = parsedRows.slice(1).map((row, rowIndex) => ({ rowNumber: rowIndex + 1, original: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])) }));
        const nextMapping = autoMapHeaders(headers);
        setCsvFileName(file.name);
        setCsvText(text);
        setCsvHeaders(headers);
        setCsvRows(dataRows);
        setMapping(nextMapping);
        setMappingErrors(validateMappingState(nextMapping));
        setStartRow(1);
        setEndRow(dataRows.length);
      } catch {
        setCsvFileError('The uploaded file could not be parsed.');
      }
    };
    reader.onerror = () => setCsvFileError('The uploaded file could not be read.');
    reader.readAsText(file);
    input.value = '';
  }

  async function runCsvValidation() {
    const nextMappingErrors = validateMappingState(mapping);
    const nextRangeError = validateRangeState(csvRows.length, startRow, endRow);
    setMappingErrors(nextMappingErrors);
    setRangeError(nextRangeError);
    if (!csvText.trim()) { setCsvFileError('Upload a CSV file first.'); return; }
    if (nextMappingErrors.length > 0 || nextRangeError) { setToast({ msg:'Please fix the CSV mapping and row range errors first.', type:'error' }); return; }
    setValidatingCsv(true);
    try {
      const result = await validateDealsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        duplicatePolicy,
      });
      setValidationResult(result);
      setUploadSummary(null);
      setShowPreview(false);
      setToast({ msg:`Validation finished. ${result.summary.validRows} valid rows and ${result.summary.invalidRows} invalid rows found.`, type:'success' });
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'CSV validation failed.', type:'error' });
    } finally {
      setValidatingCsv(false);
    }
  }

  async function submitCsvImport(allowPartial: boolean) {
    if (!validationResult) { await runCsvValidation(); return; }
    const confirmMessage = validationResult.summary.invalidRows > 0 && allowPartial
      ? `Some rows contain errors. ${validationResult.summary.invalidRows} rows will be skipped. Continue uploading ${validationResult.summary.validRows} valid rows only?`
      : `Please confirm the field mapping and selected row range. You are about to upload ${validationResult.summary.validRows} valid rows. Continue?`;
    if (!window.confirm(confirmMessage)) return;
    setImporting(true);
    try {
      const summary = await importDealsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        duplicatePolicy,
        allowPartial,
      });
      setUploadSummary(summary);
      setToast({ msg:`${summary.inserted || 0} rows inserted, ${summary.failed || 0} failed, ${summary.duplicates || 0} duplicates skipped.`, type:'success' });
      setActiveTab('list');
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to import CSV', type:'error' });
    } finally {
      setImporting(false);
    }
  }

  function downloadInvalidRows() {
    if (!validationResult || validationResult.summary.invalidRows === 0) return;
    const invalidRows = validationResult.rowResults.filter((row) => !row.valid);
    const lines = [['row_number','error_fields','error_messages', ...csvHeaders].join(',')];
    invalidRows.forEach((row) => {
      const errorFields = row.errors.map((issue) => issue.field).join('; ');
      const errorMessages = row.errors.map((issue) => issue.message).join('; ');
      const values = csvHeaders.map((header) => JSON.stringify(row.original[header] ?? ''));
      lines.push([row.rowNumber, JSON.stringify(errorFields), JSON.stringify(errorMessages), ...values].join(','));
    });
    downloadTextFile('deal-invalid-rows.csv', lines.join('\n'));
  }

  const previewRows = useMemo(() => {
    if (validationResult) return validationResult.rowResults;
    return csvRows.filter((row) => row.rowNumber >= startRow && row.rowNumber <= (endRow === '' ? csvRows.length : Number(endRow))).map((row) => ({ ...row, valid: true, errors: [], warnings: [] }));
  }, [csvRows, endRow, startRow, validationResult]);

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
                <div className="m06-hero-copy">Manage revenue records with the same validation-heavy manual and CSV ingestion pattern used across the data hub.</div>
              </div>
              <div className="m06-leads-stat-grid">
                <div className="m06-kpi-card"><div className="label">Visible deals</div><div className="value">{rows.length}</div></div>
                <div className="m06-kpi-card"><div className="label">Current mode</div><div className="value" style={{ fontSize: 22 }}>{activeTab === 'list' ? 'View' : activeTab === 'form' ? 'Manual' : 'CSV import'}</div></div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Deal Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Manage deals from one screen</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>Switch between reviewing existing deals, adding one deal manually, and validating/importing CRM exports through CSV.</div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}><span className="step">1</span><span className="meta"><strong>View deals</strong><span>Filter, edit, archive, and delete deal records</span></span></button>
              <button className={`m06-tab-btn ${activeTab === 'form' ? 'active' : ''}`} onClick={() => setActiveTab('form')}><span className="step">2</span><span className="meta"><strong>Add deal</strong><span>Create one revenue record with full validation</span></span></button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}><span className="step">3</span><span className="meta"><strong>Upload CSV</strong><span>Map, preview, validate, and import batches</span></span></button>
            </div>
          </section>

          {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Deal Table</h3>
              <div className="m06-helper">Filter by lead, close window, status, and revenue range before editing or archiving deal records.</div>
              <div className="m06-campaign-filter-grid" style={{ marginTop: 16 }}>
                <div>
                  <label>Lead</label>
                  <Autocomplete value={filterLeadQuery} placeholder="Lead id / name / email" fetchItems={async (query) => { const result = await searchLeads(query); return result.leads || []; }} formatItem={formatLeadDisplay} getValue={formatLeadDisplay} onChange={(value,item)=>{ setFilterLeadQuery(value); setFilterLeadId(item ? String(item.lead_id) : ''); }} />
                </div>
                <div><label>Closed from</label><input type="date" value={from} onChange={(event)=>setFrom(event.target.value)} /></div>
                <div><label>Closed to</label><input type="date" value={to} onChange={(event)=>setTo(event.target.value)} /></div>
                <div><label>Status</label><select value={status} onChange={(event)=>setStatus(event.target.value)}><option value="">All</option><option value="closed_won">Closed Won</option><option value="open">Open</option></select></div>
                <div><label>Min revenue</label><input value={minAmount} onChange={(event)=>setMinAmount(event.target.value)} placeholder="1000" /></div>
                <div><label>Max revenue</label><input value={maxAmount} onChange={(event)=>setMaxAmount(event.target.value)} placeholder="50000" /></div>
                <div><label>Archive filter</label><label className="toggle" style={{ minHeight: 46 }}><input type="checkbox" checked={includeArchived} onChange={(event)=>setIncludeArchived(event.target.checked)} />Include archived</label></div>
              </div>
              <div className="m06-toolbar" style={{ marginTop: 14 }}><div className="m06-inline-note">Deals default to a rolling 90-day closed-won window when the page first opens.</div><button className="btn-ghost" onClick={() => load()}>Reload</button></div>
              <div className="m06-leads-table-wrap">
                {loadError && <div style={{ background:'#fee', color:'#900', padding:'8px 10px', border:'1px solid #f99', borderRadius:6, marginBottom:8 }}>Could not load deals: {loadError}</div>}
                {loading && <div className="m06-inline-note">Loading deals...</div>}
                {!loading && rows.length === 0 && <div className="m06-leads-empty">No deals found.</div>}
                {!loading && rows.length > 0 && (
                  <div className="m06-table-shell" style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead><tr><th>Deal ID</th><th>Lead ID</th><th>Revenue</th><th>Currency</th><th>Status</th><th>Closed at</th><th>Actions</th></tr></thead>
                      <tbody>
                        {rows.map((row) => {
                          const isEditing = editing === row._id;
                          return (
                            <tr key={row._id}>
                              <td>{row.deal_id}</td>
                              <td>{row.lead_id}</td>
                              <td>{isEditing ? <input value={editState.revenue} onChange={(event)=>setEditState((prev)=>({ ...prev, revenue: event.target.value }))} /> : row.revenue}</td>
                              <td>{isEditing ? <select value={editState.currency} onChange={(event)=>setEditState((prev)=>({ ...prev, currency: event.target.value }))}>{DEAL_CURRENCY_OPTIONS.map((option)=><option key={option} value={option}>{option}</option>)}</select> : (row.currency || 'USD')}</td>
                              <td>{isEditing ? <select value={editState.closed_won} onChange={(event)=>setEditState((prev)=>({ ...prev, closed_won: event.target.value }))}><option value="true">Closed Won</option><option value="false">Not Won</option></select> : (row.closed_won ? 'Closed Won' : 'Open')}</td>
                              <td>{isEditing ? <input type="datetime-local" value={editState.closed_at} onChange={(event)=>setEditState((prev)=>({ ...prev, closed_at: event.target.value }))} /> : (row.closed_at ? new Date(row.closed_at).toLocaleString() : '-')}</td>
                              <td style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {!isEditing ? (
                                  <>
                                    <button className="btn-ghost" onClick={()=>startEdit(row)}>Edit</button>
                                    <button className="btn-ghost" onClick={async ()=>{ if(!window.confirm('This will archive the deal. Proceed?')) return; try { await archiveDeal(row._id!); setToast({ msg:'Archived', type:'success' }); await load(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Archive failed', type:'error' }); } }}>Archive</button>
                                    <button className="btn-danger" onClick={async ()=>{ const input = prompt(`Type the Deal ID (${row.deal_id}) to confirm permanent deletion:`, ''); if(input !== row.deal_id) return; try { await deleteDealPermanent(row._id!); setToast({ msg:'Deleted', type:'success' }); await load(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Delete failed', type:'error' }); } }}>Delete</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn-primary" onClick={saveEdit}>Save</button>
                                    <button className="btn-ghost" onClick={()=>setEditing(null)}>Cancel</button>
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
              <div className="m06-section-label">Manual Entry</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Single Deal Form</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>Add one revenue record with lead linkage, revenue, currency, win state, and close date.</div>
              {Object.values(formErrors).filter(Boolean).length > 0 && (
                <div className="m06-summary-box" style={{ marginBottom: 14, border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}>
                  <strong>Fix these issues before saving:</strong>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {Object.entries(formErrors).map(([field, message]) => message ? <div key={field}>{message}</div> : null)}
                  </div>
                </div>
              )}
              <div className="m06-form-grid">
                <div>
                  <label>Lead *</label>
                  <Autocomplete value={leadQuery} placeholder="Lead id / name / email" fetchItems={async (query)=>{ const result = await searchLeads(query); return result.leads || []; }} formatItem={formatLeadDisplay} getValue={formatLeadDisplay} onChange={(value,item)=>{ setLeadQuery(value); setFormValue('lead_id', item ? String(item.lead_id) : ''); }} />
                  {formErrors.lead_id && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.lead_id}</div>}
                </div>
                <div><label>Deal ID *</label><input value={form.deal_id} onChange={(event)=>setFormValue('deal_id', event.target.value)} />{formErrors.deal_id && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.deal_id}</div>}</div>
                <div><label>Revenue *</label><input value={form.revenue} onChange={(event)=>setFormValue('revenue', event.target.value)} />{formErrors.revenue && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.revenue}</div>}</div>
                <div><label>Currency</label><select value={form.currency} onChange={(event)=>setFormValue('currency', event.target.value)}>{DEAL_CURRENCY_OPTIONS.map((option)=><option key={option} value={option}>{option}</option>)}</select></div>
                <div><label>Closed won *</label><select value={form.closed_won} onChange={(event)=>setFormValue('closed_won', event.target.value)}><option value="true">Yes</option><option value="false">No</option></select>{formErrors.closed_won && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.closed_won}</div>}</div>
                <div><label>Closed at {form.closed_won === 'true' ? '*' : '(optional)'}</label><input type="datetime-local" value={form.closed_at} onChange={(event)=>setFormValue('closed_at', event.target.value)} />{formErrors.closed_at && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.closed_at}</div>}</div>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <button className="btn-primary" disabled={saving} onClick={submitForm}>{saving ? 'Saving...' : 'Save Deal'}</button>
                <button className="btn-ghost" onClick={() => { setForm(emptyDealForm()); setLeadQuery(''); setFormErrors({}); }}>Clear</button>
              </div>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Upload</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Deal CSV Import</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>Upload a CSV, review auto-detected mappings, open the shared preview step, validate rows, inspect invalid rows, and confirm before import.</div>
              <div className="m06-file-drop"><div className="m06-inline-note" style={{ marginBottom: 10 }}>Only `.csv` files up to {CSV_UPLOAD_LIMIT_LABEL} are accepted.</div><input type="file" accept=".csv" onChange={onFileChange} />{csvFileName && <div className="m06-inline-note" style={{ marginTop: 8 }}>Loaded file: {csvFileName}</div>}</div>
              {csvFileError && <div style={{ marginTop:8, fontSize:12, color:'#c33' }}>{csvFileError}</div>}
              {csvHeaders.length > 0 && (
                <>
                  <div className="m06-summary-box"><strong>Detected headers</strong><div style={{ marginTop: 6 }}>{csvHeaders.join(', ')}</div></div>
                  <div className="m06-mapping-grid">
                    {(Object.keys(mapping) as DealFieldKey[]).map((field) => {
                      const usedElsewhere = new Set(Object.entries(mapping).filter(([key, value]) => key !== field && value).map(([, value]) => value));
                      return (
                        <div key={field}>
                          <label>{field}{DEAL_REQUIRED_FIELDS.includes(field) ? ' *' : ' (optional)'}</label>
                          <select value={mapping[field]} onChange={(event)=>setMappingValue(field, event.target.value)}>
                            <option value="">{DEAL_REQUIRED_FIELDS.includes(field) ? 'Select CSV column' : 'Skip this field'}</option>
                            {csvHeaders.filter((header) => !usedElsewhere.has(header) || header === mapping[field]).map((header) => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </div>
                      );
                    })}
                    <div><label>Start row *</label><input type="number" min={1} value={startRow} onChange={(event)=>{ setStartRow(Number(event.target.value||1)); setValidationResult(null); setShowPreview(false); }} /></div>
                    <div><label>End row *</label><input type="number" min={1} value={endRow} onChange={(event)=>{ setEndRow(event.target.value ? Number(event.target.value) : ''); setValidationResult(null); setShowPreview(false); }} /></div>
                    <div><label>Duplicate policy</label><select value={duplicatePolicy} onChange={(event)=>{ setDuplicatePolicy(event.target.value as 'skip'|'allow'); setValidationResult(null); setShowPreview(false); }}><option value="skip">Skip duplicates</option><option value="allow">Allow duplicates</option></select></div>
                  </div>
                  {mappingErrors.length > 0 && <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}><strong>Mapping issues</strong><div style={{ marginTop: 8, display:'grid', gap:4 }}>{mappingErrors.map((issue)=><div key={issue}>{issue}</div>)}</div></div>}
                  {rangeError && <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}><strong>Row range issue</strong><div style={{ marginTop: 8 }}>{rangeError}</div></div>}
                  <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}><button className="btn-primary" disabled={validatingCsv} onClick={runCsvValidation}>{validatingCsv ? 'Validating...' : 'Validate CSV'}</button><button className="btn-ghost" onClick={() => { setCsvFileName(''); setCsvText(''); setCsvHeaders([]); setCsvRows([]); setCsvFileError(null); setMapping(defaultDealMapping()); setMappingErrors([]); setStartRow(1); setEndRow(''); setValidationResult(null); setUploadSummary(null); setShowPreview(false); }}>Reset Upload</button></div>
                  {validationResult && <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}><button className="btn-ghost" onClick={() => setShowPreview((prev) => !prev)}>{showPreview ? 'Hide Preview' : 'Open Preview'}</button></div>}
                  {showPreview && previewRows.length > 0 && <div style={{ marginTop: 18 }}><ImportPreviewStep title="Deal CSV Preview" subtitle="This reusable Module 6 preview step is shared across data-hub ingestion flows." sourceHeaders={csvHeaders} rows={previewRows} currentStartRow={startRow} totalSelectedRows={previewRows.length} startFullscreen /></div>}
                  {validationResult && (
                    <div className="m06-summary-box" style={{ marginTop:16 }}>
                      <div style={{ fontWeight:600, marginBottom:4 }}>Validation Summary</div>
                      <div>Total rows checked: {validationResult.summary.checkedRows}</div>
                      <div>Valid rows: {validationResult.summary.validRows}</div>
                      <div>Invalid rows: {validationResult.summary.invalidRows}</div>
                      <div>Warning rows: {validationResult.summary.warningRows}</div>
                      <div>Selected range: rows {validationResult.selectedRange.startRow} to {validationResult.selectedRange.endRow}</div>
                      <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
                        {validationResult.summary.invalidRows > 0 && <button className="btn-ghost" onClick={downloadInvalidRows}>Download Invalid Rows</button>}
                        {validationResult.summary.validRows > 0 && <button className="btn-primary" disabled={importing} onClick={() => submitCsvImport(validationResult.summary.invalidRows > 0)}>{importing ? 'Importing...' : validationResult.summary.invalidRows > 0 ? 'Proceed With Valid Rows Only' : 'Confirm and Import'}</button>}
                      </div>
                    </div>
                  )}
                  {uploadSummary && <div className="m06-summary-box"><div style={{ fontWeight:600, marginBottom:4 }}>Import Summary</div><div>Processed: {uploadSummary.processed}</div><div>Inserted: {uploadSummary.inserted}</div><div>Failed: {uploadSummary.failed}</div><div>Duplicates skipped: {uploadSummary.duplicates}</div></div>}
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </Layout>
  );
}
