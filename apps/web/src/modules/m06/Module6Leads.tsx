import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module6.css';
import {
  archiveModule6Lead,
  createModule6Lead,
  fetchModule6Leads,
  importModule6LeadsCSV,
  type LeadImportSummary,
  type Module6Lead,
  updateModule6Lead,
} from './services/leads';

const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

type LeadFormState = {
  lead_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company: string;
  source: string;
  owner: string;
  industry: string;
  region: string;
  lead_score: string;
  intent_score: string;
  email: string;
  job_title: string;
  segment: string;
};

type LeadMapping = Record<
  | 'lead_id'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'source'
  | 'owner'
  | 'industry'
  | 'region'
  | 'lead_score'
  | 'intent_score'
  | 'email'
  | 'job_title'
  | 'segment',
  string
>;

const FIELD_LABELS: Array<{ key: keyof LeadMapping; label: string; required?: boolean }> = [
  { key: 'lead_id', label: 'Lead ID', required: true },
  { key: 'full_name', label: 'Full name' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'company', label: 'Company' },
  { key: 'source', label: 'Source' },
  { key: 'owner', label: 'Owner' },
  { key: 'industry', label: 'Industry' },
  { key: 'region', label: 'Region' },
  { key: 'lead_score', label: 'Lead score' },
  { key: 'intent_score', label: 'Intent score' },
  { key: 'email', label: 'Email' },
  { key: 'job_title', label: 'Job title' },
  { key: 'segment', label: 'Segment' },
];

function emptyLeadForm(): LeadFormState {
  return {
    lead_id: '',
    full_name: '',
    first_name: '',
    last_name: '',
    company: '',
    source: '',
    owner: '',
    industry: '',
    region: '',
    lead_score: '',
    intent_score: '',
    email: '',
    job_title: '',
    segment: '',
  };
}

function defaultMapping(): LeadMapping {
  return {
    lead_id: 'lead_id',
    full_name: 'full_name',
    first_name: 'first_name',
    last_name: 'last_name',
    company: 'company',
    source: 'source',
    owner: 'owner',
    industry: 'industry',
    region: 'region',
    lead_score: 'lead_score',
    intent_score: 'intent_score',
    email: 'email',
    job_title: 'job_title',
    segment: 'segment',
  };
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, background: type === 'success' ? '#0a7' : '#c33', color: '#fff', padding: '10px 14px', borderRadius: 8, zIndex: 60 }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop: 6, background: '#fff', color: '#333' }} onClick={onClose}>Close</button>
    </div>
  );
}

