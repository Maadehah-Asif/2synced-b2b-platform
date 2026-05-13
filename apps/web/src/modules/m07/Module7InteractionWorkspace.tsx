import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import Autocomplete from '../../components/Autocomplete';
import { CSV_UPLOAD_LIMIT_BYTES, CSV_UPLOAD_LIMIT_LABEL } from '../../utils/csvUpload';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import ImportPreviewStep from '../m06/components/ImportPreviewStep';
import {
  archiveInteraction,
  createInteraction,
  importInteractionsCSV,
  listInteractions,
  searchCampaigns,
  searchLeads,
  updateInteraction,
  validateInteractionsCSV,
  type InteractionImportSummary,
  type InteractionRecord,
  type InteractionValidationResult,
} from './services/interactions';
import {
  INTERACTION_CHANNEL_OPTIONS,
  defaultInteractionMapping,
  emptyInteractionForm,
  INTERACTION_FIELD_LABELS,
  INTERACTION_HEADER_ALIASES,
  INTERACTION_OUTCOME_OPTIONS,
  INTERACTION_REQUIRED_FIELDS,
  INTERACTION_TYPE_OPTIONS,
  type InteractionFieldKey,
  type InteractionFormState,
  type InteractionMapping,
} from './interactionInputSchema';
import './module7.css';

type InteractionTab = 'list' | 'manual' | 'csv';
type CsvRow = { rowNumber: number; original: Record<string, string> };

function shell(title: string, subtitle: string) {
  return (
    <section style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 20px 46px rgba(13,30,60,0.08)', background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(154,190,201,0.24) 100%)', color: '#fff' }}>
      <div style={{ padding: 28 }}>
        <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>M07 Interaction Workspace</div>
        <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>{title}</h1>
        <div style={{ maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>{subtitle}</div>
      </div>
    </section>
  );
}

