import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import '../m06/module6.css';
import { useWorkspaceId } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type RunOption = {
  id: string;
  label: string;
  model_type: string;
  status: string;
};

type CampaignSummary = {
  campaign_id: string;
  name: string | null;
  channel: string | null;
  total_revenue: number;
  deal_count: number;
  avg_revenue_per_deal: number;
};

type DealSummary = {
  deal_id: string;
  amount: number;
  closed_at?: string;
  closed_won?: boolean;
  lead_name?: string | null;
  lead_email?: string | null;
  total_attributed: number;
  unattributed: number;
  campaign_count: number;
};

type CampaignAllocationRow = {
  deal_id: string;
  deal_amount: number;
  revenue_share: number;
  closed_at?: string;
  lead_name?: string | null;
  lead_email?: string | null;
};

type DealAllocationRow = {
  campaign_id: string;
  campaign_name: string | null;
  channel: string | null;
  revenue_share: number;
};

type Mode = 'campaign' | 'deal';

type ApiErrorShape = { error?: string; message?: string };

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (n: number) => void }) {
  if (!total || total <= limit) return null;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  if (start + windowSize - 1 > totalPages) start = Math.max(1, totalPages - windowSize + 1);
  const pages: number[] = [];
  for (let i = 0; i < windowSize && start + i <= totalPages; i += 1) pages.push(start + i);

  return (
    <span className="pagination">
      {start > 1 && (
        <button type="button" className="page-btn" onClick={() => onPage(1)}>1</button>
      )}
      {start > 2 && <span className="mx-8 muted">...</span>}
      {pages.map(p => (
        <button
          key={p}
          type="button"
          className={`page-btn ${p === page ? 'active' : ''}`}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          <span className="mx-8 muted">...</span>
          <button type="button" className="page-btn" onClick={() => onPage(totalPages)}>{totalPages}</button>
        </>
      )}
    </span>
  );
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatDate(input?: string) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function mapError(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as ApiErrorShape & { status?: number };
    if (anyErr.message) return anyErr.message;
    if (anyErr.error) return anyErr.error;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export default function AllocationDashboard() {
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('campaign');

  const [channelFilter, setChannelFilter] = useState('');
  const [minShare, setMinShare] = useState<number | ''>('');
  const [leadSearch, setLeadSearch] = useState('');
  const [closedFrom, setClosedFrom] = useState('');
  const [closedTo, setClosedTo] = useState('');
  const [minDealAmount, setMinDealAmount] = useState<number | ''>('');
  const [maxDealAmount, setMaxDealAmount] = useState<number | ''>('');

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loadingMain, setLoadingMain] = useState(false);
  const [mainError, setMainError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<'all' | 'closed_won' | 'open'>('all');

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignAllocations, setCampaignAllocations] = useState<CampaignAllocationRow[]>([]);
  const [campaignAllocLoading, setCampaignAllocLoading] = useState(false);
  const [campaignAllocError, setCampaignAllocError] = useState<string | null>(null);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealAllocations, setDealAllocations] = useState<DealAllocationRow[]>([]);
  const [dealAllocLoading, setDealAllocLoading] = useState(false);
  const [dealAllocError, setDealAllocError] = useState<string | null>(null);

  const hasRuns = runs.length > 0;

  const projectId = useWorkspaceId({ redirectToWorkspaces: true });

  useEffect(() => {
    if (!projectId) return;
    async function fetchRuns() {
      setRunsLoading(true);
      setRunsError(null);
      try {
        const pid = projectId as string;
        const res = await fetch(`${API_URL}/m06/runs?projectId=${encodeURIComponent(pid)}`);
        const data = await res.json();
        if (!res.ok) throw data as ApiErrorShape;
        const options: RunOption[] = (data.runs || [])
          .filter((r: any) => r.status === 'success')
          .map((r: any) => ({
            id: String(r._id),
            label: `${(r.model_type || '').toUpperCase()} · ${(r.date_from || '').slice(0, 10)} → ${(r.date_to || '').slice(0, 10)}`,
            model_type: r.model_type,
            status: r.status,
          }));
        setRuns(options);
        if (!selectedRunId && options.length) setSelectedRunId(options[0].id);
      } catch (err) {
        setRunsError(mapError(err));
      } finally {
        setRunsLoading(false);
      }
    }
    fetchRuns();
  }, [projectId, selectedRunId]);

  useEffect(() => {
    if (!projectId || !selectedRunId) return;
    setLoadingMain(true);
    setMainError(null);

    const params = new URLSearchParams({ projectId, runId: selectedRunId, page: String(page), limit: String(limit) });
    if (channelFilter) params.set('channel', channelFilter);
    if (leadSearch.trim()) params.set('lead', leadSearch.trim());
    if (closedFrom) params.set('closedFrom', closedFrom);
    if (closedTo) params.set('closedTo', closedTo);
    if (statusFilter) params.set('status', statusFilter);
    if (minShare !== '' && !Number.isNaN(minShare)) params.set('minShare', String(minShare));
    if (mode === 'deal') {
      if (minDealAmount !== '' && !Number.isNaN(minDealAmount)) params.set('minDealAmount', String(minDealAmount));
      if (maxDealAmount !== '' && !Number.isNaN(maxDealAmount)) params.set('maxDealAmount', String(maxDealAmount));
    }

    const controller = new AbortController();

    async function fetchData() {
      try {
        if (mode === 'campaign') {
          const res = await fetch(`${API_URL}/m06/allocation/campaigns?${params.toString()}`, { signal: controller.signal });
          const data = await res.json();
          if (!res.ok) throw data as ApiErrorShape;
          setCampaigns(data.campaigns || []);
          setTotal(data.total || 0);
          setDeals([]);
        } else {
          const res = await fetch(`${API_URL}/m06/allocation/deals?${params.toString()}`, { signal: controller.signal });
          const data = await res.json();
          if (!res.ok) throw data as ApiErrorShape;
          setDeals(data.deals || []);
          setTotal(data.total || 0);
          setCampaigns([]);
        }
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        setMainError(mapError(err));
        setCampaigns([]);
        setDeals([]);
      } finally {
        setLoadingMain(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [projectId, selectedRunId, mode, channelFilter, leadSearch, closedFrom, closedTo, minShare, minDealAmount, maxDealAmount, statusFilter, page, limit]);

  const runLabel = useMemo(() => runs.find(r => r.id === selectedRunId)?.label || 'Select run', [runs, selectedRunId]);

  const showEmptyState = !loadingMain && !mainError && selectedRunId && ((mode === 'campaign' && campaigns.length === 0) || (mode === 'deal' && deals.length === 0));

  const hasAnyAllocations = useMemo(
    () => (campaigns.length > 0 || deals.length > 0),
    [campaigns.length, deals.length]
  );

  // Fetch drill-down allocations when a campaign or deal is selected
  useEffect(() => {
    if (!projectId || !selectedRunId || !selectedCampaignId || mode !== 'campaign') {
      setCampaignAllocations([]);
      setCampaignAllocError(null);
      return;
    }

    const params = new URLSearchParams({ projectId, runId: selectedRunId, campaignId: selectedCampaignId });
    const controller = new AbortController();
    async function load() {
      setCampaignAllocLoading(true);
      setCampaignAllocError(null);
      try {
        const res = await fetch(`${API_URL}/m06/allocation/campaign-deals?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw data as ApiErrorShape;
        setCampaignAllocations(data.allocations || []);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        setCampaignAllocError(mapError(err));
        setCampaignAllocations([]);
      } finally {
        setCampaignAllocLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [projectId, selectedRunId, selectedCampaignId, mode]);

  useEffect(() => {
    if (!projectId || !selectedRunId || !selectedDealId || mode !== 'deal') {
      setDealAllocations([]);
      setDealAllocError(null);
      return;
    }

    const params = new URLSearchParams({ projectId, runId: selectedRunId, dealId: selectedDealId });
    const controller = new AbortController();
    async function load() {
      setDealAllocLoading(true);
      setDealAllocError(null);
      try {
        const res = await fetch(`${API_URL}/m06/allocation/deal-campaigns?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw data as ApiErrorShape;
        setDealAllocations(data.allocations || []);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        setDealAllocError(mapError(err));
        setDealAllocations([]);
      } finally {
        setDealAllocLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [projectId, selectedRunId, selectedDealId, mode]);

  return (
    <Layout>
      <div className="m06-page">
      <div style={{ marginTop: 8 }}>
        <ModuleBackButton toSuffix="/m06" />
      </div>
      <section className="m06-hero">
        <div className="m06-hero-inner">
          <div className="m06-pill">Allocation Dashboard</div>
          <h1>Allocation Explorer</h1>
          <div className="m06-hero-copy">
            Review how revenue share is distributed across campaigns and deals for a selected attribution run, with the same filters and drill-down logic already in place.
          </div>
        </div>
      </section>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Allocation Dashboard</h2>
        </div>
        <div className="card-body">
          {!projectId && <div style={{ color: '#b41f1f', marginBottom: 12 }}>Open a workspace to explore allocations.</div>}
          {runsLoading && <div>Loading runs…</div>}
          {runsError && <div style={{ color: '#b41f1f' }}>{runsError}</div>}
          {hasRuns && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
                <span>Select attribution run</span>
                <select className="input" value={selectedRunId || ''} onChange={e => setSelectedRunId(e.target.value || null)}>
                  <option value="">Select run…</option>
                  {runs.map(run => (
                    <option key={run.id} value={run.id}>{run.label}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn-ghost btn-sm ${mode === 'campaign' ? 'active' : ''}`}
                  onClick={() => setMode('campaign')}
                >
                  View by Campaign
                </button>
                <button
                  type="button"
                  className={`btn-ghost btn-sm ${mode === 'deal' ? 'active' : ''}`}
                  onClick={() => setMode('deal')}
                >
                  View by Deal
                </button>
              </div>
            </div>
          )}

          {!hasRuns && !runsLoading && (
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>No attribution runs found for this workspace.</div>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  if (!projectId) return;
                  window.location.hash = `#/workspace/${projectId}/m06/run-attribution`;
                }}
              >
                Go to Run Attribution
              </button>
            </div>
          )}

          {hasRuns && (
            <div style={{ marginTop: 16 }}>
              <div className="m06-helper" style={{ marginBottom: 12 }}>
                Choose a run, switch between campaign and deal views, then use filters to understand how attributed revenue is being distributed.
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Filters</h4>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Channel</span>
                  <input className="input" value={channelFilter} onChange={e => setChannelFilter(e.target.value)} placeholder="Any" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Lead search</span>
                  <input className="input" value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Name, company, email" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Closed from</span>
                  <input className="input" type="date" value={closedFrom} onChange={e => setClosedFrom(e.target.value)} />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Closed to</span>
                  <input className="input" type="date" value={closedTo} onChange={e => setClosedTo(e.target.value)} />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Deal status</span>
                  <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="all">Any</option>
                    <option value="closed_won">Closed won</option>
                    <option value="open">Open / not won</option>
                  </select>
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Min revenue share</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={minShare === '' ? '' : minShare}
                    onChange={e => setMinShare(e.target.value ? Number(e.target.value) : '')}
                  />
                </label>
                {mode === 'deal' && (
                  <>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>Min deal amount</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={minDealAmount === '' ? '' : minDealAmount}
                        onChange={e => setMinDealAmount(e.target.value ? Number(e.target.value) : '')}
                      />
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>Max deal amount</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={maxDealAmount === '' ? '' : maxDealAmount}
                        onChange={e => setMaxDealAmount(e.target.value ? Number(e.target.value) : '')}
                      />
                    </label>
                  </>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Rows per page</span>
                  <select
                    className="input"
                    style={{ width: 80 }}
                    value={limit}
                    onChange={e => { setPage(1); setLimit(Number(e.target.value) || 25); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedRunId && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0 }}>{mode === 'campaign' ? 'Campaign allocations' : 'Deal allocations'} · {runLabel}</h3>
          </div>
          <div className="card-body">
            {loadingMain && <div>Loading allocations…</div>}
            {mainError && <div style={{ color: '#b41f1f' }}>{mainError}</div>}
            {showEmptyState && (
              <div style={{ fontSize: 13, color: '#4d4f67' }}>
                {hasAnyAllocations
                  ? 'No allocations match your filters. Try broadening your criteria.'
                  : 'This run has no allocation rows. All deals may have been unattributed or no deals were in the selected window.'}
              </div>
            )}

            {!loadingMain && !mainError && !showEmptyState && mode === 'campaign' && campaigns.length > 0 && (
              <div className="allocation-table">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Channel</th>
                      <th>Total revenue</th>
                      <th>Deals</th>
                      <th>Avg / deal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr
                        key={c.campaign_id}
                        style={{ cursor: 'pointer', background: selectedCampaignId === c.campaign_id ? '#f3f4ff' : undefined }}
                        onClick={() => {
                          setSelectedCampaignId(c.campaign_id);
                          setSelectedDealId(null);
                        }}
                      >
                        <td>{c.name || c.campaign_id}</td>
                        <td>{c.channel || 'other'}</td>
                        <td>{formatCurrency(c.total_revenue)}</td>
                        <td>{formatNumber(c.deal_count)}</td>
                        <td>{formatCurrency(c.avg_revenue_per_deal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <div>Showing {campaigns.length} of {total} campaigns</div>
                  <div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <span className="mx-8" />
                    <Pagination page={page} total={total} limit={limit} onPage={setPage} />
                    <span className="mx-8" />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={page * limit >= total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loadingMain && !mainError && !showEmptyState && mode === 'campaign' && selectedCampaignId && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Deals for selected campaign</h4>
                {campaignAllocLoading && <div>Loading campaign allocations…</div>}
                {campaignAllocError && <div style={{ color: '#b41f1f' }}>{campaignAllocError}</div>}
                {!campaignAllocLoading && !campaignAllocError && campaignAllocations.length === 0 && (
                  <div style={{ fontSize: 13, color: '#4d4f67' }}>No deals with allocations for this campaign.</div>
                )}
                {!campaignAllocLoading && !campaignAllocError && campaignAllocations.length > 0 && (
                  <div className="allocation-subtable">
                    <table>
                      <thead>
                        <tr>
                          <th>Deal</th>
                          <th>Lead</th>
                          <th>Deal amount</th>
                          <th>Revenue share</th>
                          <th>% of deal</th>
                          <th>Closed at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignAllocations.map(row => (
                          <tr key={row.deal_id}>
                            <td>{row.deal_id}</td>
                            <td>{row.lead_name || row.lead_email || '—'}</td>
                            <td>{formatCurrency(row.deal_amount)}</td>
                            <td>{formatCurrency(row.revenue_share)}</td>
                            <td>{row.deal_amount ? `${((row.revenue_share / row.deal_amount) * 100).toFixed(1)}%` : '—'}</td>
                            <td>{formatDate(row.closed_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!loadingMain && !mainError && !showEmptyState && mode === 'deal' && deals.length > 0 && (
              <div className="allocation-table">
                <table>
                  <thead>
                    <tr>
                      <th>Deal</th>
                      <th>Lead</th>
                      <th>Amount</th>
                      <th>Attributed</th>
                      <th>Unattributed</th>
                      <th>Campaigns</th>
                      <th>Closed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(d => (
                      <tr
                        key={d.deal_id}
                        style={{ cursor: 'pointer', background: selectedDealId === d.deal_id ? '#f3f4ff' : undefined }}
                        onClick={() => {
                          setSelectedDealId(d.deal_id);
                          setSelectedCampaignId(null);
                        }}
                      >
                        <td>{d.deal_id}</td>
                        <td>{d.lead_name || d.lead_email || '—'}</td>
                        <td>{formatCurrency(d.amount)}</td>
                        <td>{formatCurrency(d.total_attributed)}</td>
                        <td>{formatCurrency(d.unattributed)}</td>
                        <td>{formatNumber(d.campaign_count)}</td>
                        <td>{formatDate(d.closed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <div>Showing {deals.length} of {total} deals</div>
                  <div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <span className="mx-8" />
                    <Pagination page={page} total={total} limit={limit} onPage={setPage} />
                    <span className="mx-8" />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={page * limit >= total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loadingMain && !mainError && !showEmptyState && mode === 'deal' && selectedDealId && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Campaigns for selected deal</h4>
                {dealAllocLoading && <div>Loading deal allocations…</div>}
                {dealAllocError && <div style={{ color: '#b41f1f' }}>{dealAllocError}</div>}
                {!dealAllocLoading && !dealAllocError && dealAllocations.length === 0 && (
                  <div style={{ fontSize: 13, color: '#4d4f67' }}>No campaign allocations for this deal.</div>
                )}
                {!dealAllocLoading && !dealAllocError && dealAllocations.length > 0 && (
                  <div className="allocation-subtable">
                    <table>
                      <thead>
                        <tr>
                          <th>Campaign</th>
                          <th>Channel</th>
                          <th>Revenue share</th>
                          <th>% of deal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dealAllocations.map(row => (
                          <tr key={row.campaign_id}>
                            <td>{row.campaign_name || row.campaign_id}</td>
                            <td>{row.channel || 'other'}</td>
                            <td>{formatCurrency(row.revenue_share)}</td>
                            <td>
                              {(() => {
                                const base = deals.find(d => d.deal_id === selectedDealId)?.amount;
                                return base ? `${((row.revenue_share / base) * 100).toFixed(1)}%` : '—';
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
