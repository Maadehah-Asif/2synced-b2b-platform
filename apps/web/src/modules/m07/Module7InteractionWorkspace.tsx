import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import './module7.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type PreviewState = { columns: string[]; rows: any[] } | null;

function shell(title: string, subtitle: string) {
  return (
    <section
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid rgba(15,66,88,0.08)',
        boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
        background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
        color: '#fff',
      }}
    >
      <div style={{ padding: 28 }}>
        <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          M07 Interaction Workspace
        </div>
        <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>{title}</h1>
        <div style={{ maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>{subtitle}</div>
      </div>
    </section>
  );
}

export default function Module7InteractionWorkspace() {
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [activeTab, setActiveTab] = useState<'list' | 'manual' | 'csv'>('list');
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [mapping, setMapping] = useState({ lead_id: '', timestamp: '', interaction_type: '' });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchList();
  }, [workspace, search]);

  function getAuthHeaders(extra: Record<string, string> = {}) {
    try {
      const token = localStorage.getItem('token');
      return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
    } catch {
      return extra;
    }
  }

  async function fetchList() {
    if (!workspace) return setMessage('workspace required');
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ workspace_id: workspace });
      const res = await fetch(`${API_URL}/m07/interactions?${params.toString()}`);
      const j = await res.json();
      const rows = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      const filtered = search
        ? rows.filter((it: any) =>
            [it.lead_id, it.interaction_type, it.channel, it.outcome]
              .map((v) => String(v || '').toLowerCase())
              .some((v) => v.includes(search.toLowerCase()))
          )
        : rows;
      setItems(filtered);
    } catch {
      setMessage('network error');
    }
    setLoading(false);
  }

  async function archive(id: string) {
    try {
      const res = await fetch(`${API_URL}/m07/interactions/${id}/archive`, { method: 'POST' });
      const j = await res.json();
      if (j?.ok) setItems((s) => s.filter((x) => x._id !== id));
      else setMessage(j?.error || 'failed');
    } catch {
      setMessage('network error');
    }
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return setMessage('workspace required');
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form) as any);
    try {
      const res = await fetch(`${API_URL}/m07/interactions`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ workspace_id: workspace, ...data }),
      });
      let j: any = null;
      try {
        j = await res.json();
      } catch (err) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      if (res.ok && !j?.error) {
        setMessage('Interaction saved');
        form.reset();
        setActiveTab('list');
        fetchList();
      } else setMessage(j?.error || `save failed: HTTP ${res.status}`);
    } catch (e) {
      setMessage('network error: ' + String((e as any).message || e));
    }
  }

  async function uploadPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return setMessage('workspace required');
    if (!file) return setMessage('choose a CSV file');
    setMessage('Uploading for preview...');
    const fd = new FormData();
    fd.append('file', file, file.name);
    try {
      const res = await fetch(`${API_URL}/m07/interactions/upload/preview`, { method: 'POST', body: fd, headers: getAuthHeaders() });
      let j: any = null;
      try {
        j = await res.json();
      } catch (err) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      if (res.ok) {
        setPreview({ columns: j.columns || [], rows: j.previewRows || [] });
        setMessage(null);
      } else setMessage(j?.error || `preview failed: HTTP ${res.status}`);
    } catch (e) {
      setMessage('network error: ' + String((e as any).message || e));
    }
  }

  async function commitUpload() {
    if (!workspace) return setMessage('workspace required');
    if (!file) return setMessage('no file');
    setMessage('Committing upload...');
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('workspace_id', workspace);
    try {
      const res = await fetch(`${API_URL}/m07/interactions/upload/commit`, { method: 'POST', body: fd, headers: getAuthHeaders() });
      let j: any = null;
      try {
        j = await res.json();
      } catch (err) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      if (res.ok) {
        setMessage(`Import results: ${JSON.stringify(j.results || j)}`);
        setPreview(null);
        setFile(null);
        setActiveTab('list');
        fetchList();
      } else setMessage(j?.error || `commit failed: HTTP ${res.status}`);
    } catch (e) {
      setMessage('network error: ' + String((e as any).message || e));
    }
  }

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow">
          <ModuleBackButton toSuffix="" />
        </div>

        {shell(
          'Interaction Operations',
          'Review funnel interaction history, add a single touchpoint manually, or import interaction events from CSV without switching between separate M07 screens.'
        )}

        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-label">Interaction Actions</div>
          <h3 className="m07-workspace-title">Manage interaction records from one screen</h3>
          <div className="m07-workspace-copy">
            Switch between reviewing logged interactions, adding one event manually, and previewing interaction imports before committing them.
          </div>
          <div className="m07-workspace-tabrow">
            {[
              ['list', 'View interactions', 'Search, inspect, archive, and open interaction records'],
              ['manual', 'Add interaction', 'Create one interaction event manually'],
              ['csv', 'CSV import', 'Preview uploaded interaction rows before import'],
            ].map(([key, label, desc], idx) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as 'list' | 'manual' | 'csv')}
                className={`m07-workspace-tabbtn ${activeTab === key ? 'active' : ''}`}
              >
                <span className="m07-workspace-step">{idx + 1}</span>
                <span className="m07-workspace-tabmeta">
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'list' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Interaction Table</h3>
            <div className="m07-workspace-toolbar">
              <input
                className="m07-workspace-search"
                placeholder="Search by lead, type, channel, or outcome"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn-primary" onClick={fetchList}>Reload</button>
              <button className="btn-ghost" onClick={() => { setSearch(''); fetchList(); }}>Reset</button>
            </div>
            <div className="m07-workspace-sectiongap">
              {loading && <div style={{ fontSize: 12 }}>Loading...</div>}
              {message && <div className="muted">{message}</div>}
              {!loading && items.length === 0 && <div style={{ fontSize: 12 }}>No interaction records found.</div>}
              {!loading && items.length > 0 && (
                <div className="m07-workspace-tablewrap">
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr style={{ background: '#f5f7fa' }}>
                        <th style={{ padding: 6, textAlign: 'left' }}>Lead ID</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Timestamp</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Type</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Channel</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Outcome</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Score</th>
                        <th style={{ padding: 6, textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it._id} style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: 8 }}>{it.lead_id}</td>
                          <td style={{ padding: 8 }}>{it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}</td>
                          <td style={{ padding: 8 }}>{it.interaction_type}</td>
                          <td style={{ padding: 8 }}>{it.channel || ''}</td>
                          <td style={{ padding: 8 }}>{it.outcome || ''}</td>
                          <td style={{ padding: 8 }}>{it.engagement_score ?? ''}</td>
                          <td style={{ padding: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn-ghost" onClick={() => { if (workspace) window.location.hash = `#/workspace/${workspace}/m07/interactions/${it._id}`; else window.location.hash = `#/m07/interactions/${it._id}`; }}>View</button>
                            <button className="btn-ghost" onClick={() => archive(it._id)}>Archive</button>
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
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Manual Add Interaction</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">
              Add a single interaction event with the core funnel fields M07 needs for timeline and engagement analysis.
            </div>
            <form onSubmit={saveManual} style={{ marginTop: 14 }}>
              <div className="m07-workspace-formgrid">
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Lead ID *</label><input name="lead_id" placeholder="lead id" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Timestamp *</label><input name="timestamp" placeholder="YYYY-MM-DD hh:mm:ss" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Interaction Type *</label><input name="interaction_type" placeholder="email, call, meeting" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Channel</label><input name="channel" placeholder="email, web, phone" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Campaign ID</label><input name="campaign_id" placeholder="optional campaign id" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Outcome</label><input name="outcome" placeholder="clicked, replied, converted" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Engagement Score</label><input name="engagement_score" placeholder="numeric" style={{ width: '100%' }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Meta (JSON)</label><input name="meta" placeholder='{"source":"email"}' style={{ width: '100%' }} /></div>
              </div>
              <div className="m07-workspace-actionsrow">
                <button className="btn-primary" type="submit">Save Interaction</button>
                <button className="btn-ghost" type="button" onClick={() => setMessage(null)}>Reset</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'csv' && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>CSV Upload (Interactions)</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">
              Upload interaction events in bulk. Preview the headers first so you can verify the core fields expected by the interaction import flow.
            </div>
            <form onSubmit={uploadPreview} style={{ marginTop: 12 }}>
              <div className="m07-workspace-uploaderow">
                <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
              </div>
              <div className="m07-workspace-actionsrow">
                <button className="btn-primary" type="submit">Preview CSV</button>
                <button className="btn-ghost" type="button" onClick={() => { setFile(null); setPreview(null); }}>Clear</button>
              </div>
            </form>

            {preview && (
              <div className="m07-workspace-sectiongap">
                <div className="m07-workspace-inlinehint">Detected columns: {preview.columns.join(', ')}</div>
                <div className="m07-workspace-formgrid m07-workspace-mappinggrid">
                  <div><div style={{ fontSize: 12 }}>Lead ID column</div><input list="interaction-upload-headers" value={mapping.lead_id} onChange={(e) => setMapping((m) => ({ ...m, lead_id: e.target.value }))} placeholder="Column name" /></div>
                  <div><div style={{ fontSize: 12 }}>Timestamp column</div><input list="interaction-upload-headers" value={mapping.timestamp} onChange={(e) => setMapping((m) => ({ ...m, timestamp: e.target.value }))} placeholder="Column name" /></div>
                  <div><div style={{ fontSize: 12 }}>Interaction type column</div><input list="interaction-upload-headers" value={mapping.interaction_type} onChange={(e) => setMapping((m) => ({ ...m, interaction_type: e.target.value }))} placeholder="Column name" /></div>
                </div>
                <datalist id="interaction-upload-headers">
                  {preview.columns.map((c) => (<option key={c} value={c} />))}
                </datalist>

                <div className="m07-workspace-inlinehint" style={{ marginTop: 12 }}>
                  Mapping stays visible here for review, but import behavior remains the same as the existing interaction CSV flow.
                </div>
                <div className="m07-workspace-tablewrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fb' }}>
                        {preview.columns.map((c, idx) => <th key={idx} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12 }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                          {preview.columns.map((c, j) => <td key={j} style={{ padding: 8, borderBottom: '1px solid #edf2f7', fontSize: 12 }}>{r[c] ?? r[j] ?? ''}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="m07-workspace-actionsrow">
                  <button className="btn-primary" type="button" onClick={commitUpload}>Import CSV File</button>
                  <button className="btn-ghost" type="button" onClick={() => { setPreview(null); setFile(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        {message && <div className="muted" style={{ marginTop: 12 }}>{message}</div>}
      </main>
    </Layout>
  );
}
