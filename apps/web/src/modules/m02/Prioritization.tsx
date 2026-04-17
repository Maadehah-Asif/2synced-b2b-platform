import { useEffect, useState, useRef } from 'react';
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
  const [uploadToast, setUploadToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const leadsRef = useRef<HTMLInputElement | null>(null);
  const behaviorsRef = useRef<HTMLInputElement | null>(null);

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
  const [timelineFilters, setTimelineFilters] = useState<{ range: '30' | '60' | '90' | 'all'; types: string[] }>({ range: '30', types: [] });

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
    } catch {
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
      const now = new Date();
      const start = new Date(now.getTime() - (timelineFilters.range === 'all' ? 3650 : Number(timelineFilters.range)) * 86400000);
      const params = new URLSearchParams({ workspaceId: workspace });
      params.set('startDate', start.toISOString());
      params.set('endDate', now.toISOString());
      if (timelineFilters.types.length) params.set('eventTypes', timelineFilters.types.join(','));
      const res = await fetch(`${API_URL}/m02/leads/${encodeURIComponent(row.leadId)}/behavior-timeline?${params.toString()}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) setTimeline({ error: j?.error || 'failed to load' });
      else setTimeline(j);
    } catch {
      setTimeline({ error: 'network error' });
    }
  }

  const segmentOptions = ['ALL', 'BLAZING', 'HOT', 'WARM', 'COLD'];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Layout>
      <div className="p-20">

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />

          <div>
            <h2 style={{ margin: 0 }}>Intent Prioritization Dashboard</h2>
            <div style={{ color: '#4b5563', fontSize: 13 }}>
              Rank leads by intent, engagement, and recent behavior.
            </div>
          </div>

          {/* RIGHT BUTTONS */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn-primary" onClick={() => {
              const wid = getWorkspaceIdFromHash();
              if (wid) window.location.hash = `#/workspace/${wid}/m02/upload-wizard`;
              else window.location.hash = '#/workspaces';
            }}>
              Open Upload Wizard
            </button>

            <button type="button" className="btn-primary" onClick={() => leadsRef.current?.click()}>
              Quick upload leads
            </button>

            <button type="button" className="btn-primary" onClick={() => behaviorsRef.current?.click()}>
              Quick upload behaviors
            </button>
          </div>

          {/* HIDDEN INPUTS */}
          <input ref={leadsRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploadToast(null);
              try {
                const form = new FormData();
                form.append('file', f);
                form.append('workspaceId', workspace || '');
                const res = await fetch(`${API_URL}/m02/upload/leads-intent`, { method: 'POST', body: form });
                const j = await res.json();
                if (!res.ok || !j?.ok)
                  setUploadToast({ msg: j?.error || 'Upload failed', type: 'error' });
                else {
                  setUploadToast({ msg: `Imported ${j.importedCount || 0}`, type: 'success' });
                  fetchData();
                }
              } catch (err: any) {
                setUploadToast({ msg: err?.message || 'Upload failed', type: 'error' });
              }
              e.target.value = '';
            }}
          />

          <input ref={behaviorsRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploadToast(null);
              try {
                const form = new FormData();
                form.append('file', f);
                form.append('workspaceId', workspace || '');
                const res = await fetch(`${API_URL}/m02/upload/behaviors`, { method: 'POST', body: form });
                const j = await res.json();
                if (!res.ok || !j?.ok)
                  setUploadToast({ msg: j?.error || 'Upload failed', type: 'error' });
                else {
                  setUploadToast({ msg: `Imported ${j.importedCount || 0}`, type: 'success' });
                  fetchData();
                }
              } catch (err: any) {
                setUploadToast({ msg: err?.message || 'Upload failed', type: 'error' });
              }
              e.target.value = '';
            }}
          />
        </div>

        {/* TOAST */}
        {uploadToast && (
          <div style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            background: uploadToast.type === 'success' ? '#0a7' : '#c33',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8
          }}>
            <div>{uploadToast.msg}</div>
            <button type="button" className="btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => setUploadToast(null)}>
              Close
            </button>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="card mt-12" style={{ padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12 }}>Intent segment</div>
              <select
                value={segment}
                onChange={(e) => { setSegment(e.target.value); setPage(1); }}
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
              <input type="range" min={0} max={100}
                value={intentRange[0]}
                onChange={(e) => setIntentRange([Number(e.target.value), intentRange[1]])}
              />
              <input type="range" min={0} max={100}
                value={intentRange[1]}
                onChange={(e) => setIntentRange([intentRange[0], Number(e.target.value)])}
              />
            </div>

            <div>
              <div style={{ fontSize: 12 }}>Page</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Prev
                </button>

                <span style={{ fontSize: 12 }}>Page {page} / {totalPages}</span>

                <button type="button" className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE */}
        {message && <div className="mt-8 muted">{message}</div>}

        <div className="mt-12">
          {loading && <div>Loading...</div>}

          {!loading && rows.length === 0 && (
            <div className="muted">No leads found. Upload CSVs to get started.</div>
          )}

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
                {rows.map(r => (
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
                      <button type="button" className="btn-primary btn-sm" onClick={() => openTimeline(r)}>
                        View timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          )}
        </div>

        {/* TIMELINE MODAL */}
        {timeline && activeLead && (
          <div className="modal-overlay" onClick={() => { setActiveLead(null); setTimeline(null); }}>
            <div className="modal-content" style={{ maxWidth: 900, width: '90%' }} onClick={(e) => e.stopPropagation()}>

              <h3 style={{ marginTop: 0 }}>
                {timeline?.lead
                  ? `${timeline.lead.first_name || ''} ${timeline.lead.last_name || ''}`.trim() || timeline.lead.lead_id
                  : (activeLead.fullName || activeLead.leadId)}
              </h3>

              <div style={{ fontSize: 12, color: '#555' }}>
                {timeline?.lead?.title || activeLead.jobTitle || ''}{" "}
                {timeline?.lead?.company || activeLead.company ? ` @ ${timeline?.lead?.company || activeLead.company}` : ''}
              </div>

              <div style={{ marginTop: 6, fontSize: 12 }}>
                Intent: <strong>{timeline?.lead?.intent_score ?? activeLead.intentScore ?? '-'}</strong>{" "}
                <span className="badge" style={{ marginLeft: 6 }}>
                  {timeline?.lead?.intent_segment || activeLead.intentSegment || '-'}
                </span>
              </div>

              {/* FILTER BAR INSIDE MODAL */}
              <div className="card" style={{ padding: 10, marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12 }}>Date range</div>
                  <select
                    value={timelineFilters.range}
                    onChange={(e) => setTimelineFilters((f) => ({ ...f, range: e.target.value as any }))}
                  >
                    <option value="30">Last 30 days</option>
                    <option value="60">Last 60 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12 }}>Event types</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['email_open', 'email_click', 'reply', 'website_visit', 'linkedin_view', 'call', 'demo_request']
                      .map(t => (
                        <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={timelineFilters.types.includes(t)}
                            onChange={(e) =>
                              setTimelineFilters((f) => ({
                                ...f,
                                types: e.target.checked
                                  ? [...f.types, t]
                                  : f.types.filter(x => x !== t),
                              }))
                            }
                          />
                          {prettyEventType(t)}
                        </label>
                      ))}
                  </div>
                </div>

                <div style={{ marginLeft: 'auto' }}>
                  <button type="button" className="btn-primary btn-sm" onClick={() => activeLead && openTimeline(activeLead)}>
                    Apply filters
                  </button>
                </div>
              </div>

              {/* TIMELINE DOT ROW */}
              {timeline?.events && timeline.events.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {timeline.events.map((ev: any, idx: number) => (
                      <div
                        key={idx}
                        title={`${new Date(ev.timestamp).toLocaleString()}\n${prettyEventType(ev.event_type)}\nEng: ${
                          ev.engagement_score
                        } Vel: ${ev.velocity}${ev.spike_flag ? '\nSpike' : ''}${ev.drop_flag ? '\nDrop' : ''}`}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: eventColor(ev.event_type),
                          opacity: Math.max(0.4, Math.min(1, Number(ev.engagement_score || 0))),
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {['email_open', 'email_click', 'reply', 'website_visit', 'linkedin_view', 'call', 'demo_request']
                      .map(t => (
                        <div key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: eventColor(t) }}></span>
                          {prettyEventType(t)}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {timeline?.error && <div style={{ color: '#c33', marginTop: 8 }}>{timeline.error}</div>}
              {timeline?.loading && <div>Loading...</div>}

              {timeline?.summary && !timeline?.error && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginTop: 12
                }}>
                  <div className="box">Total events<br /><strong>{timeline.summary.totalEvents}</strong></div>
                  <div className="box">Events last 30d<br /><strong>{timeline.summary.eventsLast30d}</strong></div>
                  <div className="box">Avg engagement<br /><strong>{timeline.summary.avgEngagement?.toFixed?.(2)}</strong></div>
                  <div className="box">Spikes / Drops<br /><strong>{timeline.summary.spikeCount} / {timeline.summary.dropCount}</strong></div>
                </div>
              )}

              {timeline?.series && (
                <div style={{ marginTop: 12 }}>
                  <h4>Event types</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {timeline.series.byEventType?.map((t: any) => (
                      <div
                        key={t.eventType}
                        style={{ padding: '6px 10px', background: '#f3f4f6', borderRadius: 6, fontSize: 12 }}
                      >
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
                        <th style={{ textAlign: 'left', padding: 6 }}>Velocity</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Recency (d)</th>
                        <th style={{ textAlign: 'left', padding: 6 }}>Flags</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[...timeline.events]
                        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((ev: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: 6 }}>{new Date(ev.timestamp).toLocaleString()}</td>
                            <td style={{ padding: 6 }}>{prettyEventType(ev.event_type)}</td>
                            <td style={{ padding: 6 }}>{ev.engagement_score ?? '-'}</td>
                            <td style={{ padding: 6 }}>{ev.velocity ?? '-'}</td>
                            <td style={{ padding: 6 }}>{ev.recency_days ?? '-'}</td>
                            <td style={{ padding: 6 }}>
                              {ev.spike_flag ? 'Spike ' : ''}
                              {ev.drop_flag ? 'Drop' : ''}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 12 }}>No behavior events uploaded for this lead yet.</div>
              )}

              {timeline?.behaviorNarrative && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#111827' }}>
                  {timeline.behaviorNarrative}
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button type="button" className="btn-outline" onClick={() => { setActiveLead(null); setTimeline(null); }}>
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

function prettyEventType(t: string) {
  const map: Record<string, string> = {
    email_open: 'Email Open',
    email_click: 'Email Click',
    reply: 'Reply',
    website_visit: 'Website Visit',
    linkedin_view: 'LinkedIn View',
    call: 'Call',
    demo_request: 'Demo Request',
  };
  return map[t] || t;
}

function eventColor(t: string) {
  const map: Record<string, string> = {
    email_open: '#60a5fa',
    email_click: '#2563eb',
    reply: '#10b981',
    website_visit: '#8b5cf6',
    linkedin_view: '#14b8a6',
    call: '#f59e0b',
    demo_request: '#f472b6',
  };
  return map[t] || '#9ca3af';
}
