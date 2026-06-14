/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: CampaignTouchInput.tsx
 * Purpose: Supports the C am pa ig nT ou ch In pu t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import Autocomplete from '../../components/Autocomplete';
import { CSV_UPLOAD_LIMIT_BYTES, CSV_UPLOAD_LIMIT_LABEL } from '../../utils/csvUpload';
import ImportPreviewStep from './components/ImportPreviewStep';
import {
  archiveTouch,
  createTouch,
  deleteTouchPermanent,
  importTouchesCSV,
  listTouchesByCampaign,
  listTouchesByLead,
  searchCampaigns,
  searchLeads,
  updateTouch,
  validateTouchesCSV,
  type TouchImportSummary,
  type TouchRecord,
  type TouchValidationResult,
} from './services/touches';
import {
  TOUCH_CHANNEL_OPTIONS,
  TOUCH_HEADER_ALIASES,
  TOUCH_REQUIRED_FIELDS,
  TOUCH_STATUS_OPTIONS,
  TOUCH_TYPE_OPTIONS,
  defaultTouchMapping,
  emptyTouchForm,
  type TouchFieldKey,
  type TouchFormState,
  type TouchMapping,
} from './touchInputSchema';
import './module6.css';

type TouchTab = 'list' | 'form' | 'csv';
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
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
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

