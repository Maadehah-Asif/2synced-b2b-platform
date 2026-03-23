import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import Autocomplete from '../../components/Autocomplete';
import { previewJourneys, getJourney } from './services/journeys';
import { searchCampaigns } from './services/campaigns';
import { searchLeads } from './services/deals';
import { useWorkspaceId } from '../../utils/workspace';

export default function JourneyPreview() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('closed_won');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [channel, setChannel] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [campaignId, setCampaignId] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [journey, setJourney] = useState<any | null>(null);
  const [journeyError, setJourneyError] = useState<string | undefined>(undefined);
  const [journeyOpen, setJourneyOpen] = useState(false);

  // default to last 90 days
  useEffect(() => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 90);
    setFrom(past.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  }, []);

  function validate() {
    setDateError(undefined);
    setAmountError(undefined);

    if (from && to) {
      const a = new Date(from).getTime();
      const b = new Date(to).getTime();
      if (!isNaN(a) && !isNaN(b) && a > b) {
        setDateError('Start date cannot be after end date');
        return false;
      }
    }
    if (minAmount && isNaN(Number(minAmount))) {
      setAmountError('Min amount must be numeric');
      return false;
    }
    if (maxAmount && isNaN(Number(maxAmount))) {
      setAmountError('Max amount must be numeric');
      return false;
    }
    return true;
  }

  async function load() {
    if (!workspaceId) {
      setRows([]);
      setTotal(0);
      return;
    }
    if (!validate()) return;

    setLoading(true);
    setError(undefined);

    try {
      const data = await previewJourneys({
        from,
        to,
        status,
        minAmount,
        maxAmount,
        lead: leadFilter,
        channel,
        campaignId,
        page,
        limit,
      });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (from && to) load();
  }, [from, to, status, minAmount, maxAmount, leadFilter, channel, page, limit, workspaceId]);

  function onPickDeal(row: any) {
    setSelectedDealId(row.deal_id);
    setJourneyOpen(true);
    setJourney(null);
    setJourneyError(undefined);

    getJourney(row.deal_id)
      .then(setJourney)
      .catch((e: any) => setJourneyError(e?.message || 'Failed to load journey'));
  }

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  // shared styles
  const filterInputStyle: React.CSSProperties = {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    border: '1px solid #d0d7e2',
    fontSize: 13,
    boxSizing: 'border-box',
    background: '#fff',
  };

  const filterLabelStyle: React.CSSProperties = {
    fontSize: 12,
    marginBottom: 4,
    display: 'block',
  };

  const primaryBtnStyle: React.CSSProperties = {
    background: '#0f4258',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <Layout>
      <main className="page-root m06-page">
        <ModuleBackButton toSuffix="/m06" />
        <section className="m06-hero">
          <div className="m06-hero-inner">
            <div className="m06-pill">Journey Preview</div>
            <h1>Deal Journey Explorer</h1>
            <div className="m06-hero-copy">
              Inspect deal journeys inside a chosen analysis window, filter them by campaign and lead context, and open touch-level details without changing attribution logic.
            </div>
          </div>
        </section>
        {!workspaceId && (
          <div style={{ fontSize: 12, color: '#c33', marginTop: 8 }}>
            Open a workspace to inspect journeys.
          </div>
        )}

        {/* FILTER GRID – 4 columns, 2 rows */}
        <div
          className="m06-panel"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            alignItems: 'flex-end',
          }}
        >
          <div style={{ gridColumn: '1 / span 4' }}>
            <div className="m06-section-label">Filters</div>
            <div className="m06-helper" style={{ marginTop: 8 }}>
              Narrow the journey list by closed date, channel, campaign, lead, and deal size before opening a specific deal path.
            </div>
          </div>
          {/* Closed from */}
          <div>
            <span style={filterLabelStyle}>Closed from</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={filterInputStyle}
            />
          </div>

          {/* Closed to */}
          <div>
            <span style={filterLabelStyle}>Closed to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={filterInputStyle}
            />
          </div>

          {/* Status */}
          <div>
            <span style={filterLabelStyle}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={filterInputStyle}
            >
              <option value="">All</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
              <option value="open">Open/Other</option>
            </select>
          </div>

          {/* Channel */}
          <div>
            <span style={filterLabelStyle}>Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              style={filterInputStyle}
            >
              <option value="">Any</option>
              <option value="email">Email</option>
              <option value="ads">Ads</option>
              <option value="linkedin">LinkedIn</option>
              <option value="webinar">Webinar</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Campaign */}
          <div>
            <span style={filterLabelStyle}>Campaign</span>
            <Autocomplete
              value={campaignQuery}
              placeholder="Search campaigns"
              fetchItems={async (q) => await searchCampaigns(q)}
              formatItem={(c: any) => `${c.name} (${c.channel || 'other'})`}
              getValue={(c: any) => String(c.id)}
              onChange={(val, item) => {
                setCampaignQuery(val);
                setCampaignId(item ? String(item.id) : '');
              }}
            />
          </div>

          {/* Min amount */}
          <div>
            <span style={filterLabelStyle}>Min amount</span>
            <input
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              style={filterInputStyle}
            />
          </div>

          {/* Max amount */}
          <div>
            <span style={filterLabelStyle}>Max amount</span>
            <input
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              style={filterInputStyle}
            />
          </div>

          {/* Lead */}
          <div>
            <span style={filterLabelStyle}>Lead</span>
            <Autocomplete
              value={leadQuery}
              placeholder="Lead id / name / company"
              fetchItems={async (q) => {
                const r = await searchLeads(q);
                return r.leads || [];
              }}
              formatItem={(l: any) =>
                `#${l.lead_id} ${l.First_Name || ''} ${l.Last_Name || ''}`.trim()
              }
              getValue={(l: any) => String(l.lead_id)}
              onChange={(val, item) => {
                setLeadQuery(val);
                setLeadFilter(item ? String(item.lead_id) : '');
              }}
            />
          </div>

          {/* Error messages under grid */}
          {dateError && (
            <div style={{ gridColumn: '1 / span 4', color: '#c33', fontSize: 11 }}>
              {dateError}
            </div>
          )}
          {amountError && (
            <div style={{ gridColumn: '1 / span 4', color: '#c33', fontSize: 11 }}>
              {amountError}
            </div>
          )}

          {/* Apply / Reset */}
          <div
            style={{
              gridColumn: '1 / span 4',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 4,
            }}
          >
            <button
              style={primaryBtnStyle}
              onClick={() => {
                setPage(1);
                load();
              }}
            >
              Apply
            </button>
            <button
              style={primaryBtnStyle}
              onClick={() => {
                setStatus('closed_won');
                setChannel('');
                setCampaignQuery('');
                setCampaignId('');
                setLeadQuery('');
                setLeadFilter('');
                setMinAmount('');
                setMaxAmount('');
                setPage(1);
                load();
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* RESULTS TABLE */}
        <div className="m06-panel">
          {error && (
            <div
              style={{
                background: '#fee',
                color: '#900',
                padding: '8px 10px',
                border: '1px solid #f99',
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              Could not load journeys: {error}
              <div style={{ marginTop: 6 }}>
                <button className="btn-ghost" onClick={() => load()}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading && <div style={{ fontSize: 12 }}>Loading...</div>}

          {!loading && rows.length === 0 && (
            <div style={{ fontSize: 12 }}>No deals found for selected filters.</div>
          )}

          {!loading && rows.length > 0 && (
            <>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: 6 }}>Deal ID</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Lead</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Email</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Closed at</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Touches</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>First touch</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Last touch</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.deal_id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 6 }}>{r.deal_external_id || r.deal_id}</td>
                      <td style={{ padding: 6 }}>{r.lead_name || `#${r.lead_id}`}</td>
                      <td style={{ padding: 6 }}>{r.lead_email || '-'}</td>
                      <td style={{ padding: 6 }}>{r.amount}</td>
                      <td style={{ padding: 6 }}>
                        {r.closed_at ? new Date(r.closed_at).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: 6 }}>{r.status}</td>
                      <td style={{ padding: 6 }}>
                        {r.touchCount === 0 ? (
                          <span
                            style={{
                              background: '#fee',
                              color: '#900',
                              padding: '2px 6px',
                              borderRadius: 6,
                            }}
                          >
                            0 touches
                          </span>
                        ) : r.touchCount === 1 ? (
                          <span
                            style={{
                              background: '#eef',
                              color: '#224',
                              padding: '2px 6px',
                              borderRadius: 6,
                            }}
                          >
                            single
                          </span>
                        ) : (
                          r.touchCount
                        )}
                      </td>
                      <td style={{ padding: 6 }}>
                        {r.firstTouchAt ? new Date(r.firstTouchAt).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: 6 }}>
                        {r.lastTouchAt ? new Date(r.lastTouchAt).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: 6 }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => onPickDeal(r)}
                        >
                          View Journey
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span style={{ fontSize: 12 }}>Page {page} of {totalPages}</span>
                <button
                  className="btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

        {/* JOURNEY POPUP */}
        {journeyOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: 16,
                width: 640,
                maxHeight: '80vh',
                overflow: 'auto',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Journey</h3>

              {journeyError && (
                <div
                  style={{
                    background: '#fee',
                    color: '#900',
                    padding: '8px 10px',
                    border: '1px solid #f99',
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                >
                  Could not load journey: {journeyError}
                </div>
              )}

              {!journey && !journeyError && (
                <div style={{ fontSize: 12 }}>Loading journey...</div>
              )}

              {journey && (
                <>
                  <div style={{ fontSize: 12, marginBottom: 8, color: '#555' }}>
                    Deal: {journey.deal?.external_id || journey.deal?.id} • Amount:{' '}
                    {journey.deal?.amount} • Closed:{' '}
                    {journey.deal?.closed_at
                      ? new Date(journey.deal.closed_at).toLocaleString()
                      : '-'}{' '}
                    • Status: {journey.deal?.status}
                  </div>

                  {journey.lead && (
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      Lead: {journey.lead.name || '(unknown)'}
                      {journey.lead.email ? ` • ${journey.lead.email}` : ''}
                      {journey.lead.company ? ` • ${journey.lead.company}` : ''}
                    </div>
                  )}

                  {!journey.journey || journey.journey.length === 0 ? (
                    <div
                      style={{
                        background: '#f7f7f7',
                        padding: 10,
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      No campaign touches found before deal close. This deal will be
                      unattributed unless more data is added.
                    </div>
                  ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5' }}>
                          <th style={{ textAlign: 'left', padding: 6 }}>Touched at</th>
                          <th style={{ textAlign: 'left', padding: 6 }}>Campaign</th>
                          <th style={{ textAlign: 'left', padding: 6 }}>Channel</th>
                          <th style={{ textAlign: 'left', padding: 6 }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journey.journey.map((t: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: 6 }}>
                              {new Date(t.touched_at).toLocaleString()}
                            </td>
                            <td style={{ padding: 6 }}>
                              {t.campaignName || t.campaign_id}
                            </td>
                            <td style={{ padding: 6 }}>{t.channel || 'other'}</td>
                            <td style={{ padding: 6 }}>{t.type || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setJourneyOpen(false);
                    setSelectedDealId(null);
                    setJourney(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
