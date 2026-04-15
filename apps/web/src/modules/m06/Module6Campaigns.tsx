import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { CSV_UPLOAD_LIMIT_BYTES, CSV_UPLOAD_LIMIT_LABEL } from '../../utils/csvUpload';
import './module6.css';
import ImportPreviewStep from './components/ImportPreviewStep';
import {
  archiveCampaign,
  createCampaign,
  deleteCampaignPermanent,
  fetchCampaigns,
  importCampaignsCsv,
  updateCampaign,
  validateCampaignsCsv,
  type CampaignCsvValidationResult,
  type CampaignImportSummary,
  type CampaignRecord,
} from './services/campaigns';
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_HEADER_ALIASES,
  CAMPAIGN_REQUIRED_FIELDS,
  CAMPAIGN_SCHEMA_FIELDS,
  CAMPAIGN_STATUS_OPTIONS,
  defaultCampaignMapping,
  emptyCampaignForm,
  type CampaignFieldKey,
  type CampaignFormState,
  type CampaignMapping,
} from './campaignInputSchema';

type CampaignTab = 'list' | 'manual' | 'csv';
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

function autoMapHeaders(headers: string[]): CampaignMapping {
  const mapping = defaultCampaignMapping();
  const usedHeaders = new Set<string>();
  for (const field of CAMPAIGN_SCHEMA_FIELDS) {
    const aliases = CAMPAIGN_HEADER_ALIASES[field.key].map(normalizeHeader);
    const match = headers.find((header) => !usedHeaders.has(header) && aliases.includes(normalizeHeader(header)));
    mapping[field.key] = match || '';
    if (match) usedHeaders.add(match);
  }
  return mapping;
}

function toForm(record?: CampaignRecord | null): CampaignFormState {
  if (!record) return emptyCampaignForm();
  return {
    campaign_id: record.campaign_id || '',
    name: record.name || '',
    channel: record.channel || 'email',
    description: record.description || '',
    tags: Array.isArray(record.tags) ? record.tags.join(', ') : '',
    start_date: record.start_date ? new Date(record.start_date).toISOString().slice(0, 10) : '',
    end_date: record.end_date ? new Date(record.end_date).toISOString().slice(0, 10) : '',
    status: record.status || 'active',
    spend: record.spend != null ? String(record.spend) : '',
  };
}