function toLeadForm(lead?: Module6Lead | null): LeadFormState {
  if (!lead) return emptyLeadForm();
  return {
    lead_id: lead.lead_id || '',
    full_name: lead.full_name || lead.name || '',
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

export default function Module6Leads() {
  const [activeTab, setActiveTab] = useState<'list' | 'manual' | 'csv'>('list');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [leads, setLeads] = useState<Module6Lead[]>([]);
  const [editing, setEditing] = useState<Module6Lead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [savingLead, setSavingLead] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [csvText, setCsvText] = useState('');
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<LeadMapping>(defaultMapping);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | undefined>(undefined);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [importSummary, setImportSummary] = useState<LeadImportSummary | null>(null);
  const [submittingCsv, setSubmittingCsv] = useState(false);

  async function reloadLeads() {
    setLoading(true);
    const result = await fetchModule6Leads({ search, includeArchived, limit: 200 });
    setLeads(result.leads || []);
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;
    async function run() {
      setLoading(true);
      const result = await fetchModule6Leads({ search, includeArchived, limit: 200 });
      if (!ignore) {
        setLeads(result.leads || []);
        setLoading(false);
      }
    }
    void run();
    return () => {
      ignore = true;
    };
  }, [search, includeArchived]);

  useEffect(() => {
    setPreviewPage(prev => {
      if (!rowsPreview.length) return 0;
      const maxIndex = Math.max(0, Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) - 1);
      return Math.min(prev, maxIndex);
    });
  }, [rowsPreview]);

  const previewPageCount = rowsPreview.length ? Math.ceil(rowsPreview.length / PREVIEW_PAGE_SIZE) : 1;
  const currentPreviewPage = rowsPreview.length ? Math.min(previewPage, previewPageCount - 1) : 0;
  const previewPageRows = rowsPreview.slice(currentPreviewPage * PREVIEW_PAGE_SIZE, (currentPreviewPage * PREVIEW_PAGE_SIZE) + PREVIEW_PAGE_SIZE);
  const previewStartIndex = rowsPreview.length ? (currentPreviewPage * PREVIEW_PAGE_SIZE) + 1 : 0;
  const previewEndIndex = rowsPreview.length ? Math.min(rowsPreview.length, previewStartIndex + PREVIEW_PAGE_SIZE - 1) : 0;
  const headerOptions = useMemo(() => headersPreview.map(value => ({ value, label: value })), [headersPreview]);

  function resetCsvState() {
    setCsvText('');
    setHeadersPreview([]);
    setRowsPreview([]);
    setTotalPreviewRows(0);
    setPreviewLimited(false);
    setBlankRowCount(0);
    setPreviewPage(0);
    setHeaderError(null);
    setMapping(defaultMapping());
    setStartRow(1);
    setEndRow(undefined);
    setMappingConfirmed(false);
    setImportSummary(null);
  }

  function setMappingValue(key: keyof LeadMapping, value: string) {
    setMapping(prev => ({ ...prev, [key]: value }));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    resetCsvState();
    if (!file) {
      input.value = '';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setToast({ msg: 'Please select a .csv file', type: 'error' });
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
      const cols = headerLine.split(',').map(s => s.trim());
      setHeadersPreview(cols);
      const dataLines = lines.slice(1);
      const nonBlankLines = dataLines.filter(line => line.trim().length > 0);
      const limitedRows = nonBlankLines.slice(0, MAX_PREVIEW_ROWS).map(line => line.split(',').map(s => s.trim()));
      setRowsPreview(limitedRows);
      setTotalPreviewRows(nonBlankLines.length);
      setPreviewLimited(nonBlankLines.length > MAX_PREVIEW_ROWS);
      setBlankRowCount(dataLines.length - nonBlankLines.length);
      setPreviewPage(0);

      const lowerCols = cols.map(c => c.toLowerCase());
      const pickHeader = (candidates: string[], fallbackIndex?: number) => {
        for (const candidate of candidates) {
          const idx = lowerCols.indexOf(candidate);
          if (idx !== -1) return cols[idx];
        }
        if (fallbackIndex !== undefined && cols[fallbackIndex]) return cols[fallbackIndex];
        return '';
      };

      setMapping({
        lead_id: pickHeader(['lead_id', 'lead id', 'leadid'], 0),
        full_name: pickHeader(['full_name', 'full name', 'name', 'lead_name']),
        first_name: pickHeader(['first_name', 'first name']),
        last_name: pickHeader(['last_name', 'last name']),
        company: pickHeader(['company', 'account', 'organization']),
        source: pickHeader(['source', 'lead_source']),
        owner: pickHeader(['owner', 'lead_owner']),
        industry: pickHeader(['industry']),
        region: pickHeader(['region', 'territory']),
        lead_score: pickHeader(['lead_score', 'score']),
        intent_score: pickHeader(['intent_score', 'intent']),
        email: pickHeader(['email', 'email_address', 'email address']),
        job_title: pickHeader(['job_title', 'job title', 'title']),
        segment: pickHeader(['segment']),
      });

      if (cols.length < 2) setHeaderError('Could not detect valid headers. Ensure the first row contains column names.');
    };
    reader.onerror = () => {
      setToast({ msg: 'Failed to read file', type: 'error' });
    };
    reader.readAsText(file);
    input.value = '';
  }

  async function submitCsv() {
    if (!csvText.trim()) {
      setToast({ msg: 'Upload a CSV file first', type: 'error' });
      return;
    }
    if (!mapping.lead_id) {
      setToast({ msg: 'Lead ID mapping is required', type: 'error' });
      return;
    }
    if (!mappingConfirmed) {
      setToast({ msg: 'Confirm your mappings before importing', type: 'error' });
      return;
    }
    setSubmittingCsv(true);
    try {
      const summary = await importModule6LeadsCSV({ csv: csvText, map: mapping, startRow, endRow });
      setImportSummary(summary);
      await reloadLeads();
      setToast({ msg: `Import finished: ${summary.inserted || 0} inserted, ${summary.updated || 0} updated`, type: 'success' });
      setActiveTab('list');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed';
      setToast({ msg: message, type: 'error' });
    } finally {
      setSubmittingCsv(false);
    }
  }

  async function submitLeadForm(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.lead_id.trim()) {
      setToast({ msg: 'Lead ID is required', type: 'error' });
      return;
    }
    setSavingLead(true);
    try {
      const payload = {
        ...leadForm,
        lead_score: leadForm.lead_score ? Number(leadForm.lead_score) : null,
        intent_score: leadForm.intent_score ? Number(leadForm.intent_score) : null,
      };
      if (editing?._id) {
        await updateModule6Lead(editing._id, payload);
        setToast({ msg: 'Lead updated', type: 'success' });
      } else {
        await createModule6Lead(payload);
        setToast({ msg: 'Lead created', type: 'success' });
      }
      setLeadForm(emptyLeadForm());
      setEditing(null);
      setActiveTab('list');
      await reloadLeads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save lead';
      setToast({ msg: message, type: 'error' });
    } finally {
      setSavingLead(false);
    }
  }

  async function archiveLeadRow(lead: Module6Lead) {
    if (!window.confirm(`Archive lead ${lead.lead_id}?`)) return;
    try {
      await archiveModule6Lead(lead._id);
      setToast({ msg: 'Lead archived', type: 'success' });
      await reloadLeads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to archive lead';
      setToast({ msg: message, type: 'error' });
    }
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
                <div className="m06-pill">M06 Lead Workspace</div>
                <h1 style={{ fontSize: 38 }}>Unified Lead Intake</h1>
                <div className="m06-hero-copy">
                  Manage lead records for both revenue and funnel workflows from one place. Switch between viewing
                  the shared lead table, creating or editing individual leads, and importing mapped CSV data without
                  leaving the page.
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
                    {activeTab === 'list' ? 'View' : activeTab === 'manual' ? 'Add lead' : 'CSV import'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Lead Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Choose how you want to work with lead data</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>
              All three actions live on the same screen so you can move between reviewing existing records, adding a single lead,
              or importing a batch without losing context.
            </div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <span className="step">1</span>
                <span className="meta">
                  <strong>View leads</strong>
                  <span>Search, review, and edit shared records</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { setEditing(null); setLeadForm(emptyLeadForm()); setActiveTab('manual'); }}>
                <span className="step">2</span>
                <span className="meta">
                  <strong>Add lead</strong>
                  <span>Create or update one record directly</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>
                <span className="step">3</span>
                <span className="meta">
                  <strong>CSV import</strong>
                  <span>Map columns and import lead batches</span>
                </span>
              </button>
            </div>
          </section>

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Lead Table</h3>
              <div className="m06-helper">
                Review the shared lead records currently available to M06 and M07. Use search and archived filtering to narrow
                the table before opening a row for editing.
              </div>
              <div className="m06-leads-toolbar-grid" style={{ marginTop: 16 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by lead id, name, company, email" />
                <label className="toggle">
                  <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} />
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
                        {leads.map(lead => (
                          <tr key={lead._id} style={{ opacity: lead.is_archived ? 0.65 : 1 }}>
                            <td>{lead.lead_id}</td>
                            <td>{lead.full_name || lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '-'}</td>
                            <td>{lead.company || '-'}</td>
                            <td>{lead.email || '-'}</td>
                            <td>{lead.source || '-'}</td>
                            <td>{lead.owner || '-'}</td>
                            <td>{lead.lead_score ?? '-'}</td>
                            <td>{lead.intent_score ?? '-'}</td>
                            <td>{lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : '-'}</td>
                            <td style={{ display: 'flex', gap: 8 }}>
                              <button className="btn-ghost" onClick={() => { setEditing(lead); setLeadForm(toLeadForm(lead)); setActiveTab('manual'); }}>Edit</button>
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
              <div className="m06-section-label">Add Lead</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>{editing ? `Edit ${editing.lead_id}` : 'Add Lead'}</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Include the funnel fields M07 needs here so you do not have to maintain a separate lead upload path.
              </div>
              <form onSubmit={submitLeadForm}>
                <div className="m06-form-grid">
                  {FIELD_LABELS.map(field => (
                    <div key={field.key}>
                      <label>{field.label}{field.required ? ' *' : ''}</label>
                      <input
                        value={leadForm[field.key]}
                        onChange={e => setLeadForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.label}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="btn-primary" type="submit" disabled={savingLead}>{savingLead ? 'Saving...' : 'Save Lead'}</button>
                  <button className="btn-ghost" type="button" onClick={() => { setEditing(null); setLeadForm(emptyLeadForm()); }}>Clear</button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Import</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>CSV Import</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Map the extra funnel columns here. Existing lead IDs are updated instead of being skipped.
              </div>

              <div className="m06-file-drop">
                <div className="m06-inline-note" style={{ marginBottom: 10 }}>
                  Upload a lead CSV, review the detected header row, then confirm the field mappings before import.
                </div>
                <input type="file" accept=".csv" onChange={onFileChange} />
              </div>

              {headerError && <div style={{ marginTop: 8, color: '#c33', fontSize: 12 }}>{headerError}</div>}
              {!headerError && headersPreview.length > 0 && (
                <div className="m06-inline-note" style={{ marginTop: 8 }}>Detected headers: {headersPreview.join(', ')}</div>
              )}

              {rowsPreview.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="m06-preview-head">
                    Previewing rows {previewStartIndex}-{previewEndIndex} of {rowsPreview.length}
                    {previewLimited ? ` (showing first ${rowsPreview.length} of ${totalPreviewRows})` : totalPreviewRows ? ` (total rows: ${totalPreviewRows})` : ''}
                    {blankRowCount > 0 ? ` | Blank lines skipped: ${blankRowCount}` : ''}
                  </div>
                  <div className="m06-preview-shell">
                    <div className="m06-preview-table-wrap">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {headersPreview.map((header, idx) => (
                              <th key={idx}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewPageRows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {headersPreview.map((_, colIndex) => (
                                <td key={colIndex}>{row[colIndex] ?? ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="m06-mapping-grid">
                {FIELD_LABELS.map(field => (
                  <div key={field.key}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <input
                      list="m06-lead-headers"
                      value={mapping[field.key]}
                      onChange={e => setMappingValue(field.key, e.target.value)}
                      placeholder={field.required ? 'Column name' : 'Optional'}
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
                <div>
                  <label>Start row</label>
                  <input type="number" min={1} value={String(startRow)} onChange={e => setStartRow(Number(e.target.value || 1))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label>End row</label>
                  <input type="number" min={1} placeholder="auto" value={endRow !== undefined ? String(endRow) : ''} onChange={e => setEndRow(e.target.value ? Number(e.target.value) : undefined)} style={{ width: '100%' }} />
                </div>
              </div>
              <datalist id="m06-lead-headers">
                {headerOptions.map(option => <option key={option.value} value={option.value} />)}
              </datalist>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input type="checkbox" checked={mappingConfirmed} onChange={e => setMappingConfirmed(e.target.checked)} />
                <span className="m06-inline-note">I have reviewed the mappings and understand this import updates existing lead IDs.</span>
              </label>

              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={submitCsv} disabled={submittingCsv}>{submittingCsv ? 'Importing...' : 'Import CSV'}</button>
                <button className="btn-ghost" onClick={resetCsvState}>Reset</button>
              </div>

              {importSummary && (
                <div className="m06-summary-box">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Import Summary</div>
                  <div>Selected rows: {importSummary.selected ?? 0}</div>
                  <div>Inserted: {importSummary.inserted ?? 0}</div>
                  <div>Updated: {importSummary.updated ?? 0}</div>
                  <div>Failed: {importSummary.failed ?? 0}</div>
                  <div>Duplicates touched: {importSummary.duplicates ?? 0}</div>
                </div>
              )}
            </section>
          )}

          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </div>
      </main>
    </Layout>
  );
}