function normalizeHeader(text: string) {
  return text.toLowerCase().replace(/[\s_-]+/g, '').replace(/s$/, '');
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { value += '"'; i += 1; } else inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) { row.push(value.trim()); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function autoMapHeaders(headers: string[]): InteractionMapping {
  const mapping = defaultInteractionMapping();
  const used = new Set<string>();
  (Object.keys(mapping) as InteractionFieldKey[]).forEach((field) => {
    const aliases = INTERACTION_HEADER_ALIASES[field].map(normalizeHeader);
    const match = headers.find((header) => !used.has(header) && aliases.includes(normalizeHeader(header)));
    mapping[field] = match || '';
    if (match) used.add(match);
  });
  return mapping;
}

function formatLeadDisplay(lead: any) {
  const name = String(lead?.full_name || '').trim();
  const email = String(lead?.email || '').trim();
  const leadId = String(lead?.lead_id || '').trim();
  return [leadId ? `#${leadId}` : '', name, email].filter(Boolean).join(' | ') || 'Unknown lead';
}

function formatCampaignDisplay(campaign: any) {
  const campaignId = String(campaign?.campaign_id || campaign?.id || '').trim();
  const name = String(campaign?.name || '').trim();
  const channel = String(campaign?.channel || '').trim();
  return [campaignId ? `#${campaignId}` : '', name, channel].filter(Boolean).join(' | ') || 'Unknown campaign';
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

export default function Module7InteractionWorkspace() {
  const workspaceId = getWorkspaceIdFromHash();
  const [activeTab, setActiveTab] = useState<InteractionTab>('list');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rows, setRows] = useState<InteractionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLeadQuery, setFilterLeadQuery] = useState('');
  const [filterLeadId, setFilterLeadId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, setEditState] = useState({ interaction_type: 'email', channel: '', outcome: '', engagement_score: '', notes: '' });

  const [leadQuery, setLeadQuery] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [form, setForm] = useState<InteractionFormState>(emptyInteractionForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<InteractionFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const [csvFileName, setCsvFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<InteractionMapping>(defaultInteractionMapping);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | ''>('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip_duplicates' | 'overwrite_existing'>('skip_duplicates');
  const [validationResult, setValidationResult] = useState<InteractionValidationResult | null>(null);
  const [uploadSummary, setUploadSummary] = useState<InteractionImportSummary | null>(null);
  const [validatingCsv, setValidatingCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formErrorList = useMemo(() => Object.values(formErrors).filter(Boolean) as string[], [formErrors]);
  const shouldShowBanner = Boolean(banner && (banner.type === 'success' || activeTab !== 'list'));

  function setError(message: string) { setBanner({ type: 'error', message }); }
  function setSuccess(message: string) { setBanner({ type: 'success', message }); }

  function validateForm(nextForm: InteractionFormState) {
    const errors: Partial<Record<InteractionFieldKey, string>> = {};
    if (!nextForm.lead_id.trim()) errors.lead_id = 'Lead is required.';
    if (!nextForm.timestamp.trim()) errors.timestamp = 'Timestamp is required.';
    else if (Number.isNaN(new Date(nextForm.timestamp).getTime())) errors.timestamp = 'Timestamp must be a valid datetime.';
    if (!INTERACTION_TYPE_OPTIONS.includes(nextForm.interaction_type as typeof INTERACTION_TYPE_OPTIONS[number])) errors.interaction_type = 'Select a valid interaction type.';
    if (nextForm.channel.trim() && !INTERACTION_CHANNEL_OPTIONS.includes(nextForm.channel.trim() as typeof INTERACTION_CHANNEL_OPTIONS[number])) errors.channel = 'Select a valid channel.';
    if (nextForm.outcome.trim() && !INTERACTION_OUTCOME_OPTIONS.includes(nextForm.outcome.trim() as typeof INTERACTION_OUTCOME_OPTIONS[number])) errors.outcome = 'Select a valid outcome.';
    if (nextForm.engagement_score.trim()) {
      const score = Number(nextForm.engagement_score);
      if (!Number.isFinite(score) || score < 1 || score > 10) errors.engagement_score = 'Engagement score must be between 1 and 10.';
    }
    return errors;
  }

  function validateMappingState(nextMapping: InteractionMapping) {
    const issues: string[] = [];
    const counts = new Map<string, number>();
    Object.values(nextMapping).forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    counts.forEach((count, header) => { if (count > 1) issues.push(`CSV column "${header}" is mapped more than once.`); });
    INTERACTION_REQUIRED_FIELDS.forEach((field) => { if (!nextMapping[field]) issues.push(`Required field "${INTERACTION_FIELD_LABELS[field]}" is not mapped.`); });
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

  function setFormValue(key: InteractionFieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setMappingValue(key: InteractionFieldKey, value: string) {
    const next = { ...mapping, [key]: value };
    setMapping(next);
    setMappingErrors(validateMappingState(next));
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
  }

  async function load() {
    setLoading(true);
    try {
      setRows(await listInteractions({ leadId: filterLeadId || undefined, interactionType: filterType || undefined, includeArchived }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load interaction records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filterLeadId, filterType, includeArchived]);

  async function submitForm() {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return setError('Please fix the highlighted form errors.');
    if (!window.confirm('Are you sure you want to save this record?')) return;
    setSaving(true);
    try {
      await createInteraction({
        interaction_id: form.interaction_id || undefined,
        lead_id: form.lead_id.trim(),
        timestamp: form.timestamp,
        interaction_type: form.interaction_type,
        channel: form.channel || undefined,
        campaign_id: form.campaign_id || undefined,
        outcome: form.outcome || undefined,
        engagement_score: form.engagement_score ? Number(form.engagement_score) : undefined,
        notes: form.notes || undefined,
      });
      setSuccess('Interaction record saved successfully.');
      setForm(emptyInteractionForm());
      setLeadQuery('');
      setCampaignQuery('');
      setActiveTab('list');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create interaction record.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: InteractionRecord) {
    setEditing(row._id || null);
    setEditState({
      interaction_type: row.interaction_type || 'email',
      channel: row.channel || '',
      outcome: row.outcome || '',
      engagement_score: row.engagement_score == null ? '' : String(row.engagement_score),
      notes: row.notes || '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await updateInteraction(editing, {
        interaction_type: editState.interaction_type,
        channel: editState.channel || null,
        outcome: editState.outcome || null,
        engagement_score: editState.engagement_score ? Number(editState.engagement_score) : null,
        notes: editState.notes || null,
      });
      setEditing(null);
      setSuccess('Interaction updated.');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update interaction.');
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCsvFileName('');
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFileError(null);
    setMapping(defaultInteractionMapping());
    setMappingErrors([]);
    setStartRow(1);
    setEndRow('');
    setValidationResult(null);
    setUploadSummary(null);
    setShowPreview(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return setCsvFileError('Only CSV files are supported.');
    if (file.size <= 0) return setCsvFileError('Uploaded file is empty.');
    if (file.size > CSV_UPLOAD_LIMIT_BYTES) return setCsvFileError(`File exceeds the ${CSV_UPLOAD_LIMIT_LABEL} size limit.`);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = parseCsvText(text);
        if (parsed.length < 2) return setCsvFileError('The uploaded file does not contain any data rows.');
        const headers = parsed[0];
        const dataRows = parsed.slice(1).map((row, index) => ({ rowNumber: index + 1, original: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])) }));
        const nextMapping = autoMapHeaders(headers);
        setCsvFileName(file.name);
        setCsvText(text);
        setCsvHeaders(headers);
        setCsvRows(dataRows);
        setMapping(nextMapping);
        setMappingErrors(validateMappingState(nextMapping));
        setEndRow(dataRows.length);
      } catch {
        setCsvFileError('The uploaded file could not be parsed.');
      }
    };
    reader.onerror = () => setCsvFileError('The uploaded file could not be read.');
    reader.readAsText(file);
  }

  async function runCsvValidation() {
    const nextMappingErrors = validateMappingState(mapping);
    const nextRangeError = validateRangeState(csvRows.length, startRow, endRow);
    setMappingErrors(nextMappingErrors);
    setRangeError(nextRangeError);
    if (!csvText.trim()) return setCsvFileError('Upload a CSV file first.');
    if (nextMappingErrors.length > 0 || nextRangeError) return setError('Please fix the CSV mapping and row range errors first.');
    setValidatingCsv(true);
    try {
      const result = await validateInteractionsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        duplicateMode,
      });
      setValidationResult(result);
      setUploadSummary(null);
      setShowPreview(false);
      setSuccess(`Validation finished. ${result.summary.validRows} valid rows and ${result.summary.invalidRows} invalid rows found.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'CSV validation failed.');
    } finally {
      setValidatingCsv(false);
    }
  }

  async function submitCsvImport(allowPartial: boolean) {
    if (!validationResult) return runCsvValidation();
    const confirmMessage = validationResult.summary.invalidRows > 0 && allowPartial
      ? `Some rows contain errors. ${validationResult.summary.invalidRows} rows will be skipped. Continue uploading ${validationResult.summary.validRows} valid rows only?`
      : `Please confirm the field mapping and selected row range. You are about to upload ${validationResult.summary.validRows} valid rows. Continue?`;
    if (!window.confirm(confirmMessage)) return;
    setImporting(true);
    try {
      const summary = await importInteractionsCSV({
        csv: csvText,
        map: mapping,
        startRow,
        endRow: endRow === '' ? undefined : Number(endRow),
        duplicateMode,
        allowPartial,
      });
      setUploadSummary(summary);
      setSuccess(`${summary.importedCount} rows imported, ${summary.updatedCount} updated, ${summary.skippedCount} skipped.`);
      setActiveTab('list');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to import interaction CSV.');
    } finally {
      setImporting(false);
    }
  }

  function downloadInvalidRows() {
    if (!validationResult || validationResult.summary.invalidRows === 0) return;
    const invalidRows = validationResult.rowResults.filter((row) => !row.valid);
    const lines = [['row_number', 'error_fields', 'error_messages', ...csvHeaders].join(',')];
    invalidRows.forEach((row) => {
      const errorFields = row.errors.map((issue) => issue.field).join('; ');
      const errorMessages = row.errors.map((issue) => issue.message).join('; ');
      const values = csvHeaders.map((header) => JSON.stringify(row.original[header] ?? ''));
      lines.push([row.rowNumber, JSON.stringify(errorFields), JSON.stringify(errorMessages), ...values].join(','));
    });
    downloadTextFile('interaction-invalid-rows.csv', lines.join('\n'));
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.lead_id, row.interaction_type, row.channel, row.outcome, row.campaign_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const previewRows = useMemo(() => {
    if (validationResult) return validationResult.rowResults;
    return csvRows.filter((row) => row.rowNumber >= startRow && row.rowNumber <= (endRow === '' ? csvRows.length : Number(endRow))).map((row) => ({ ...row, valid: true, errors: [], warnings: [] }));
  }, [csvRows, endRow, startRow, validationResult]);

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow">
          <ModuleBackButton toSuffix="" />
        </div>

        {shell(
          'Interaction Operations',
          'Review funnel interaction history, add a single interaction manually, or validate and import interaction events from CSV through the shared reusable preview flow.'
        )}

        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-label">Interaction Actions</div>
          <h3 className="m07-workspace-title">Manage interaction records from one screen</h3>
          <div className="m07-workspace-copy">Switch between reviewing logged interactions, adding one event manually, and validating/importing mapped CSV batches.</div>
          <div className="m07-workspace-tabrow">
            {[
              ['list', 'View interactions', 'Search, inspect, archive, and update interaction records'],
              ['manual', 'Add interaction', 'Create one interaction event manually'],
              ['csv', 'CSV import', 'Map, preview, validate, and import batches'],
            ].map(([key, label, desc], idx) => (
              <button key={key} onClick={() => setActiveTab(key as InteractionTab)} className={`m07-workspace-tabbtn ${activeTab === key ? 'active' : ''}`}>
                <span className="m07-workspace-step">{idx + 1}</span>
                <span className="m07-workspace-tabmeta">
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {shouldShowBanner && banner && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: banner.type === 'success' ? '#e9fff3' : '#fff1f1', color: banner.type === 'success' ? '#0a7' : '#a22', border: `1px solid ${banner.type === 'success' ? '#a6e7c3' : '#f3b6b6'}` }}>{banner.message}</div>
        )}

        {activeTab === 'list' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Interaction Table</h3>
            <div className="m07-workspace-toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <input className="m07-workspace-search" placeholder="Search visible rows" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Autocomplete value={filterLeadQuery} placeholder="Filter by lead" fetchItems={async (query) => { const result = await searchLeads(query); return result.leads || []; }} formatItem={formatLeadDisplay} getValue={formatLeadDisplay} onChange={(value, item) => { setFilterLeadQuery(value); setFilterLeadId(item ? String(item.lead_id) : ''); }} />
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                <option value="">All types</option>
                {INTERACTION_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <label className="toggle" style={{ minHeight: 46 }}>
                <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                Include archived
              </label>
              <button className="btn-primary" onClick={() => load()}>Reload</button>
            </div>
            <div className="m07-workspace-sectiongap">
              {loading && <div style={{ fontSize: 12 }}>Loading...</div>}
              {!loading && visibleRows.length === 0 && <div style={{ fontSize: 12 }}>No interaction records found.</div>}
              {!loading && visibleRows.length > 0 && (
                <div className="m07-workspace-tablewrap">
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr style={{ background: '#f5f7fa' }}>
                        <th style={{ padding: 6, textAlign: 'left' }}>Lead ID</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Timestamp</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Type</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Channel</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Campaign</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Outcome</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Score</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const isEditing = editing === row._id;
                        return (
                          <tr key={row._id} style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: 8 }}>{row.lead_id}</td>
                            <td style={{ padding: 8 }}>{row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}</td>
                            <td style={{ padding: 8 }}>{isEditing ? <select value={editState.interaction_type} onChange={(event) => setEditState((prev) => ({ ...prev, interaction_type: event.target.value }))}>{INTERACTION_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select> : row.interaction_type}</td>
                            <td style={{ padding: 8 }}>{isEditing ? <input value={editState.channel} onChange={(event) => setEditState((prev) => ({ ...prev, channel: event.target.value }))} /> : (row.channel || '-')}</td>
                            <td style={{ padding: 8 }}>{row.campaign_id || '-'}</td>
                            <td style={{ padding: 8 }}>{isEditing ? <input value={editState.outcome} onChange={(event) => setEditState((prev) => ({ ...prev, outcome: event.target.value }))} /> : (row.outcome || '-')}</td>
                            <td style={{ padding: 8 }}>{isEditing ? <input value={editState.engagement_score} onChange={(event) => setEditState((prev) => ({ ...prev, engagement_score: event.target.value }))} /> : (row.engagement_score ?? '')}</td>
                            <td style={{ padding: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {!isEditing ? (
                                <>
                                  <button className="btn-ghost" onClick={() => { if (!row._id) return; window.location.hash = workspaceId ? `#/workspace/${workspaceId}/m07/interactions/${row._id}` : `#/m07/interactions/${row._id}`; }}>View</button>
                                  <button className="btn-ghost" onClick={() => startEdit(row)}>Edit</button>
                                  <button className="btn-ghost" onClick={async () => { if (!row._id || !window.confirm('Archive this interaction record?')) return; try { await archiveInteraction(row._id); setSuccess('Archived'); await load(); } catch (error) { setError(error instanceof Error ? error.message : 'Archive failed'); } }}>Archive</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn-primary" onClick={saveEdit}>Save</button>
                                  <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
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

        {activeTab === 'manual' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Manual Add Interaction</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">Use the same schema rules as the CSV flow. Required fields are marked with *.</div>
            {formErrorList.length > 0 && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: '#fff7f7', border: '1px solid rgba(195,51,51,0.18)', color: '#8b1e1e' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Please fix these fields before saving</div>
                <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>{formErrorList.map((message) => <div key={message}>{message}</div>)}</div>
              </div>
            )}
            <div className="m07-workspace-formgrid" style={{ marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Lead *</label>
                <Autocomplete value={leadQuery} placeholder="Lead id / name / email" fetchItems={async (query) => { const result = await searchLeads(query); return result.leads || []; }} formatItem={formatLeadDisplay} getValue={formatLeadDisplay} onChange={(value, item) => { setLeadQuery(value); setFormValue('lead_id', item ? String(item.lead_id) : ''); }} />
                {formErrors.lead_id && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.lead_id}</div>}
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Interaction ID (optional)</label><input value={form.interaction_id} onChange={(event) => setFormValue('interaction_id', event.target.value)} style={{ width: '100%' }} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Timestamp *</label><input type="datetime-local" value={form.timestamp} onChange={(event) => setFormValue('timestamp', event.target.value)} style={{ width: '100%' }} />{formErrors.timestamp && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.timestamp}</div>}</div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Interaction Type *</label><select value={form.interaction_type} onChange={(event) => setFormValue('interaction_type', event.target.value)} style={{ width: '100%' }}>{INTERACTION_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{formErrors.interaction_type && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.interaction_type}</div>}</div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Channel (optional)</label><select value={form.channel} onChange={(event) => setFormValue('channel', event.target.value)} style={{ width: '100%' }}><option value="">Select channel</option>{INTERACTION_CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{formErrors.channel && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.channel}</div>}</div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Campaign (optional)</label>
                <Autocomplete value={campaignQuery} placeholder="Campaign id / name / channel" fetchItems={async (query) => await searchCampaigns(query)} formatItem={formatCampaignDisplay} getValue={formatCampaignDisplay} onChange={(value, item) => { setCampaignQuery(value); setFormValue('campaign_id', item ? String(item.campaign_id || item.id || '') : ''); }} />
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Outcome (optional)</label><select value={form.outcome} onChange={(event) => setFormValue('outcome', event.target.value)} style={{ width: '100%' }}><option value="">Select outcome</option>{INTERACTION_OUTCOME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>{formErrors.outcome && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.outcome}</div>}</div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Engagement Score (optional)</label><input value={form.engagement_score} onChange={(event) => setFormValue('engagement_score', event.target.value)} style={{ width: '100%' }} />{formErrors.engagement_score && <div style={{ color: '#c33', fontSize: 11, marginTop: 4 }}>{formErrors.engagement_score}</div>}</div>
              <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600 }}>Notes (optional)</label><textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} rows={3} style={{ width: '100%' }} /></div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn-primary" type="button" disabled={saving} onClick={submitForm}>{saving ? 'Saving...' : 'Save Interaction'}</button>
            </div>
          </section>
        )}

        {activeTab === 'csv' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>CSV Upload (Interactions)</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">Upload a CSV, review auto-detected mappings, open the shared preview step, validate rows, inspect invalid rows, and confirm before import.</div>
            <div style={{ marginTop: 12 }}>
              <div className="m07-workspace-uploaderow"><input type="file" accept=".csv" onChange={onFileChange} /></div>
              <div className="m07-workspace-inlinehint" style={{ marginTop: 8 }}>Only `.csv` files up to {CSV_UPLOAD_LIMIT_LABEL} are accepted.</div>
              {csvFileName && <div className="m07-workspace-inlinehint" style={{ marginTop: 8 }}>Loaded file: {csvFileName}</div>}
              {csvFileError && <div style={{ marginTop: 8, fontSize: 12, color: '#c33' }}>{csvFileError}</div>}
            </div>
            {csvHeaders.length > 0 && (
              <div className="m07-workspace-sectiongap">
                <div className="m07-workspace-inlinehint">Detected columns: {csvHeaders.join(', ')}</div>
                <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: '#f7fafc', border: '1px solid rgba(15,66,88,0.08)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Map CSV columns to interaction fields</div>
                  <div style={{ fontSize: 13, color: '#35516a', lineHeight: 1.6 }}>Required fields: {INTERACTION_REQUIRED_FIELDS.map((field) => INTERACTION_FIELD_LABELS[field]).join(', ')}.</div>
                </div>
                <div className="m07-workspace-formgrid m07-workspace-mappinggrid">
                  {(Object.keys(mapping) as InteractionFieldKey[]).map((field) => {
                    const usedElsewhere = new Set(Object.entries(mapping).filter(([key, value]) => key !== field && value).map(([, value]) => value));
                    return (
                      <div key={field}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{INTERACTION_FIELD_LABELS[field]}{INTERACTION_REQUIRED_FIELDS.includes(field) ? ' *' : ' (optional)'}</div>
                        <select value={mapping[field]} onChange={(event) => setMappingValue(field, event.target.value)} style={{ width: '100%' }}>
                          <option value="">{INTERACTION_REQUIRED_FIELDS.includes(field) ? 'Select CSV column' : 'Skip this field'}</option>
                          {csvHeaders.filter((header) => !usedElsewhere.has(header) || header === mapping[field]).map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <div><div style={{ fontSize: 12 }}>Start row *</div><input type="number" min={1} value={startRow} onChange={(event) => { setStartRow(Number(event.target.value || 1)); setValidationResult(null); setShowPreview(false); }} /></div>
                  <div><div style={{ fontSize: 12 }}>End row *</div><input type="number" min={1} value={endRow} onChange={(event) => { setEndRow(event.target.value ? Number(event.target.value) : ''); setValidationResult(null); setShowPreview(false); }} /></div>
                  <div><div style={{ fontSize: 12 }}>Duplicate handling</div><select value={duplicateMode} onChange={(event) => { setDuplicateMode(event.target.value as 'skip_duplicates' | 'overwrite_existing'); setValidationResult(null); setShowPreview(false); }}><option value="skip_duplicates">Skip duplicates</option><option value="overwrite_existing">Overwrite existing</option></select></div>
                </div>
                {mappingErrors.length > 0 && (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: '#fff7f7', border: '1px solid rgba(195,51,51,0.18)', color: '#8b1e1e' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Mapping issues</div>
                    <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>{mappingErrors.map((issue) => <div key={issue}>{issue}</div>)}</div>
                  </div>
                )}
                {rangeError && <div className="m07-workspace-inlinehint" style={{ color: '#900' }}>{rangeError}</div>}
                <div className="m07-workspace-actionsrow"><button className="btn-primary" disabled={validatingCsv} onClick={runCsvValidation}>{validatingCsv ? 'Validating...' : 'Validate CSV'}</button></div>
                {validationResult && <div className="m07-workspace-actionsrow"><button className="btn-ghost" onClick={() => setShowPreview((prev) => !prev)}>{showPreview ? 'Hide Preview' : 'Open Preview'}</button></div>}
                {showPreview && previewRows.length > 0 && <div style={{ marginTop: 18 }}><ImportPreviewStep title="Interaction CSV Preview" subtitle="This reusable Module 6 preview step is shared across the M06 and M07 data hub ingestion flows." sourceHeaders={csvHeaders} rows={previewRows} currentStartRow={startRow} totalSelectedRows={previewRows.length} startFullscreen /></div>}
                {validationResult && (
                  <div className="m07-workspace-sectiongap">
                    <div className="m07-workspace-inlinehint">Total rows checked: {validationResult.summary.checkedRows}</div>
                    <div className="m07-workspace-inlinehint">Valid rows: {validationResult.summary.validRows}</div>
                    <div className="m07-workspace-inlinehint">Invalid rows: {validationResult.summary.invalidRows}</div>
                    <div className="m07-workspace-inlinehint">Warning rows: {validationResult.summary.warningRows}</div>
                    <div className="m07-workspace-inlinehint">Selected range: rows {validationResult.selectedRange.startRow} to {validationResult.selectedRange.endRow}</div>
                    <div className="m07-workspace-actionsrow">
                      {validationResult.summary.invalidRows > 0 && <button className="btn-ghost" onClick={downloadInvalidRows}>Download Invalid Rows</button>}
                      {validationResult.summary.validRows > 0 && <button className="btn-primary" disabled={importing} onClick={() => submitCsvImport(validationResult.summary.invalidRows > 0)}>{importing ? 'Importing...' : validationResult.summary.invalidRows > 0 ? 'Proceed With Valid Rows Only' : 'Confirm and Import'}</button>}
                    </div>
                  </div>
                )}
                {uploadSummary && (
                  <div className="m07-workspace-sectiongap">
                    <div className="m07-workspace-inlinehint">Imported: {uploadSummary.importedCount}</div>
                    <div className="m07-workspace-inlinehint">Updated: {uploadSummary.updatedCount}</div>
                    <div className="m07-workspace-inlinehint">Skipped: {uploadSummary.skippedCount}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </Layout>
  );
}
