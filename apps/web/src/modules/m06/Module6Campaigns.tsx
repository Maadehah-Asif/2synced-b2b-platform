import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useWorkspaceId } from '../../utils/workspace';
import './module6.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const ALLOWED_CHANNELS = new Set(['email', 'ads', 'linkedin', 'webinar', 'other']);
const MAX_PREVIEW_ROWS = 200;
const PREVIEW_PAGE_SIZE = 12;

type CampaignTab = 'list' | 'manual' | 'csv';

function Toast({ message, type, onClose }:{ message:string, type:'success'|'error', onClose:()=>void }){
  return (
    <div style={{ position:'fixed', right:16, bottom:16, background:type==='success'?'#0a7':'#c33', color:'#fff', padding:'10px 14px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
      <div>{message}</div>
      <button className="btn-ghost" style={{ marginTop: 6, background:'#fff', color:'#333' }} onClick={onClose}>Close</button>
    </div>
  );
}

export default function Module6Campaigns(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [activeTab, setActiveTab] = useState<CampaignTab>('list');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: '', channel: 'email', startDate: '', endDate: '', description: '', tags: '', spend: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{msg:string, type:'success'|'error'}|null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [headersPreview, setHeadersPreview] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [totalPreviewRows, setTotalPreviewRows] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [blankRowCount, setBlankRowCount] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [mapNameCol, setMapNameCol] = useState('name');
  const [mapChannelCol, setMapChannelCol] = useState('channel');
  const [mapCampaignIdCol, setMapCampaignIdCol] = useState('');
  const [mapStartDateCol, setMapStartDateCol] = useState('start_date');
  const [mapEndDateCol, setMapEndDateCol] = useState('end_date');
  const [mapDescriptionCol, setMapDescriptionCol] = useState('description');
  const [mapSpendCol, setMapSpendCol] = useState('spend');
  const [blockingWarnings, setBlockingWarnings] = useState<string[]>([]);
  const [nonBlockingWarnings, setNonBlockingWarnings] = useState<string[]>([]);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState<number | undefined>(undefined);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  async function fetchCampaigns(){
    if(!workspaceId) return;
    setLoading(true);
    setError(null);
    try{
      const params = new URLSearchParams({
        projectId: workspaceId,
        search,
        channel: channelFilter,
        includeArchived: String(includeArchived),
        archivedOnly: String(archivedOnly),
        createdFrom,
        createdTo,
        startFrom,
        startTo,
      });
      const res = await fetch(`${API_URL}/m06/campaigns?${params.toString()}`);
      const j = await res.json();
      if(!res.ok){
        setError(j && j.error ? j.error : 'Failed to load campaigns');
        setCampaigns([]);
      } else {
        setCampaigns(j.campaigns || []);
      }
    }catch{
      setError('Network error while loading campaigns');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCampaigns(); }, [workspaceId, search, channelFilter, includeArchived, archivedOnly, createdFrom, createdTo, startFrom, startTo]);

  function resetForm(){
    setSelected(null);
    setForm({ name: '', channel: 'email', startDate: '', endDate: '', description: '', tags: '', spend: '' });
    setFormErrors({});
  }

  function openEdit(c:any){
    setSelected(c);
    setForm({
      name: c.name || '',
      channel: c.channel || 'email',
      startDate: c.start_date ? new Date(c.start_date).toISOString().slice(0,10) : '',
      endDate: c.end_date ? new Date(c.end_date).toISOString().slice(0,10) : '',
      description: c.description || '',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
      spend: c.spend || 0
    });
    setFormErrors({});
    setActiveTab('manual');
  }

  async function archive(c:any){
    const ok = window.confirm(`Archive campaign "${c.name}"?`);
    if(!ok) return;
    try{
      const res = await fetch(`${API_URL}/m06/campaigns/${encodeURIComponent(c.id)}/archive`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if(!res.ok) setToast({ msg: j && j.error ? j.error : 'Failed to archive', type: 'error' });
      else {
        setToast({ msg: 'Campaign archived', type: 'success' });
        fetchCampaigns();
      }
    }catch{
      setToast({ msg: 'Network error', type: 'error' });
    }
  }

  async function permanentDelete(c:any){
    const ok = window.prompt(`Type the campaign name to confirm permanent delete:\n${c.name}`);
    if(ok !== c.name) return;
    try{
      const res = await fetch(`${API_URL}/m06/campaigns/${encodeURIComponent(c.id)}/permanent`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if(!res.ok) setToast({ msg: j && j.error ? j.error : 'Failed to delete', type: 'error' });
      else {
        setToast({ msg: 'Campaign deleted permanently', type: 'success' });
        fetchCampaigns();
      }
    }catch{
      setToast({ msg: 'Network error', type: 'error' });
    }
  }

  async function submitForm(){
    if(!workspaceId) return;
    const errs: Record<string, string> = {};
    if(!form.name) errs.name = 'Name is required';
    if(!form.channel) errs.channel = 'Channel is required';
    if(!form.startDate) errs.startDate = 'Start date is required';
    if(form.endDate && form.startDate && new Date(form.endDate) < new Date(form.startDate)) errs.endDate = 'End date cannot be before start date';
    setFormErrors(errs);
    if(Object.keys(errs).length) return;

    const payload: any = {
      projectId: workspaceId,
      name: form.name,
      channel: form.channel,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      description: form.description || undefined,
      tags: form.tags ? form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean) : [],
      spend: form.spend ? Number(form.spend) : 0
    };

    try{
      const url = selected ? `${API_URL}/m06/campaigns/${selected.id}` : `${API_URL}/m06/campaigns`;
      const method = selected ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if(!res.ok){
        setToast({ msg: j && j.error ? j.error : 'Failed to save campaign', type: 'error' });
        return;
      }
      setToast({ msg: selected ? 'Campaign updated' : 'Campaign created successfully', type: 'success' });
      resetForm();
      setActiveTab('list');
      fetchCampaigns();
    }catch{
      setToast({ msg: 'Network error', type: 'error' });
    }
  }

  function resetCsvState(){
    setFile(null);
    setCsvText('');
    setHeadersPreview([]);
    setRowsPreview([]);
    setTotalPreviewRows(0);
    setPreviewPage(0);
    setPreviewLimited(false);
    setBlankRowCount(0);
    setHeaderError(null);
    setSubmitStatus(null);
    setImportSummary(null);
    setMapNameCol('name');
    setMapChannelCol('channel');
    setMapCampaignIdCol('');
    setMapStartDateCol('start_date');
    setMapEndDateCol('end_date');
    setMapDescriptionCol('description');
    setMapSpendCol('spend');
    setStartRow(1);
    setEndRow(undefined);
    setMappingConfirmed(false);
    setForceImport(false);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>){
    const input = e.target;
    const f = input.files && input.files[0];
    resetCsvState();
    if(!f){
      input.value = '';
      return;
    }
    setFile(f);
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
      const cols = headerLine.split(',').map(s => s.trim());
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
      setMapNameCol(prev => pickHeader(prev, ['name','campaign','campaign_name','campaign name'], 0));
      setMapChannelCol(prev => pickHeader(prev, ['channel','utm_medium','source','utm_source']));
      setMapStartDateCol(prev => pickHeader(prev, ['start_date','start date','start','startdate','begin_date']));
      setMapEndDateCol(prev => pickHeader(prev, ['end_date','end date','end','finish_date']));
      setMapDescriptionCol(prev => pickHeader(prev, ['description','campaign description','details','notes']));
      setMapSpendCol(prev => pickHeader(prev, ['spend','amount','cost','budget']));
      setMapCampaignIdCol(prev => pickHeader(prev, ['campaign_id','campaign id','campaignid','id','camp_id','campaign identifier']));

      if(cols.length < 2) setHeaderError('Could not detect valid headers. Ensure first row has column names.');
      else setHeaderError(null);
    };
    reader.readAsText(f);
    input.value = '';
  }

  const headerOptions = useMemo(() => headersPreview.map(h => ({ value: h, label: h })), [headersPreview]);

  useEffect(() => {
    const blocking:string[] = [];
    const nonBlocking:string[] = [];
    if(headersPreview.length){
      const findIdx = (value: string) => {
        if(!value) return -1;
        const exact = headersPreview.indexOf(value);
        if(exact >= 0) return exact;
        const lower = value.toLowerCase();
        return headersPreview.findIndex(h => h.toLowerCase() === lower);
      };
      const nameIdx = findIdx(mapNameCol);
      const channelIdx = findIdx(mapChannelCol);
      if(!mapNameCol) blocking.push('Select a column for campaign name');
      else if(nameIdx === -1) blocking.push(`Column "${mapNameCol}" not found for campaign name`);
      if(!mapChannelCol) blocking.push('Select a column for campaign channel');
      else if(channelIdx === -1) blocking.push(`Column "${mapChannelCol}" not found for campaign channel`);

      if(mapStartDateCol){
        const idx = findIdx(mapStartDateCol);
        if(idx === -1) nonBlocking.push(`Column "${mapStartDateCol}" not found for start date`);
      }
      if(mapEndDateCol){
        const idx = findIdx(mapEndDateCol);
        if(idx === -1) nonBlocking.push(`Column "${mapEndDateCol}" not found for end date`);
      }
      if(mapDescriptionCol && findIdx(mapDescriptionCol) === -1){
        nonBlocking.push(`Column "${mapDescriptionCol}" not found for description`);
      }
      if(mapSpendCol){
        const idx = findIdx(mapSpendCol);
        if(idx === -1) nonBlocking.push(`Column "${mapSpendCol}" not found for spend`);
        else if(rowsPreview.length){
          const badAmts = rowsPreview.filter(r => {
            const v = (r[idx] || '').trim();
            if(!v) return false;
            const numeric = Number(String(v).replace(/[^0-9.-]/g,''));
            return Number.isNaN(numeric);
          }).length;
          if(badAmts) blocking.push(`Spend format issue: ${badAmts}/${rowsPreview.length} values not numeric`);
        }
      }
      if(nameIdx >= 0 && rowsPreview.length){
        const seen = new Set<string>();
        const dups = new Set<string>();
        rowsPreview.forEach(r => {
          const v = (r[nameIdx] || '').trim();
          if(!v) return;
          if(seen.has(v)) dups.add(v); else seen.add(v);
        });
        if(dups.size) nonBlocking.push(`Potential duplicate names: ${Array.from(dups).slice(0,5).join(', ')}${dups.size>5?'...':''}`);
      }
      if(channelIdx >= 0 && rowsPreview.length){
        const unknown = new Set<string>();
        rowsPreview.forEach(r => {
          const v = (r[channelIdx] || '').trim().toLowerCase();
          if(v && !ALLOWED_CHANNELS.has(v)) unknown.add(v);
        });
        if(unknown.size) nonBlocking.push(`Unknown channel values detected: ${Array.from(unknown).slice(0,5).join(', ')}${unknown.size>5?'...':''}`);
      }
    }
    setBlockingWarnings(blocking);
    setNonBlockingWarnings(nonBlocking);
  }, [headersPreview, rowsPreview, mapNameCol, mapChannelCol, mapStartDateCol, mapEndDateCol, mapDescriptionCol, mapSpendCol]);

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

  async function submitCsv(){
    if(!workspaceId) return;
    if(!file || !csvText.trim()){
      setToast({ msg: 'Upload a CSV file first', type: 'error' });
      return;
    }
    if(!mapNameCol || !mapChannelCol){
      setToast({ msg: 'Campaign name and channel mappings are required', type: 'error' });
      return;
    }
    if(!mappingConfirmed){
      setToast({ msg: 'Confirm mappings with the checkbox', type: 'error' });
      return;
    }
    if(blockingWarnings.length && !forceImport){
      setToast({ msg: 'Blocking issues present. Fix or enable force import.', type: 'error' });
      return;
    }

    const resolveHeader = (value: string | null | undefined) => {
      if(!value) return null;
      const match = headersPreview.find(h => h.toLowerCase() === value.toLowerCase());
      return match || null;
    };

    const payload:any = {
      projectId: workspaceId,
      csv: csvText,
      map: {
        campaign_id: resolveHeader(mapCampaignIdCol),
        name: resolveHeader(mapNameCol),
        channel: resolveHeader(mapChannelCol),
        start_date: resolveHeader(mapStartDateCol),
        end_date: resolveHeader(mapEndDateCol),
        description: resolveHeader(mapDescriptionCol),
        spend: resolveHeader(mapSpendCol),
      },
      startRow: Number(startRow || 1),
    };
    if(endRow) payload.endRow = Number(endRow);

    try{
      const res = await fetch(`${API_URL}/m06/campaigns/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if(!res.ok){
        setSubmitStatus(j && j.error ? String(j.error) : 'Import failed');
        setImportSummary(null);
        return;
      }
      setSubmitStatus(`Imported ${j.created || 0} campaigns (${j.skipped || 0} skipped)`);
      setImportSummary({
        created: j.created ?? 0,
        skipped: j.skipped ?? 0,
        selected: j.selected ?? 0,
        errors: Array.isArray(j.errors) ? j.errors : []
      });
      setToast({ msg: `CSV import finished - ${j.created || 0} created`, type: 'success' });
      fetchCampaigns();
      setActiveTab('list');
    }catch{
      setToast({ msg: 'Network error', type: 'error' });
    }
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);

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
                  Review campaign records, add or edit one campaign at a time, and import campaign batches from CSV
                  without leaving the same workspace. This keeps campaign setup and maintenance in one operational screen.
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
                  <div className="value" style={{ fontSize: 22 }}>
                    {activeTab === 'list' ? 'View' : activeTab === 'manual' ? (selected ? 'Edit' : 'Add') : 'CSV import'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="m06-panel soft">
            <div className="m06-section-label">Campaign Actions</div>
            <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Manage campaigns from one screen</h3>
            <div className="m06-helper" style={{ marginBottom: 14 }}>
              Switch between reviewing existing campaigns, creating or updating one record, and importing campaign files
              in bulk. Existing routes still work, but they now land on this unified campaign workspace.
            </div>
            <div className="m06-tab-row">
              <button className={`m06-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <span className="step">1</span>
                <span className="meta">
                  <strong>View campaigns</strong>
                  <span>Search, filter, archive, and edit campaign records</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { if (!selected) resetForm(); setActiveTab('manual'); }}>
                <span className="step">2</span>
                <span className="meta">
                  <strong>{selected ? 'Edit campaign' : 'Add campaign'}</strong>
                  <span>Create or update one campaign with spend and timeline details</span>
                </span>
              </button>
              <button className={`m06-tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>
                <span className="step">3</span>
                <span className="meta">
                  <strong>CSV import</strong>
                  <span>Map headers, preview rows, and import campaign batches</span>
                </span>
              </button>
            </div>
          </section>

          {activeTab === 'list' && (
            <section className="m06-panel">
              <div className="m06-section-label">View</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Campaign Table</h3>
              <div className="m06-helper">
                Filter campaigns by channel, created dates, and campaign start window before editing or archiving a row.
                Archived campaigns can also be isolated for permanent cleanup.
              </div>
              <div className="m06-campaign-filter-grid" style={{ marginTop: 16 }}>
                <div>
                  <label>Search</label>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Campaign name or id" />
                </div>
                <div>
                  <label>Channel</label>
                  <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
                    <option value="">All channels</option>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label>Created from</label>
                  <input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} />
                </div>
                <div>
                  <label>Created to</label>
                  <input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} />
                </div>
                <div>
                  <label>Start from</label>
                  <input type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
                </div>
                <div>
                  <label>Start to</label>
                  <input type="date" value={startTo} onChange={e => setStartTo(e.target.value)} />
                </div>
              </div>

              <div className="m06-toolbar" style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label className="toggle">
                    <input type="checkbox" checked={includeArchived} onChange={e => { setIncludeArchived(e.target.checked); if (!e.target.checked) setArchivedOnly(false); }} />
                    Include archived
                  </label>
                  <label className="toggle" style={{ opacity: includeArchived ? 1 : 0.55 }}>
                    <input type="checkbox" disabled={!includeArchived} checked={archivedOnly} onChange={e => setArchivedOnly(e.target.checked)} />
                    Archived only
                  </label>
                </div>
                <button className="btn-ghost" onClick={() => fetchCampaigns()}>Reload</button>
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
                          <th>Name</th>
                          <th>Channel</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Spend</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(c => (
                          <tr key={c.id} style={{ opacity: c.status === 'archived' ? 0.7 : 1 }}>
                            <td>{c.name}</td>
                            <td>{c.channel || '-'}</td>
                            <td>{c.start_date ? new Date(c.start_date).toISOString().slice(0,10) : '-'}</td>
                            <td>{c.end_date ? new Date(c.end_date).toISOString().slice(0,10) : '-'}</td>
                            <td>${(Number(c.spend) || 0).toLocaleString()}</td>
                            <td>{c.status === 'archived' ? 'Archived' : 'Active'}</td>
                            <td>{c.created_at ? new Date(c.created_at).toISOString().slice(0,10) : '-'}</td>
                            <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn-ghost" onClick={() => openEdit(c)}>Edit</button>
                              {c.status !== 'archived' ? (
                                <button className="btn-ghost" onClick={() => archive(c)}>Archive</button>
                              ) : (
                                <button className="btn-danger" onClick={() => permanentDelete(c)}>Delete Permanently</button>
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
              <div className="m06-section-label">{selected ? 'Edit Campaign' : 'Add Campaign'}</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>{selected ? `Edit ${selected.name}` : 'Campaign Details'}</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Capture the campaign name, channel, active date window, spend, and the short team-facing context needed
                for ROI and attribution analysis later.
              </div>
              <div className="m06-form-grid">
                <div>
                  <label>Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Q1 ABM pilot" />
                  {formErrors.name && <div style={{ color:'#c33', fontSize:12, marginTop:4 }}>{formErrors.name}</div>}
                </div>
                <div>
                  <label>Channel *</label>
                  <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                  {formErrors.channel && <div style={{ color:'#c33', fontSize:12, marginTop:4 }}>{formErrors.channel}</div>}
                </div>
                <div>
                  <label>Start date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  {formErrors.startDate && <div style={{ color:'#c33', fontSize:12, marginTop:4 }}>{formErrors.startDate}</div>}
                </div>
                <div>
                  <label>End date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  {formErrors.endDate && <div style={{ color:'#c33', fontSize:12, marginTop:4 }}>{formErrors.endDate}</div>}
                </div>
                <div>
                  <label>Total spend</label>
                  <input value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} placeholder="25000" />
                </div>
                <div>
                  <label>Tags</label>
                  <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="brand, paid-social" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width:'100%' }} />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={submitForm}>{selected ? 'Save Changes' : 'Create Campaign'}</button>
                <button className="btn-ghost" onClick={() => resetForm()}>Clear</button>
              </div>
            </section>
          )}

          {activeTab === 'csv' && (
            <section className="m06-panel">
              <div className="m06-section-label">CSV Import</div>
              <h3 className="m06-panel-title" style={{ marginTop: 14 }}>Import Campaign CSV</h3>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Upload campaign records, confirm the detected headers, and map the fields used by campaign reporting.
                The import preview helps you verify names, channels, and spend before submitting the batch.
              </div>

              <div className="m06-file-drop">
                <div className="m06-inline-note" style={{ marginBottom: 10 }}>
                  Select a CSV file with campaign headers in the first row. Preview is limited to the first {MAX_PREVIEW_ROWS} rows.
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
                            {headersPreview.map((h, idx) => <th key={idx}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {previewPageRows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {headersPreview.map((_, cIdx) => <td key={cIdx}>{row[cIdx] ?? ''}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {rowsPreview.length > PREVIEW_PAGE_SIZE && (
                    <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div className="m06-inline-note">Page {currentPreviewPage + 1} of {previewPageCount}</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn-ghost" disabled={currentPreviewPage === 0} onClick={() => setPreviewPage(p => Math.max(0, p - 1))}>Prev</button>
                        <button className="btn-ghost" disabled={currentPreviewPage >= previewPageCount - 1} onClick={() => setPreviewPage(p => Math.min(previewPageCount - 1, p + 1))}>Next</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="m06-mapping-grid">
                <div>
                  <label>Campaign name header *</label>
                  <input list="campaign-upload-headers" value={mapNameCol} onChange={e => setMapNameCol(e.target.value)} placeholder="Column name" />
                </div>
                <div>
                  <label>Channel header *</label>
                  <input list="campaign-upload-headers" value={mapChannelCol} onChange={e => setMapChannelCol(e.target.value)} placeholder="Column name" />
                </div>
                <div>
                  <label>Campaign ID header</label>
                  <input list="campaign-upload-headers" value={mapCampaignIdCol} onChange={e => setMapCampaignIdCol(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Start date header</label>
                  <input list="campaign-upload-headers" value={mapStartDateCol} onChange={e => setMapStartDateCol(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>End date header</label>
                  <input list="campaign-upload-headers" value={mapEndDateCol} onChange={e => setMapEndDateCol(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Description header</label>
                  <input list="campaign-upload-headers" value={mapDescriptionCol} onChange={e => setMapDescriptionCol(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Spend header</label>
                  <input list="campaign-upload-headers" value={mapSpendCol} onChange={e => setMapSpendCol(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label>Start row</label>
                  <input type="number" min={1} value={String(startRow)} onChange={e => setStartRow(Number(e.target.value || 1))} />
                </div>
                <div>
                  <label>End row</label>
                  <input type="number" min={1} placeholder="auto" value={endRow !== undefined ? String(endRow) : ''} onChange={e => setEndRow(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <datalist id="campaign-upload-headers">
                {headerOptions.map(opt => <option key={opt.value} value={opt.value} />)}
              </datalist>

              {(blockingWarnings.length || nonBlockingWarnings.length) && (
                <div className="m06-summary-box">
                  <div style={{ fontWeight:600, marginBottom:4 }}>Import diagnostics</div>
                  {blockingWarnings.map((w,i) => <div key={`b${i}`}>{w} (blocking)</div>)}
                  {nonBlockingWarnings.map((w,i) => <div key={`n${i}`}>{w}</div>)}
                </div>
              )}

              <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 12 }}>
                <input type="checkbox" checked={mappingConfirmed} onChange={e => setMappingConfirmed(e.target.checked)} />
                <span className="m06-inline-note">I have reviewed my mappings and confirm they are correct.</span>
              </label>
              {blockingWarnings.length > 0 && (
                <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6 }}>
                  <input type="checkbox" checked={forceImport} onChange={e => setForceImport(e.target.checked)} />
                  <span className="m06-inline-note">Force import despite blocking issues.</span>
                </label>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={submitCsv}>Import CSV</button>
                <button className="btn-ghost" onClick={resetCsvState}>Reset</button>
              </div>

              {submitStatus && <div style={{ marginTop: 10, fontSize: 13 }}>{submitStatus}</div>}
              {importSummary && (
                <div className="m06-summary-box">
                  <div style={{ fontWeight:600, marginBottom:4 }}>Import Summary</div>
                  <div>Selected rows: {importSummary.selected}</div>
                  <div>Created: {importSummary.created}</div>
                  <div>Skipped: {importSummary.skipped}</div>
                  <div>Errors: {importSummary.errors ? importSummary.errors.length : 0}</div>
                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ marginBottom:6 }}>
                        {importSummary.errors.slice(0,3).map((err:any, idx:number)=>(
                          <div key={idx}>Row {err.row}: {String(err.reason || '')}</div>
                        ))}
                        {importSummary.errors.length > 3 && <div>...and {importSummary.errors.length - 3} more</div>}
                      </div>
                      <button className="btn-ghost" disabled={downloadingErrors} onClick={() => {
                        if(!importSummary.errors || !importSummary.errors.length) return;
                        try{
                          setDownloadingErrors(true);
                          const lines = ['row,reason'].concat(importSummary.errors.map((fr:any) => `${fr.row},"${String(fr.reason || '').replace(/"/g,'""')}"`));
                          const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'campaign_import_errors.csv';
                          a.click();
                          setTimeout(() => { URL.revokeObjectURL(url); setDownloadingErrors(false); }, 1000);
                        }catch{
                          setDownloadingErrors(false);
                          setToast({ msg:'Failed to download error CSV', type:'error' });
                        }
                      }}>Download error CSV</button>
                    </div>
                  )}
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
