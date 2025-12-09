import { useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function BehaviorTimeline() {
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [leadId, setLeadId] = useState('');
  const [timeline, setTimeline] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!workspace) {
      setMessage('Workspace required');
      return;
    }
    if (!leadId.trim()) {
      setMessage('Enter a lead id');
      return;
    }
    setLoading(true);
    setMessage(null);
    setTimeline(null);
    try {
      const params = new URLSearchParams({ workspaceId: workspace, leadId: leadId.trim() });
      const res = await fetch(`${API_URL}/m02/behaviors/timeline?${params.toString()}`);
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setMessage(j?.error || 'failed to load');
        setTimeline(null);
      } else {
        setTimeline(j);
      }
    } catch (e) {
      setMessage('network error');
    }
    setLoading(false);
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />
          <div>
            <h2 style={{ margin: 0 }}>Behavior Timeline</h2>
            <div style={{ fontSize: 13, color: '#4b5563' }}>View events and top drivers for a lead.</div>
          </div>
        </div>

        <div className="card mt-12" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>Lead ID</div>
            <input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="Enter lead_id from CSV" />
          </div>
          <button className="btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Load timeline'}
          </button>
        </div>

        {message && <div className="mt-8 muted">{message}</div>}

        {timeline && !timeline.error && (
          <div className="mt-12">
            {timeline.summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
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
                <div className="box">
                  Intent (most frequent)
                  <br />
                  <strong>{computeTopIntent(timeline?.events)}</strong>
                </div>
              </div>
            )}

            {timeline.series && (
              <div style={{ marginTop: 16 }}>
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

            {timeline.events && timeline.events.length > 0 ? (
              <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
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
              <div className="muted mt-12">No behavior events uploaded for this lead yet.</div>
            )}

            {timeline.behaviorNarrative && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#111827' }}>{timeline.behaviorNarrative}</div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function computeTopIntent(events: any[] | undefined) {
  if (!events || !events.length) return '-';
  const segCounts: Record<string, number> = {};
  events.forEach((ev: any) => {
    const seg = ev.intentSegment || ev.intent_segment;
    if (!seg) return;
    segCounts[seg] = (segCounts[seg] || 0) + 1;
  });
  const top = Object.entries(segCounts).sort((a,b)=>b[1]-a[1])[0];
  return top ? `${top[0]} (${top[1]})` : '-';
}