function buildPayload(form: CampaignFormState) {
  return {
    campaign_id: form.campaign_id.trim(),
    name: form.name.trim(),
    channel: form.channel,
    description: form.description.trim() || undefined,
    tags: form.tags.trim() ? form.tags.split(',').map((item) => item.trim()).filter(Boolean) : [],
    start_date: form.start_date || undefined,
    end_date: form.end_date || undefined,
    status: form.status || 'active',
    spend: form.spend.trim() ? Number(form.spend) : null,
  };
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

export default function Module6Campaigns(){
  const [activeTab, setActiveTab] = useState<CampaignTab>('list');
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [selected, setSelected] = useState<CampaignRecord | null>(null);
  const [form, setForm] = useState<CampaignFormState>(emptyCampaignForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<CampaignFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string, type:'success'|'error'}|null>(null);

  const [csvFileName, setCsvFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CampaignMapping>(defaultCampaignMapping);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [validatingCsv, setValidatingCsv] = useState(false);
  const [validationResult, setValidationResult] = useState<CampaignCsvValidationResult | null>(null);
  const [submittingCsv, setSubmittingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState<CampaignImportSummary | null>(null);

  async function reloadCampaigns() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaigns({
        search,
        channel: channelFilter,
        includeArchived,
        createdFrom,
        createdTo,
        startFrom,
        startTo,
      });
      setCampaigns(result.campaigns || []);
    } catch {
      setError('Failed to load campaigns.');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadCampaigns();
  }, [search, channelFilter, includeArchived, createdFrom, createdTo, startFrom, startTo]);

  const duplicateCampaignIds = useMemo(() => {
    const set = new Set<string>();
    for (const campaign of campaigns) {
      if (selected?.id && campaign.id === selected.id) continue;
      set.add(campaign.campaign_id.toLowerCase());
    }
    return set;
  }, [campaigns, selected]);

  const totalSpend = campaigns.reduce((sum, campaign) => sum + (Number(campaign.spend) || 0), 0);
  const selectedCsvRows = useMemo(() => {
    if (!csvRows.length) return [];
    const safeEnd = endRow === '' ? csvRows.length : Number(endRow);
    return csvRows.filter((row) => row.rowNumber >= startRow && row.rowNumber <= safeEnd);
  }, [csvRows, startRow, endRow]);

  function resetForm() {
    setSelected(null);
    setForm(emptyCampaignForm());
    setFormErrors({});
  }

  function resetCsvState() {
    setCsvFileName('');
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFileError(null);
    setMapping(defaultCampaignMapping());
    setMappingErrors([]);
    setStartRow(1);
    setEndRow('');
    setRangeError(null);
    setValidationResult(null);
    setImportSummary(null);
  }

  function validateForm(nextForm: CampaignFormState) {
    const errors: Partial<Record<CampaignFieldKey, string>> = {};
    if (!nextForm.campaign_id.trim()) errors.campaign_id = 'This field is required.';
    if (nextForm.campaign_id.trim() && duplicateCampaignIds.has(nextForm.campaign_id.trim().toLowerCase())) errors.campaign_id = 'A campaign with this ID already exists.';
    if (!nextForm.name.trim()) errors.name = 'This field is required.';
    if (!CAMPAIGN_CHANNEL_OPTIONS.includes(nextForm.channel as typeof CAMPAIGN_CHANNEL_OPTIONS[number])) errors.channel = 'Select a valid channel.';
    if (!nextForm.spend.trim()) errors.spend = 'This field is required.';
    else if (Number.isNaN(Number(nextForm.spend)) || Number(nextForm.spend) < 0) errors.spend = 'Spend must be 0 or higher.';
    if (nextForm.status && !CAMPAIGN_STATUS_OPTIONS.includes(nextForm.status as typeof CAMPAIGN_STATUS_OPTIONS[number])) errors.status = 'Select a valid status.';
    if (nextForm.start_date && Number.isNaN(new Date(nextForm.start_date).getTime())) errors.start_date = 'Invalid start date.';
    if (nextForm.end_date && Number.isNaN(new Date(nextForm.end_date).getTime())) errors.end_date = 'Invalid end date.';
    if (nextForm.start_date && nextForm.end_date && new Date(nextForm.end_date) < new Date(nextForm.start_date)) errors.end_date = 'End date cannot be earlier than start date.';
    return errors;
  }

  function validateMappingState(nextMapping: CampaignMapping) {
    const issues: string[] = [];
    const counts = new Map<string, number>();
    for (const value of Object.values(nextMapping)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    for (const [header, count] of counts.entries()) {
      if (count > 1) issues.push(`CSV column "${header}" is mapped more than once.`);
    }
    for (const field of CAMPAIGN_REQUIRED_FIELDS) {
      if (!nextMapping[field]) issues.push(`Required field "${field}" is not mapped.`);
    }
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

  function setFormValue(key: CampaignFieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setMappingValue(key: CampaignFieldKey, value: string) {
    const next = { ...mapping, [key]: value };
    setMapping(next);
    setMappingErrors(validateMappingState(next));
    setValidationResult(null);
    setImportSummary(null);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    resetCsvState();
    if (!file) {
      input.value = '';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvFileError('Only CSV files are supported.');
      input.value = '';
      return;
    }
    if (file.size <= 0) {
      setCsvFileError('Uploaded file is empty.');
      input.value = '';
      return;
    }
    if (file.size > CSV_UPLOAD_LIMIT_BYTES) {
      setCsvFileError(`File exceeds the ${CSV_UPLOAD_LIMIT_LABEL} size limit.`);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsedRows = parseCsvText(text);
        if (parsedRows.length < 2) {
          setCsvFileError('The uploaded file does not contain any data rows.');
          return;
        }
        const headers = parsedRows[0];
        const dataRows = parsedRows.slice(1).map((row, rowIndex) => ({
          rowNumber: rowIndex + 1,
          original: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])),
        }));
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

  async function submitForm() {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setToast({ msg: 'Please fix the highlighted form errors.', type: 'error' });
      return;
    }
    if (!window.confirm('Are you sure you want to save this record?')) return;

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (selected) {
        await updateCampaign(selected.id, payload);
        setToast({ msg: 'Campaign record saved successfully.', type: 'success' });
      } else {
        await createCampaign(payload);
        setToast({ msg: 'Campaign record saved successfully.', type: 'success' });
      }
      resetForm();
      setActiveTab('list');
      await reloadCampaigns();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save campaign.';
      setToast({ msg: message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function runCsvValidation() {
    const nextMappingErrors = validateMappingState(mapping);
    const nextRangeError = validateRangeState(csvRows.length, startRow, endRow);
    setMappingErrors(nextMappingErrors);
    setRangeError(nextRangeError);
    if (!csvText.trim()) {
      setCsvFileError('Upload a CSV file first.');
      return;
    }
    if (nextMappingErrors.length > 0 || nextRangeError) {
      setToast({ msg: 'Please fix the CSV mapping and row range errors first.', type: 'error' });
      return;
    }
    setValidatingCsv(true);
    try {
      const result = await validateCampaignsCsv({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
      });
      setValidationResult(result);
      setImportSummary(null);
      setToast({ msg: `Validation finished. ${result.summary.validRows} valid rows and ${result.summary.invalidRows} invalid rows found.`, type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'CSV validation failed.';
      setToast({ msg: message, type: 'error' });
    } finally {
      setValidatingCsv(false);
    }
  }

  function downloadInvalidRows() {
    if (!validationResult || validationResult.summary.invalidRows === 0) return;
    const invalidRows = validationResult.rowResults.filter((row) => !row.valid);
    const csvHeader = ['row_number', 'error_fields', 'error_messages', ...csvHeaders];
    const lines = [csvHeader.join(',')];
    for (const row of invalidRows) {
      const errorFields = row.errors.map((issue) => issue.field).join('; ');
      const errorMessages = row.errors.map((issue) => issue.message).join('; ');
      const values = csvHeaders.map((header) => JSON.stringify(row.original[header] ?? ''));
      lines.push([row.rowNumber, JSON.stringify(errorFields), JSON.stringify(errorMessages), ...values].join(','));
    }
    downloadTextFile('campaign-invalid-rows.csv', lines.join('\n'));
  }

  async function submitCsvImport(allowPartial: boolean) {
    if (!validationResult) {
      await runCsvValidation();
      return;
    }
    const confirmMessage = validationResult.summary.invalidRows > 0 && allowPartial
      ? `Some rows contain errors. ${validationResult.summary.invalidRows} rows will be skipped. Continue uploading ${validationResult.summary.validRows} valid rows only?`
      : `Please confirm the field mapping and selected row range. You are about to upload ${validationResult.summary.validRows} valid rows. Continue?`;
    if (!window.confirm(confirmMessage)) return;

    setSubmittingCsv(true);
    try {
      const summary = await importCampaignsCsv({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        allowPartial,
      });
      setImportSummary(summary);
      setToast({ msg: `${summary.created || 0} rows created, ${summary.updated || 0} updated, ${summary.skipped || 0} skipped.`, type: 'success' });
      await reloadCampaigns();
      setActiveTab('list');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setToast({ msg: message, type: 'error' });
    } finally {
      setSubmittingCsv(false);
    }
  }

  const previewRows = useMemo(() => {
    if (validationResult) return validationResult.rowResults;
    return selectedCsvRows.map((row) => ({ ...row, valid: true, errors: [], warnings: [] }));
  }, [selectedCsvRows, validationResult]);

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
                <div className="m06-pill">M06 Campaign Workspace</div>
                <h1 style={{ fontSize: 38 }}>Campaign Operations</h1>
                <div className="m06-hero-copy">
                  Manage campaign records with the same validation-heavy manual and CSV ingestion pattern used across the shared data hub.
                </div>
              </div>
              <div className="m06-leads-stat-grid">
                <div className="m06-kpi-card">
                  <div className="label">Visible campaigns</div>
                  <div className="value">{campaigns.length}</div>
                </div>
                <div className="m06-kpi-card">
                  <div className="label">Visible spend</div>
                  <div className="value" style={{ fontSize: 22 }}>${totalSpend.toLocaleString()}</div>
                </div>
                <div className="m06-kpi-card">
                  <div className="label">Current mode</div>
                  <div className="value" style={{ fontSize: 22 }}>{activeTab === 'list' ? 'View' : activeTab === 'manual' ? 'Manual' : 'CSV import'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Campaign Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Choose how you want to work with campaign data</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>
              Review existing campaigns, add or update one campaign manually, or validate and import campaign CSV files through the shared preview flow.
            </div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <span className="step">1</span>
                <span className="meta">
                  <strong>View campaigns</strong>
                  <span>Search, review, and maintain campaign records</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { resetForm(); setActiveTab('manual'); }}>
                <span className="step">2</span>
                <span className="meta">
                  <strong>Add manually</strong>
                  <span>Create one campaign with full validation</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>
                <span className="step">3</span>
                <span className="meta">
                  <strong>Upload CSV</strong>
                  <span>Map, preview, validate, and import batches</span>
                </span>
              </button>
            </div>
          </section>

          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Campaign Table</h3>
              <div className="m06-helper">
                Filter by channel and campaign date windows before editing or archiving a record.
              </div>
              <div className="m06-campaign-filter-grid" style={{ marginTop: 16 }}>
                <div>
                  <label>Search</label>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Campaign ID or name" />
                </div>
                <div>
                  <label>Channel</label>
                  <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                    <option value="">All channels</option>
                    {CAMPAIGN_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label>Created from</label>
                  <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
                </div>
                <div>
                  <label>Created to</label>
                  <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
                </div>
                <div>
                  <label>Start from</label>
                  <input type="date" value={startFrom} onChange={(event) => setStartFrom(event.target.value)} />
                </div>
                <div>
                  <label>Start to</label>
                  <input type="date" value={startTo} onChange={(event) => setStartTo(event.target.value)} />
                </div>
              </div>

              <div className="m06-toolbar" style={{ marginTop: 14 }}>
                <label className="toggle">
                  <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                  Include archived
                </label>
                <button className="btn-ghost" onClick={() => reloadCampaigns()}>Reload</button>
              </div>

              {error && <div style={{ color: '#c33', marginTop: 10, fontSize: 13 }}>{error}</div>}
              <div className="m06-leads-table-wrap">
                {loading && <div className="m06-inline-note">Loading campaigns...</div>}
                {!loading && campaigns.length === 0 && <div className="m06-leads-empty">No campaigns found for the current filters.</div>}
                {!loading && campaigns.length > 0 && (
                  <div className="m06-table-shell" style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Campaign ID</th>
                          <th>Name</th>
                          <th>Channel</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Spend</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((campaign) => (
                          <tr key={campaign.id} style={{ opacity: campaign.status === 'archived' ? 0.7 : 1 }}>
                            <td>{campaign.campaign_id}</td>
                            <td>{campaign.name}</td>
                            <td>{campaign.channel}</td>
                            <td>{campaign.start_date ? new Date(campaign.start_date).toISOString().slice(0, 10) : '-'}</td>
                            <td>{campaign.end_date ? new Date(campaign.end_date).toISOString().slice(0, 10) : '-'}</td>
                            <td>${(Number(campaign.spend) || 0).toLocaleString()}</td>
                            <td>{campaign.status || 'active'}</td>
                            <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn-ghost" onClick={() => { setSelected(campaign); setForm(toForm(campaign)); setFormErrors({}); setActiveTab('manual'); }}>Edit</button>
                              {campaign.status !== 'archived' ? (
                                <button className="btn-ghost" onClick={async () => {
                                  if (!window.confirm(`Archive campaign "${campaign.name}"?`)) return;
                                  try { await archiveCampaign(campaign.id); setToast({ msg: 'Campaign archived.', type: 'success' }); await reloadCampaigns(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Failed to archive campaign.', type: 'error' }); }
                                }}>Archive</button>
                              ) : (
                                <button className="btn-danger" onClick={async () => {
                                  const confirmation = window.prompt(`Type the campaign name to confirm permanent delete:\n${campaign.name}`);
                                  if (confirmation !== campaign.name) return;
                                  try { await deleteCampaignPermanent(campaign.id); setToast({ msg: 'Campaign deleted permanently.', type: 'success' }); await reloadCampaigns(); } catch (error: unknown) { setToast({ msg: error instanceof Error ? error.message : 'Failed to delete campaign.', type: 'error' }); }
                                }}>Delete Permanently</button>
                              )}
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
            <section className="m06-panel">
              <div className="m06-section-label">Manual Entry</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>{selected ? `Edit ${selected.name}` : 'Add Campaign Manually'}</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Required and optional campaign fields follow the same schema used by backend validation and CSV import.
              </div>
              {Object.values(formErrors).filter(Boolean).length > 0 && (
                <div className="m06-summary-box" style={{ marginBottom: 14, border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}>
                  <strong>Fix these issues before saving:</strong>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {Object.entries(formErrors).map(([field, message]) => message ? <div key={field}>{message}</div> : null)}
                  </div>
                </div>
              )}
              <div className="m06-form-grid">
                {CAMPAIGN_SCHEMA_FIELDS.map((field) => (
                  <div key={field.key} style={field.key === 'description' ? { gridColumn: '1 / -1' } : undefined}>
                    <label>{field.label}{field.required ? ' *' : ' (optional)'}</label>
                    {field.type === 'select' ? (
                      <select value={form[field.key]} onChange={(event) => setFormValue(field.key, event.target.value)}>
                        {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.key === 'description' ? (
                      <textarea rows={3} value={form[field.key]} onChange={(event) => setFormValue(field.key, event.target.value)} style={{ width: '100%' }} />
                    ) : (
                      <input type={field.type} value={form[field.key]} onChange={(event) => setFormValue(field.key, event.target.value)} />
                    )}
                    {field.helperText && <div className="m06-inline-note" style={{ marginTop: 4 }}>{field.helperText}</div>}
                    {formErrors[field.key] && <div style={{ color:'#c33', fontSize:12, marginTop:4 }}>{formErrors[field.key]}</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={submitForm} disabled={saving}>{saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Campaign'}</button>
                <button className="btn-ghost" onClick={resetForm}>Clear</button>
              </div>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Upload</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Campaign CSV Import</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Upload a CSV, review auto-detected mappings, open the shared preview step, validate rows, inspect invalid rows, and confirm before import.
              </div>

              <div className="m06-file-drop">
                <div className="m06-inline-note" style={{ marginBottom: 10 }}>
                  Only `.csv` files up to {CSV_UPLOAD_LIMIT_LABEL} are accepted.
                </div>
                <input type="file" accept=".csv" onChange={onFileChange} />
                {csvFileName && <div className="m06-inline-note" style={{ marginTop: 8 }}>Loaded file: {csvFileName}</div>}
              </div>

              {csvFileError && <div style={{ marginTop: 8, color: '#c33', fontSize: 12 }}>{csvFileError}</div>}

              {csvHeaders.length > 0 && (
                <>
                  <div className="m06-summary-box">
                    <strong>Detected headers</strong>
                    <div style={{ marginTop: 6 }}>{csvHeaders.join(', ')}</div>
                  </div>

                  <div className="m06-mapping-grid" style={{ marginTop: 16 }}>
                    {CAMPAIGN_SCHEMA_FIELDS.map((field) => {
                      const usedElsewhere = new Set(
                        Object.entries(mapping)
                          .filter(([key, value]) => key !== field.key && value)
                          .map(([, value]) => value),
                      );
                      return (
                        <div key={field.key}>
                          <label>{field.label}{field.required ? ' *' : ' (optional)'}</label>
                          <select value={mapping[field.key]} onChange={(event) => setMappingValue(field.key, event.target.value)}>
                            <option value="">{field.required ? 'Select CSV column' : 'Skip this field'}</option>
                            {csvHeaders.filter((header) => !usedElsewhere.has(header) || header === mapping[field.key]).map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                    <div>
                      <label>Start row *</label>
                      <input type="number" min={1} value={startRow} onChange={(event) => { setStartRow(Number(event.target.value || 1)); setValidationResult(null); }} />
                    </div>
                    <div>
                      <label>End row *</label>
                      <input type="number" min={1} value={endRow} onChange={(event) => { setEndRow(event.target.value ? Number(event.target.value) : ''); setValidationResult(null); }} />
                    </div>
                  </div>

                  {mappingErrors.length > 0 && (
                    <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}>
                      <strong>Mapping issues</strong>
                      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                        {mappingErrors.map((issue) => <div key={issue}>{issue}</div>)}
                      </div>
                    </div>
                  )}
                  {rangeError && (
                    <div className="m06-summary-box" style={{ border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}>
                      <strong>Row range issue</strong>
                      <div style={{ marginTop: 8 }}>{rangeError}</div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={runCsvValidation} disabled={validatingCsv}>{validatingCsv ? 'Validating...' : 'Validate and Open Preview'}</button>
                    <button className="btn-ghost" onClick={resetCsvState}>Reset Upload</button>
                  </div>

                  {selectedCsvRows.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <ImportPreviewStep
                        title="Campaign CSV Preview"
                        subtitle="This reusable Module 6 preview step is shared across data-hub ingestion flows."
                        sourceHeaders={csvHeaders}
                        rows={previewRows}
                        currentStartRow={startRow}
                        totalSelectedRows={selectedCsvRows.length}
                      />
                    </div>
                  )}

                  {validationResult && (
                    <div className="m06-summary-box" style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Validation Summary</div>
                      <div>Total rows checked: {validationResult.summary.checkedRows}</div>
                      <div>Valid rows: {validationResult.summary.validRows}</div>
                      <div>Invalid rows: {validationResult.summary.invalidRows}</div>
                      <div>Warning rows: {validationResult.summary.warningRows}</div>
                      <div>Selected range: rows {validationResult.selectedRange.startRow} to {validationResult.selectedRange.endRow}</div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {validationResult.summary.invalidRows > 0 && <button className="btn-ghost" onClick={downloadInvalidRows}>Download Invalid Rows</button>}
                        {validationResult.summary.validRows > 0 && (
                          <button className="btn-primary" onClick={() => submitCsvImport(validationResult.summary.invalidRows > 0)} disabled={submittingCsv}>
                            {submittingCsv ? 'Importing...' : validationResult.summary.invalidRows > 0 ? 'Proceed With Valid Rows Only' : 'Confirm and Import'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {importSummary && (
                    <div className="m06-summary-box">
                      <div style={{ fontWeight:600, marginBottom:4 }}>Import Summary</div>
                      <div>Selected rows: {importSummary.selected ?? 0}</div>
                      <div>Created: {importSummary.created ?? 0}</div>
                      <div>Updated: {importSummary.updated ?? 0}</div>
                      <div>Skipped: {importSummary.skipped ?? 0}</div>
                      <div>Warnings: {importSummary.warnings ?? 0}</div>
                      <div>Failed: {importSummary.failed ?? 0}</div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </Layout>
  );
}