function autoMapHeaders(headers: string[]): TouchMapping {
  const mapping = defaultTouchMapping();
  const used = new Set<string>();
  (Object.keys(mapping) as TouchFieldKey[]).forEach((field) => {
    const aliases = TOUCH_HEADER_ALIASES[field].map(normalizeHeader);
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
  const name = String(lead?.full_name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [leadId ? `#${leadId}` : '', name, email].filter(Boolean).join(' | ') || 'Unknown lead';
}

function formatCampaignDisplay(campaign: any) {
  return [campaign?.campaign_id, campaign?.name].filter(Boolean).join(' | ') || 'Unknown campaign';
}

function formatLeadOption(lead: any) {
  const name = String(lead?.full_name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [leadId ? `#${leadId}` : '', name, email].filter(Boolean).join(' • ') || 'Unknown lead';
}

function formatCampaignOption(campaign: any) {
  return [campaign?.campaign_id, campaign?.name].filter(Boolean).join(' • ') || 'Unknown campaign';
}

export default function CampaignTouchInput(){
  const [activeTab, setActiveTab] = useState<TouchTab>('list');
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null);
  const [mode, setMode] = useState<'campaign' | 'lead'>('campaign');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [campaignOptions, setCampaignOptions] = useState<any[]>([]);
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [rows, setRows] = useState<TouchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editState, setEditState] = useState({ channel: 'email', type: 'email_open', touched_at: '', metadata: '', status: 'active' });

  const [form, setForm] = useState<TouchFormState>(emptyTouchForm);
  const [leadQuery, setLeadQuery] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<Record<TouchFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const [csvFileName, setCsvFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<TouchMapping>(defaultTouchMapping);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [campaignIdentifier, setCampaignIdentifier] = useState<'name'|'campaign_id'>('campaign_id');
  const [leadIdentifier, setLeadIdentifier] = useState<'id'|'email'>('id');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip'|'allow'>('skip');
  const [validatingCsv, setValidatingCsv] = useState(false);
  const [validationResult, setValidationResult] = useState<TouchValidationResult | null>(null);
  const [submittingCsv, setSubmittingCsv] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<TouchImportSummary | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function run() {
      const [campaigns, leads] = await Promise.all([searchCampaigns(''), searchLeads('')]);
      if (!ignore) {
        setCampaignOptions(campaigns.campaigns || []);
        setLeadOptions(leads.leads || []);
      }
    }
    void run();
    return () => { ignore = true; };
  }, []);

  async function load() {
    if (!selectedEntityId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = mode === 'campaign'
        ? await listTouchesByCampaign({ campaignId: selectedEntityId, includeArchived: showArchived, type: filterType || undefined, channel: filterChannel || undefined })
        : await listTouchesByLead({ leadId: selectedEntityId, includeArchived: showArchived, type: filterType || undefined, channel: filterChannel || undefined });
      setRows(data || []);
    } catch {
      setRows([]);
      setToast({ msg: 'Failed to load touches.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [selectedEntityId, showArchived, filterType, filterChannel, mode]);

  function resetForm() {
    setForm(emptyTouchForm());
    setLeadQuery('');
    setCampaignQuery('');
    setFormErrors({});
  }

  function resetCsvState() {
    setCsvFileName('');
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFileError(null);
    setMapping(defaultTouchMapping());
    setMappingErrors([]);
    setStartRow(1);
    setEndRow('');
    setRangeError(null);
    setCampaignIdentifier('campaign_id');
    setLeadIdentifier('id');
    setDuplicatePolicy('skip');
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
  }

  function validateForm(nextForm: TouchFormState) {
    const errors: Partial<Record<TouchFieldKey, string>> = {};
    if (!nextForm.lead_id.trim()) errors.lead_id = 'Lead is required.';
    if (!nextForm.campaign_id.trim()) errors.campaign_id = 'Campaign is required.';
    if (!nextForm.touched_at.trim()) errors.touched_at = 'Touched at is required.';
    else if (Number.isNaN(new Date(nextForm.touched_at).getTime())) errors.touched_at = 'Touched at must be a valid datetime.';
    if (!TOUCH_TYPE_OPTIONS.includes(nextForm.type as typeof TOUCH_TYPE_OPTIONS[number])) errors.type = 'Select a valid touch type.';
    if (nextForm.channel && !TOUCH_CHANNEL_OPTIONS.includes(nextForm.channel as typeof TOUCH_CHANNEL_OPTIONS[number])) errors.channel = 'Select a valid channel.';
    if (nextForm.status && !TOUCH_STATUS_OPTIONS.includes(nextForm.status as typeof TOUCH_STATUS_OPTIONS[number])) errors.status = 'Select a valid status.';
    if (nextForm.metadata.trim()) {
      try { JSON.parse(nextForm.metadata); } catch { errors.metadata = 'Metadata must be valid JSON.'; }
    }
    return errors;
  }

  function validateMappingState(nextMapping: TouchMapping) {
    const issues: string[] = [];
    const counts = new Map<string, number>();
    Object.values(nextMapping).forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    counts.forEach((count, header) => { if (count > 1) issues.push(`CSV column "${header}" is mapped more than once.`); });
    TOUCH_REQUIRED_FIELDS.forEach((field) => { if (!nextMapping[field]) issues.push(`Required field "${field}" is not mapped.`); });
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

  function setFormValue(key: TouchFieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setMappingValue(key: TouchFieldKey, value: string) {
    const next = { ...mapping, [key]: value };
    setMapping(next);
    setMappingErrors(validateMappingState(next));
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    resetCsvState();
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
        if ((nextMapping.campaign_id || '').toLowerCase().includes('name')) setCampaignIdentifier('name');
        if ((nextMapping.lead_id || '').toLowerCase().includes('email')) setLeadIdentifier('email');
      } catch {
        setCsvFileError('The uploaded file could not be parsed.');
      }
    };
    reader.onerror = () => setCsvFileError('The uploaded file could not be read.');
    reader.readAsText(file);
    input.value = '';
  }

  async function submitForm() {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { setToast({ msg: 'Please fix the highlighted form errors.', type: 'error' }); return; }
    if (!window.confirm('Are you sure you want to save this record?')) return;
    setSaving(true);
    try {
      await createTouch({
        lead_id: form.lead_id.trim(),
        campaign_id: form.campaign_id.trim(),
        type: form.type,
        channel: form.channel || undefined,
        touched_at: form.touched_at,
        status: form.status || 'active',
        metadata: form.metadata.trim() ? JSON.parse(form.metadata) : undefined,
      });
      setToast({ msg: 'Touch record saved successfully.', type: 'success' });
      resetForm();
      setActiveTab('list');
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to create touch.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(row: TouchRecord) {
    setEditingRowId(row.id);
    setEditState({
      channel: row.channel || 'email',
      type: row.type,
      touched_at: row.touched_at ? new Date(row.touched_at).toISOString().slice(0, 16) : '',
      metadata: row.metadata ? JSON.stringify(row.metadata) : '',
      status: row.status || 'active',
    });
  }

  async function saveEdit() {
    if (!editingRowId) return;
    try {
      await updateTouch(editingRowId, {
        channel: editState.channel,
        type: editState.type,
        touched_at: editState.touched_at,
        status: editState.status,
        metadata: editState.metadata.trim() ? JSON.parse(editState.metadata) : null,
      });
      setToast({ msg: 'Touch updated.', type: 'success' });
      setEditingRowId(null);
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to update touch.', type: 'error' });
    }
  }

  async function runCsvValidation() {
    const nextMappingErrors = validateMappingState(mapping);
    const nextRangeError = validateRangeState(csvRows.length, startRow, endRow);
    setMappingErrors(nextMappingErrors);
    setRangeError(nextRangeError);
    if (!csvText.trim()) { setCsvFileError('Upload a CSV file first.'); return; }
    if (nextMappingErrors.length > 0 || nextRangeError) { setToast({ msg: 'Please fix the CSV mapping and row range errors first.', type: 'error' }); return; }
    setValidatingCsv(true);
    try {
      const result = await validateTouchesCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        campaignIdentifier,
        leadIdentifier,
        duplicatePolicy,
      });
      setValidationResult(result);
      setUploadSummary(null);
      setShowPreview(false);
      setToast({ msg: `Validation finished. ${result.summary.validRows} valid rows and ${result.summary.invalidRows} invalid rows found.`, type: 'success' });
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'CSV validation failed.', type: 'error' });
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
    setSubmittingCsv(true);
    try {
      const summary = await importTouchesCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        campaignIdentifier,
        leadIdentifier,
        duplicatePolicy,
        allowPartial,
      });
      setUploadSummary(summary);
      setToast({ msg: `${summary.inserted || 0} rows inserted, ${summary.failed || 0} failed, ${summary.duplicates || 0} duplicates skipped.`, type: 'success' });
      setActiveTab('list');
      await load();
    } catch (error: unknown) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to import touches.', type: 'error' });
    } finally {
      setSubmittingCsv(false);
    }
  }

  function downloadInvalidRows() {
    if (!validationResult || validationResult.summary.invalidRows === 0) return;
    const invalidRows = validationResult.rowResults.filter((row) => !row.valid);
    const csvHeader = ['row_number', 'error_fields', 'error_messages', ...csvHeaders];
    const lines = [csvHeader.join(',')];
    invalidRows.forEach((row) => {
      const errorFields = row.errors.map((issue) => issue.field).join('; ');
      const errorMessages = row.errors.map((issue) => issue.message).join('; ');
      const values = csvHeaders.map((header) => JSON.stringify(row.original[header] ?? ''));
      lines.push([row.rowNumber, JSON.stringify(errorFields), JSON.stringify(errorMessages), ...values].join(','));
    });
    downloadTextFile('touch-invalid-rows.csv', lines.join('\n'));
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
            <ModuleBackButton toSuffix="/m06" />
          </div>

          <section className="m06-hero">
            <div className="m06-hero-inner m06-leads-hero-grid">
              <div className="m06-leads-hero-copy">
                <div className="m06-pill">M06 Touch Workspace</div>
                <h1 style={{ fontSize: 38 }}>Campaign Touch Operations</h1>
                <div className="m06-hero-copy">
                  Manage touch records with the same validation-heavy manual and CSV ingestion pattern used across the data hub.
                </div>
              </div>
              <div className="m06-leads-stat-grid">
                <div className="m06-kpi-card"><div className="label">Visible touches</div><div className="value">{rows.length}</div></div>
                <div className="m06-kpi-card"><div className="label">Context</div><div className="value" style={{ fontSize: 22 }}>{mode === 'campaign' ? 'Campaign' : 'Lead'}</div></div>
                <div className="m06-kpi-card"><div className="label">Current mode</div><div className="value" style={{ fontSize: 22 }}>{activeTab === 'list' ? 'View' : activeTab === 'form' ? 'Manual' : 'CSV import'}</div></div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Touch Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Manage touch records from one screen</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>Review touch history, create a single touch, or validate and import touch CSV files.</div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}><span className="step">1</span><span className="meta"><strong>View touches</strong><span>Search, filter, edit, archive, and delete touch events</span></span></button>
              <button className={`m06-tab-btn ${activeTab === 'form' ? 'active' : ''}`} onClick={() => { resetForm(); setActiveTab('form'); }}><span className="step">2</span><span className="meta"><strong>Add touch</strong><span>Create one lead-to-campaign interaction record</span></span></button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}><span className="step">3</span><span className="meta"><strong>Upload CSV</strong><span>Map, preview, validate, and import batches</span></span></button>
            </div>
          </section>

          {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Touch Table</h3>
              <div className="m06-helper">Choose whether you want to inspect touches by campaign or by lead, then narrow the result set by type, channel, and archive state before editing rows.</div>
              <div className="m06-leads-toolbar-grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <button className={mode === 'campaign' ? 'btn-primary' : 'btn-ghost'} onClick={() => { setMode('campaign'); setSelectedEntityId(''); }}>By Campaign</button>
                <button className={mode === 'lead' ? 'btn-primary' : 'btn-ghost'} onClick={() => { setMode('lead'); setSelectedEntityId(''); }}>By Lead</button>
                <select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)}>
                  <option value="">{mode === 'campaign' ? 'Choose a campaign' : 'Choose a lead'}</option>
                  {mode === 'campaign'
                    ? campaignOptions.map((campaign) => <option key={campaign.id} value={String(campaign.campaign_id)}>{formatCampaignDisplay(campaign)}</option>)
                    : leadOptions.map((lead) => <option key={lead._id} value={String(lead.lead_id)}>{formatLeadDisplay(lead)}</option>)}
                </select>
                <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                  <option value="">All types</option>
                  {TOUCH_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={filterChannel} onChange={(event) => setFilterChannel(event.target.value)}>
                  <option value="">All channels</option>
                  {TOUCH_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <label className="toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived</label>
              </div>

              <div className="m06-leads-table-wrap">
                {loading && <div className="m06-inline-note">Loading touches...</div>}
                {!loading && rows.length === 0 && <div className="m06-leads-empty">{selectedEntityId ? 'No touches found for this selection.' : 'Choose a campaign or lead above to see touches.'}</div>}
                {!loading && rows.length > 0 && (
                  <div className="m06-table-shell" style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Lead ID</th>
                          <th>Campaign ID</th>
                          <th>Type</th>
                          <th>Channel</th>
                          <th>Touched at</th>
                          <th>Status</th>
                          <th>Metadata</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const editing = editingRowId === row.id;
                          return (
                            <tr key={row.id}>
                              <td>{row.lead_id}</td>
                              <td>{row.campaign_id}</td>
                              <td>{editing ? <select value={editState.type} onChange={(event) => setEditState((prev) => ({ ...prev, type: event.target.value }))}>{TOUCH_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select> : row.type}</td>
                              <td>{editing ? <select value={editState.channel} onChange={(event) => setEditState((prev) => ({ ...prev, channel: event.target.value }))}>{TOUCH_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select> : (row.channel || '-')}</td>
                              <td>{editing ? <input type="datetime-local" value={editState.touched_at} onChange={(event) => setEditState((prev) => ({ ...prev, touched_at: event.target.value }))} /> : new Date(row.touched_at).toLocaleString()}</td>
                              <td>{editing ? <select value={editState.status} onChange={(event) => setEditState((prev) => ({ ...prev, status: event.target.value }))}>{TOUCH_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select> : (row.status || 'active')}</td>
                              <td style={{ maxWidth: 220 }}>{editing ? <textarea rows={2} value={editState.metadata} onChange={(event) => setEditState((prev) => ({ ...prev, metadata: event.target.value }))} style={{ width: '100%' }} /> : (row.metadata ? JSON.stringify(row.metadata) : '-')}</td>
                              <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {!editing ? (
                                  <>
                                    <button className="btn-ghost" onClick={() => beginEdit(row)}>Edit</button>
                                    <button className="btn-ghost" onClick={async () => { try { await archiveTouch(row.id); setToast({ msg: 'Touch archived.', type: 'success' }); await load(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Failed to archive touch.', type: 'error' }); } }}>Archive</button>
                                    <button className="btn-danger" onClick={async () => { if (!window.confirm('Permanent delete this touch?')) return; try { await deleteTouchPermanent(row.id); setToast({ msg: 'Touch deleted.', type: 'success' }); await load(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Failed to delete touch.', type: 'error' }); } }}>Delete</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn-primary" onClick={saveEdit}>Save</button>
                                    <button className="btn-ghost" onClick={() => setEditingRowId(null)}>Cancel</button>
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
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Single Touch Form</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>Create one interaction event by linking a lead, a campaign, and the touch details used by attribution and journey analysis.</div>
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
                  <Autocomplete value={leadQuery} placeholder="Lead id / name / email" fetchItems={async (query) => { const result = await searchLeads(query); return result.leads || []; }} formatItem={formatLeadDisplay} getValue={formatLeadDisplay} onChange={(value, item) => { setLeadQuery(value); setFormValue('lead_id', item ? String(item.lead_id) : ''); }} />
                  {formErrors.lead_id && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.lead_id}</div>}
                </div>
                <div>
                  <label>Campaign *</label>
                  <Autocomplete value={campaignQuery} placeholder="Campaign id / name" fetchItems={async (query) => { const result = await searchCampaigns(query); return result.campaigns || []; }} formatItem={formatCampaignDisplay} getValue={formatCampaignDisplay} onChange={(value, item) => { setCampaignQuery(value); setFormValue('campaign_id', item ? String(item.campaign_id) : ''); }} />
                  {formErrors.campaign_id && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.campaign_id}</div>}
                </div>
                <div>
                  <label>Type *</label>
                  <select value={form.type} onChange={(event) => setFormValue('type', event.target.value)}>{TOUCH_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                </div>
                <div>
                  <label>Channel (optional)</label>
                  <select value={form.channel} onChange={(event) => setFormValue('channel', event.target.value)}>{TOUCH_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                </div>
                <div>
                  <label>Touched at *</label>
                  <input type="datetime-local" value={form.touched_at} onChange={(event) => setFormValue('touched_at', event.target.value)} />
                  {formErrors.touched_at && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.touched_at}</div>}
                </div>
                <div>
                  <label>Status (optional)</label>
                  <select value={form.status} onChange={(event) => setFormValue('status', event.target.value)}>{TOUCH_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label>Metadata (JSON optional)</label>
                  <textarea rows={3} value={form.metadata} onChange={(event) => setFormValue('metadata', event.target.value)} style={{ width:'100%' }} />
                  {formErrors.metadata && <div style={{ color:'#c33', fontSize:11, marginTop:4 }}>{formErrors.metadata}</div>}
                </div>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <button className="btn-primary" disabled={saving} onClick={submitForm}>{saving ? 'Saving...' : 'Create Touch'}</button>
                <button className="btn-ghost" onClick={resetForm}>Clear</button>
              </div>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Upload</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Touch CSV Import</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>Upload a CSV, review auto-detected mappings, open the shared preview step, validate rows, inspect invalid rows, and confirm before import.</div>
              <div className="m06-file-drop">
                <div className="m06-inline-note" style={{ marginBottom: 10 }}>Only `.csv` files up to {CSV_UPLOAD_LIMIT_LABEL} are accepted.</div>
                <input type="file" accept=".csv" onChange={onFileChange} />
                {csvFileName && <div className="m06-inline-note" style={{ marginTop: 8 }}>Loaded file: {csvFileName}</div>}
              </div>
              {csvFileError && <div style={{ marginTop:8, fontSize:12, color:'#c33' }}>{csvFileError}</div>}
              {csvHeaders.length > 0 && (
                <>
                  <div className="m06-summary-box"><strong>Detected headers</strong><div style={{ marginTop: 6 }}>{csvHeaders.join(', ')}</div></div>
                  <div className="m06-mapping-grid" style={{ marginTop: 16 }}>
                    {(Object.keys(mapping) as TouchFieldKey[]).map((field) => {
                      const usedElsewhere = new Set(Object.entries(mapping).filter(([key, value]) => key !== field && value).map(([, value]) => value));
                      return (
                        <div key={field}>
                          <label>{field}{TOUCH_REQUIRED_FIELDS.includes(field) ? ' *' : ' (optional)'}</label>
                          <select value={mapping[field]} onChange={(event) => setMappingValue(field, event.target.value)}>
                            <option value="">{TOUCH_REQUIRED_FIELDS.includes(field) ? 'Select CSV column' : 'Skip this field'}</option>
                            {csvHeaders.filter((header) => !usedElsewhere.has(header) || header === mapping[field]).map((header) => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </div>
                      );
                    })}
                    <div><label>Campaign identifier</label><select value={campaignIdentifier} onChange={(event) => { setCampaignIdentifier(event.target.value as 'name'|'campaign_id'); setValidationResult(null); setShowPreview(false); }}><option value="campaign_id">Campaign ID</option><option value="name">Campaign name</option></select></div>
                    <div><label>Lead identifier</label><select value={leadIdentifier} onChange={(event) => { setLeadIdentifier(event.target.value as 'id'|'email'); setValidationResult(null); setShowPreview(false); }}><option value="id">Lead ID</option><option value="email">Lead email</option></select></div>
                    <div><label>Duplicate policy</label><select value={duplicatePolicy} onChange={(event) => { setDuplicatePolicy(event.target.value as 'skip'|'allow'); setValidationResult(null); setShowPreview(false); }}><option value="skip">Skip duplicates</option><option value="allow">Allow duplicates</option></select></div>
                    <div><label>Start row *</label><input type="number" min={1} value={startRow} onChange={(event) => { setStartRow(Number(event.target.value || 1)); setValidationResult(null); setShowPreview(false); }} /></div>
                    <div><label>End row *</label><input type="number" min={1} value={endRow} onChange={(event) => { setEndRow(event.target.value ? Number(event.target.value) : ''); setValidationResult(null); setShowPreview(false); }} /></div>
                  </div>
                  {mappingErrors.length > 0 && <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}><strong>Mapping issues</strong><div style={{ marginTop: 8, display: 'grid', gap: 4 }}>{mappingErrors.map((issue) => <div key={issue}>{issue}</div>)}</div></div>}
                  {rangeError && <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}><strong>Row range issue</strong><div style={{ marginTop: 8 }}>{rangeError}</div></div>}
                  <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
                    <button className="btn-primary" disabled={validatingCsv} onClick={runCsvValidation}>{validatingCsv ? 'Validating...' : 'Validate CSV'}</button>
                    <button className="btn-ghost" onClick={resetCsvState}>Reset Upload</button>
                  </div>
                  {validationResult && <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}><button className="btn-ghost" onClick={() => setShowPreview((prev) => !prev)}>{showPreview ? 'Hide Preview' : 'Open Preview'}</button></div>}
                  {showPreview && previewRows.length > 0 && <div style={{ marginTop: 18 }}><ImportPreviewStep title="Touch CSV Preview" subtitle="This reusable Module 6 preview step is shared across data-hub ingestion flows." sourceHeaders={csvHeaders} rows={previewRows} currentStartRow={startRow} totalSelectedRows={previewRows.length} startFullscreen /></div>}
                  {validationResult && (
                    <div className="m06-summary-box" style={{ marginTop: 16 }}>
                      <div style={{ fontWeight:600, marginBottom:4 }}>Validation Summary</div>
                      <div>Total rows checked: {validationResult.summary.checkedRows}</div>
                      <div>Valid rows: {validationResult.summary.validRows}</div>
                      <div>Invalid rows: {validationResult.summary.invalidRows}</div>
                      <div>Warning rows: {validationResult.summary.warningRows}</div>
                      <div>Selected range: rows {validationResult.selectedRange.startRow} to {validationResult.selectedRange.endRow}</div>
                      <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
                        {validationResult.summary.invalidRows > 0 && <button className="btn-ghost" onClick={downloadInvalidRows}>Download Invalid Rows</button>}
                        {validationResult.summary.validRows > 0 && <button className="btn-primary" disabled={submittingCsv} onClick={() => submitCsvImport(validationResult.summary.invalidRows > 0)}>{submittingCsv ? 'Importing...' : validationResult.summary.invalidRows > 0 ? 'Proceed With Valid Rows Only' : 'Confirm and Import'}</button>}
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
