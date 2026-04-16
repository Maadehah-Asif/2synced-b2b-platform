import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { CSV_UPLOAD_LIMIT_BYTES, CSV_UPLOAD_LIMIT_LABEL } from '../../utils/csvUpload';
import './module6.css';
import ImportPreviewStep from './components/ImportPreviewStep';
import {
  archiveModule6Lead,
  createModule6Lead,
  fetchModule6Leads,
  importModule6LeadsCSV,
  updateModule6Lead,
  validateModule6LeadsCSV,
  type LeadCsvValidationResult,
  type LeadImportSummary,
  type Module6Lead,
} from './services/leads';
import {
  LEAD_HEADER_ALIASES,
  LEAD_INDUSTRY_OPTIONS,
  LEAD_OWNER_OPTIONS,
  LEAD_REQUIRED_FIELDS,
  LEAD_REGION_OPTIONS,
  LEAD_SCHEMA_FIELDS,
  LEAD_SEGMENT_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  defaultLeadMapping,
  emptyLeadForm,
  type LeadFieldKey,
  type LeadFormState,
  type LeadMapping,
} from './leadInputSchema';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const LEAD_ALLOWED_VALUES: Partial<Record<LeadFieldKey, readonly string[]>> = {
  source: LEAD_SOURCE_OPTIONS,
  owner: LEAD_OWNER_OPTIONS,
  industry: LEAD_INDUSTRY_OPTIONS,
  region: LEAD_REGION_OPTIONS,
  segment: LEAD_SEGMENT_OPTIONS,
};

type CsvRow = {
  rowNumber: number;
  original: Record<string, string>;
};

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
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

function autoMapHeaders(headers: string[]): LeadMapping {
  const mapping = defaultLeadMapping();
  const usedHeaders = new Set<string>();

  for (const field of LEAD_SCHEMA_FIELDS) {
    const aliases = LEAD_HEADER_ALIASES[field.key].map(normalizeHeader);
    const match = headers.find((header) => !usedHeaders.has(header) && aliases.includes(normalizeHeader(header)));
    mapping[field.key] = match || '';
    if (match) usedHeaders.add(match);
  }

  return mapping;
}

function toLeadForm(lead?: Module6Lead | null): LeadFormState {
  if (!lead) return emptyLeadForm();
  return {
    lead_id: lead.lead_id || '',
    full_name: lead.full_name || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    company: lead.company || '',
    source: lead.source || '',
    owner: lead.owner || '',
    industry: lead.industry || '',
    region: lead.region || '',
    lead_score: lead.lead_score != null ? String(lead.lead_score) : '',
    intent_score: lead.intent_score != null ? String(lead.intent_score) : '',
    email: lead.email || '',
    job_title: lead.job_title || '',
    segment: lead.segment || '',
  };
}

