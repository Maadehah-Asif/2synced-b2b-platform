import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type PrioritizationRow = {
  leadId: string;
  fullName?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  intentScore?: number;
  intentSegment?: string;
  engagementScoreRecent?: number;
  salesPressureIndex?: number;
  isUrgentEscalation?: boolean;
  accountActivityIndex?: number;
  daysSinceLastAction?: number;
  lastEventType?: string | null;
  lastEventDate?: string | null;
  eventsLast30d?: number;
  spikeCount?: number;
  dropCount?: number;
  topDriverSummary?: string;
};

export default function Prioritization() {
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [rows, setRows] = useState<PrioritizationRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [segment, setSegment] = useState('ALL');
  const [intentRange, setIntentRange] = useState<[number, number]>([0, 100]);
  const [activeLead, setActiveLead] = useState<PrioritizationRow | null>(null);
  const [timeline, setTimeline] = useState<any | null>(null);
  const [uploadOpen, setUploadOpen] = useState<'leads' | 'behaviors' | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [workspace, page, segment, intentRange]);

  async function fetchData() {
    if (!workspace) {
      setMessage('Workspace required');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        workspaceId: workspace,
        segment,
        minIntent: String(intentRange[0]),
        maxIntent: String(intentRange[1]),
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`${API_URL}/m02/prioritization?${params.toString()}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setMessage(j?.error || 'failed to load');
        setRows([]);
        setTotal(0);
      } else {
        setRows(j.rows || []);
        setTotal(j.total || 0);
      }
    } catch (e) {
      setMessage('network error');
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  }

  async function openTimeline(row: PrioritizationRow) {
    if (!workspace) return;
    setActiveLead(row);
    setTimeline({ loading: true });
    try {
      const params = new URLSearchParams({ workspaceId: workspace, leadId: row.leadId });
      const res = await fetch(`${API_URL}/m02/behaviors/timeline?${params.toString()}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setTimeline({ error: j?.error || 'failed to load' });
      } else setTimeline(j);
    } catch (e) {
      setTimeline({ error: 'network error' });
    }
  }

  async function doUpload(kind: 'leads' | 'behaviors', file: File) {
    if (!workspace) {
      setMessage('Workspace required');
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('workspaceId', workspace);
    const url = kind === 'leads' ? `${API_URL}/m02/upload/leads-intent` : `${API_URL}/m02/upload/behaviors`;
    try {
      const res = await fetch(url, { method: 'POST', body: form });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setMessage(j?.error || 'upload failed');
      } else {
        setMessage(`Imported ${j.importedCount || 0}, skipped ${j.skippedCount || 0}`);
        fetchData();
      }
    } catch (e) {
      setMessage('upload failed');
    }
    setUploading(false);
    setUploadOpen(null);
  }

  const segmentOptions = ['ALL', 'BLAZING', 'HOT', 'WARM', 'COLD'];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />
          <div>
            <h2 style={{ margin: 0 }}>Intent Prioritization Dashboard</h2>
            <div style={{ color: '#4b5563', fontSize: 13 }}>Rank leads by intent, engagement, and recent behavior.</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost btn-sm" onClick={() => setUploadOpen('leads')}>
              Upload Leads + Intent CSV
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setUploadOpen('behaviors')}>
              Upload Behavior CSV
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                const wid = getWorkspaceIdFromHash();
                if (wid) window.location.hash = `#/workspace/${wid}/m02/upload-wizard`;
                else window.location.hash = '#/workspaces';
              }}
            >
              Open Upload Wizard
            </button>
          </div>
        </div>

        <div className="card mt-12" style={{ padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12 }}>Intent segment</div>
              <select
                value={segment}
                onChange={(e) => {
                  setSegment(e.target.value);
                  setPage(1);
                }}
              >
                {segmentOptions.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All segments' : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Intent score {intentRange[0]}–{intentRange[1]}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={intentRange[0]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setIntentRange([v, intentRange[1]]);
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={intentRange[1]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setIntentRange([intentRange[0], v]);
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Page</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <span style={{ fontSize: 12 }}>
                  Page {page} / {totalPages}
                </span>
                <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {message && <div className="mt-8 muted">{message}</div>}

        <div className="mt-12">
          {loading && <div>Loading...</div>}
          {!loading && rows.length === 0 && <div className="muted">No leads found. Upload CSVs to get started.</div>}
          {!loading && rows.length > 0 && (
            <table className="table mt-4">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Company</th>
                  <th>Intent</th>
                  <th>Prediction</th>
                  <th>Engagement</th>
                  <th>Risk/Pressure</th>
                  <th>Drivers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.leadId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.fullName || r.leadId}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>{r.jobTitle || ''}</div>
                    </td>
                    <td>
                      <div>{r.company || '-'}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>{r.location || ''}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.intentScore?.toFixed?.(1) ?? '-'}</div>
                      <div style={{ fontSize: 12 }}>{r.intentSegment || '-'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{(r as any).predictedLabel || '-'}</div>
                      <div style={{ fontSize: 12 }}>Conf: {((r as any).confidence ?? '-') as any}</div>
                    </td>
                    <td>
                      <div>Eng recent: {r.engagementScoreRecent ?? '-'}</div>
                      <div style={{ fontSize: 12 }}>Events 30d: {r.eventsLast30d ?? 0}</div>
                      <div style={{ fontSize: 12 }}>
                        Last: {r.lastEventType || '-'} {r.lastEventDate ? new Date(r.lastEventDate).toLocaleDateString() : ''}
                      </div>
                    </td>
                    <td>
                      <div>Pressure: {r.salesPressureIndex ?? '-'}</div>
                      <div style={{ fontSize: 12 }}>Urgent: {r.isUrgentEscalation ? 'Yes' : 'No'}</div>
                      <div style={{ fontSize: 12 }}>Activity idx: {r.accountActivityIndex ?? '-'}</div>
                    </td>
                    <td style={{ maxWidth: 240 }}>{r.topDriverSummary || '-'}</td>
                    <td>
                      <button className="btn-ghost btn-sm" onClick={() => openTimeline(r)}>
                        View timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {timeline && activeLead && (
          <div className="modal-overlay" onClick={() => { setActiveLead(null); setTimeline(null); }}>
            <div className="modal-content" style={{ maxWidth: 900, width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{activeLead.fullName || activeLead.leadId}</h3>
              <div style={{ fontSize: 12, color: '#555' }}>
                {activeLead.jobTitle} {activeLead.company ? ` @ ${activeLead.company}` : ''}
              </div>
              {timeline?.error && <div style={{ color: '#c33', marginTop: 8 }}>{timeline.error}</div>}
              {timeline?.loading && <div>Loading...</div>}
              {!timeline?.error && timeline?.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                  <div className="box">
                    Total events
                    <br />
                    <strong>{timeline.summary.totalEvents}</strong>
                  </div>
                  <div className="box">
                    Events last 30d
                    <br />
                    <strong>{timeline.summary.eventsLast30d}</strong>
                  </div>
                  <div className="box">
                    Avg engagement
                    <br />
                    <strong>{timeline.summary.avgEngagement?.toFixed?.(2)}</strong>
                  </div>
                  <div className="box">
                    Spikes / Drops
                    <br />
                    <strong>
                      {timeline.summary.spikeCount} / {timeline.summary.dropCount}
                    </strong>
                  </div>
                </div>
              )}
              {timeline?.series && (
                <div style={{ marginTop: 12 }}>
                  <h4>Event types</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {timeline.series.byEventType?.map((t: any) => (
                      <div key={t.eventType} style={{ padding: '6px 10px', background: '#f3f4f6', borderRadius: 6, fontSize: 12 }}>
                        {t.eventType}: {t.count}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {timeline?.events && timeline.events.length > 0 ? (
                <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: 6 }}>Timestamp</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Event</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Engagement</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.events.map((ev: any, idx: number) => (
                        <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: 6 }}>{new Date(ev.timestamp).toLocaleString()}</td>
                          <td style={{ padding: 6 }}>{ev.eventType}</td>
                          <td style={{ padding: 6 }}>{ev.engagementScore ?? '-'}</td>
                          <td style={{ padding: 6 }}>
                            {ev.spikeFlag ? 'Spike ' : ''}
                            {ev.dropFlag ? 'Drop' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 12 }}>No behavior events uploaded for this lead yet.</div>
              )}
              {timeline?.behaviorNarrative && <div style={{ marginTop: 12, fontSize: 13, color: '#111827' }}>{timeline.behaviorNarrative}</div>}
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button className="btn-ghost" onClick={() => { setActiveLead(null); setTimeline(null); }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadOpen && (
          <div className="modal-overlay" onClick={() => setUploadOpen(null)}>
            <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{uploadOpen === 'leads' ? 'Upload Leads + Intent CSV' : 'Upload Behavior CSV'}</h3>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
                {uploadOpen === 'leads'
                  ? 'Required columns: lead_id, intent_score, intent_segment. Additional columns stored as raw.'
                  : 'Required columns: lead_id, timestamp, event_type. timestamp must be YYYY-MM-DD HH:MM:SS.'}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doUpload(uploadOpen, f);
                }}
                disabled={uploading}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => setUploadOpen(null)} disabled={uploading}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