function buildLeadPayload(form: LeadFormState) {
  return {
    ...form,
    lead_score: form.lead_score.trim() ? Number(form.lead_score) : null,
    intent_score: form.intent_score.trim() ? Number(form.intent_score) : null,
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

export default function Module6Leads() {
  const [activeTab, setActiveTab] = useState<'list' | 'manual' | 'csv'>('list');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [leads, setLeads] = useState<Module6Lead[]>([]);
  const [editing, setEditing] = useState<Module6Lead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<LeadFieldKey, string>>>({});
  const [savingLead, setSavingLead] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [csvFileName, setCsvFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<LeadMapping>(defaultLeadMapping);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [validatingCsv, setValidatingCsv] = useState(false);
  const [validationResult, setValidationResult] = useState<LeadCsvValidationResult | null>(null);
  const [submittingCsv, setSubmittingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState<LeadImportSummary | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  async function reloadLeads() {
    setLoading(true);
    try {
      const result = await fetchModule6Leads({ search, includeArchived, limit: 200 });
      setLeads(result.leads || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadLeads();
  }, [search, includeArchived]);

  const duplicateLeadIds = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      if (editing?._id && lead._id === editing._id) continue;
      set.add(lead.lead_id.toLowerCase());
    }
    return set;
  }, [leads, editing]);

  const selectedCsvRows = useMemo(() => {
    if (!csvRows.length) return [];
    const safeStart = Math.max(1, startRow || 1);
    const safeEnd = endRow === '' ? csvRows.length : Number(endRow);
    return csvRows.filter((row) => row.rowNumber >= safeStart && row.rowNumber <= safeEnd);
  }, [csvRows, startRow, endRow]);

  function resetManualForm() {
    setEditing(null);
    setLeadForm(emptyLeadForm());
    setFormErrors({});
  }

  function resetCsvState() {
    setCsvFileName('');
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFileError(null);
    setMapping(defaultLeadMapping());
    setMappingErrors([]);
    setStartRow(1);
    setEndRow('');
    setRangeError(null);
    setValidationResult(null);
    setImportSummary(null);
    setShowPreview(false);
  }

  function validateManualForm(form: LeadFormState) {
    const nextErrors: Partial<Record<LeadFieldKey, string>> = {};
    if (!form.lead_id.trim()) nextErrors.lead_id = 'This field is required.';
    if (form.lead_id.trim() && duplicateLeadIds.has(form.lead_id.trim().toLowerCase())) nextErrors.lead_id = 'A record with this Lead ID already exists.';
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) nextErrors.email = 'Invalid email format.';
    if (form.lead_score.trim() && Number.isNaN(Number(form.lead_score))) nextErrors.lead_score = 'Lead score must be numeric.';
    if (form.intent_score.trim() && Number.isNaN(Number(form.intent_score))) nextErrors.intent_score = 'Intent score must be numeric.';
    (Object.keys(LEAD_ALLOWED_VALUES) as LeadFieldKey[]).forEach((field) => {
      const value = form[field]?.trim();
      const options = LEAD_ALLOWED_VALUES[field];
      if (!value || !options) return;
      if (!options.some((option) => option.toLowerCase() === value.toLowerCase())) {
        nextErrors[field] = `Select a valid ${field.replace('_', ' ')}.`;
      }
    });
    return nextErrors;
  }

  function validateMappingState(nextMapping: LeadMapping) {
    const issues: string[] = [];
    const counts = new Map<string, number>();
    for (const value of Object.values(nextMapping)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    for (const [header, count] of counts.entries()) {
      if (count > 1) issues.push(`CSV column "${header}" is mapped more than once.`);
    }
    for (const field of LEAD_REQUIRED_FIELDS) {
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

  function setFieldValue(key: LeadFieldKey, value: string) {
    setLeadForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setMappingValue(key: LeadFieldKey, value: string) {
    const next = { ...mapping, [key]: value };
    setMapping(next);
    setMappingErrors(validateMappingState(next));
    setValidationResult(null);
    setImportSummary(null);
    setShowPreview(false);
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
        setStartRow(1);
        setEndRow(dataRows.length);
        setMapping(nextMapping);
        setMappingErrors(validateMappingState(nextMapping));
      } catch {
        setCsvFileError('The uploaded file could not be parsed.');
      }
    };
    reader.onerror = () => setCsvFileError('The uploaded file could not be read.');
    reader.readAsText(file);
    input.value = '';
  }

  async function submitLeadForm(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateManualForm(leadForm);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setToast({ msg: 'Please fix the highlighted form errors.', type: 'error' });
      return;
    }
    if (!window.confirm('Are you sure you want to save this record?')) return;

    setSavingLead(true);
    try {
      const payload = buildLeadPayload(leadForm);
      if (editing?._id) {
        await updateModule6Lead(editing._id, payload);
        setToast({ msg: 'Lead record saved successfully.', type: 'success' });
      } else {
        await createModule6Lead(payload);
        setToast({ msg: 'Lead record saved successfully.', type: 'success' });
      }
      resetManualForm();
      setActiveTab('list');
      await reloadLeads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save lead.';
      setToast({ msg: message, type: 'error' });
    } finally {
      setSavingLead(false);
    }
  }

  async function archiveLeadRow(lead: Module6Lead) {
    if (!window.confirm(`Archive lead ${lead.lead_id}?`)) return;
    try {
      await archiveModule6Lead(lead._id);
      setToast({ msg: 'Lead archived.', type: 'success' });
      await reloadLeads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to archive lead.';
      setToast({ msg: message, type: 'error' });
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
      const result = await validateModule6LeadsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
      });
      setValidationResult(result);
      setImportSummary(null);
      setShowPreview(false);
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
    downloadTextFile('lead-invalid-rows.csv', lines.join('\n'));
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
      const summary = await importModule6LeadsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        allowPartial,
      });
      setImportSummary(summary);
      setToast({ msg: `${summary.inserted || 0} rows inserted, ${summary.updated || 0} updated, ${summary.skipped || 0} skipped.`, type: 'success' });
      await reloadLeads();
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
                <div className="m06-pill">M06 + M07 Shared Leads</div>
                <h1 style={{ fontSize: 38 }}>Unified Lead Intake</h1>
                <div className="m06-hero-copy">
                  Manage the shared lead table used by the revenue and funnel flows. Manual entry and CSV upload now follow the same schema rules, confirmation steps, and validation behavior.
                </div>
              </div>
              <div className="m06-leads-stat-grid">
                <div className="m06-kpi-card">
                  <div className="label">Visible leads</div>
                  <div className="value">{leads.length}</div>
                </div>
                <div className="m06-kpi-card">
                  <div className="label">Current mode</div>
                  <div className="value" style={{ fontSize: 22 }}>
                    {activeTab === 'list' ? 'View' : activeTab === 'manual' ? 'Manual' : 'CSV import'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Lead Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Choose how you want to work with shared lead data</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>
              Review records, add or update a single lead manually, or validate and import a mapped CSV through a dedicated preview step.
            </div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <span className="step">1</span>
                <span className="meta">
                  <strong>View leads</strong>
                  <span>Search, review, and edit shared records</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { resetManualForm(); setActiveTab('manual'); }}>
                <span className="step">2</span>
                <span className="meta">
                  <strong>Add manually</strong>
                  <span>Create one lead with full validation</span>
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
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Lead Table</h3>
              <div className="m06-helper">
                Review the shared lead records available to both Module 6 and Module 7.
              </div>
              <div className="m06-leads-toolbar-grid" style={{ marginTop: 16 }}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by lead id, name, company, email" />
                <label className="toggle">
                  <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                  Show archived
                </label>
                <button className="btn-ghost" onClick={() => reloadLeads()}>Reload</button>
              </div>

              <div className="m06-leads-table-wrap">
                {loading && <div className="m06-inline-note">Loading...</div>}
                {!loading && leads.length === 0 && <div className="m06-leads-empty">No leads found.</div>}
                {!loading && leads.length > 0 && (
                  <div className="m06-table-shell" style={{ overflowX: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Lead ID</th>
                          <th>Full name</th>
                          <th>Company</th>
                          <th>Email</th>
                          <th>Source</th>
                          <th>Owner</th>
                          <th>Lead score</th>
                          <th>Intent score</th>
                          <th>Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr key={lead._id} style={{ opacity: lead.is_archived ? 0.65 : 1 }}>
                            <td>{lead.lead_id}</td>
                            <td>{lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '-'}</td>
                            <td>{lead.company || '-'}</td>
                            <td>{lead.email || '-'}</td>
                            <td>{lead.source || '-'}</td>
                            <td>{lead.owner || '-'}</td>
                            <td>{lead.lead_score ?? '-'}</td>
                            <td>{lead.intent_score ?? '-'}</td>
                            <td>{lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : '-'}</td>
                            <td style={{ display: 'flex', gap: 8 }}>
                              <button className="btn-ghost" onClick={() => { setEditing(lead); setLeadForm(toLeadForm(lead)); setFormErrors({}); setActiveTab('manual'); }}>Edit</button>
                              {!lead.is_archived && <button className="btn-ghost" onClick={() => archiveLeadRow(lead)}>Archive</button>}
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
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>{editing ? `Edit ${editing.lead_id}` : 'Add Lead Manually'}</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Required and optional fields follow the same schema used by CSV validation and backend ingestion.
              </div>
              {Object.values(formErrors).filter(Boolean).length > 0 && (
                <div className="m06-summary-box" style={{ marginBottom: 14, border: '1px solid rgba(195,51,51,0.18)', background: '#fff7f7' }}>
                  <strong>Fix these issues before saving:</strong>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {Object.entries(formErrors).map(([field, message]) => message ? <div key={field}>{message}</div> : null)}
                  </div>
                </div>
              )}
              <form onSubmit={submitLeadForm}>
                <div className="m06-form-grid">
                  {LEAD_SCHEMA_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label>{field.label}{field.required ? ' *' : ' (optional)'}</label>
                      {field.type === 'select' ? (
                        <select value={leadForm[field.key]} onChange={(event) => setFieldValue(field.key, event.target.value)} style={{ width: '100%' }}>
                          <option value="">Select {field.label}</option>
                          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'text' : field.type}
                          value={leadForm[field.key]}
                          onChange={(event) => setFieldValue(field.key, event.target.value)}
                          placeholder={field.label}
                          style={{ width: '100%' }}
                        />
                      )}
                      {field.helperText && <div className="m06-inline-note" style={{ marginTop: 4 }}>{field.helperText}</div>}
                      {formErrors[field.key] && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors[field.key]}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="btn-primary" type="submit" disabled={savingLead}>{savingLead ? 'Saving...' : 'Save Lead'}</button>
                  <button className="btn-ghost" type="button" onClick={resetManualForm}>Clear</button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Upload</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Lead CSV Import</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Upload a CSV, review auto-detected mappings, open the dedicated preview step, validate rows, inspect invalid rows, and confirm before import.
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
                    {LEAD_SCHEMA_FIELDS.map((field) => {
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
                      <input type="number" min={1} value={startRow} onChange={(event) => { setStartRow(Number(event.target.value || 1)); setValidationResult(null); setShowPreview(false); }} />
                    </div>
                    <div>
                      <label>End row *</label>
                      <input type="number" min={1} value={endRow} onChange={(event) => { setEndRow(event.target.value ? Number(event.target.value) : ''); setValidationResult(null); setShowPreview(false); }} />
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
                    <button className="btn-primary" onClick={runCsvValidation} disabled={validatingCsv}>
                      {validatingCsv ? 'Validating...' : 'Validate CSV'}
                    </button>
                    <button className="btn-ghost" onClick={resetCsvState}>Reset Upload</button>
                  </div>

                  {validationResult && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" onClick={() => setShowPreview((prev) => !prev)}>
                        {showPreview ? 'Hide Preview' : 'Open Preview'}
                      </button>
                    </div>
                  )}

                  {showPreview && selectedCsvRows.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <ImportPreviewStep
                        title="Lead CSV Preview"
                        subtitle="This reusable Module 6 preview step is the shared import-review pattern for current and future data-ingestion screens."
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
                          <button
                            className="btn-primary"
                            onClick={() => submitCsvImport(validationResult.summary.invalidRows > 0)}
                            disabled={submittingCsv}
                          >
                            {submittingCsv
                              ? 'Importing...'
                              : validationResult.summary.invalidRows > 0
                                ? 'Proceed With Valid Rows Only'
                                : 'Confirm and Import'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {importSummary && (
                    <div className="m06-summary-box">
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Import Summary</div>
                      <div>Selected rows: {importSummary.selected ?? 0}</div>
                      <div>Inserted: {importSummary.inserted ?? 0}</div>
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
