/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: RoiCalculation.tsx
 * Purpose: Supports the R oi Ca lc ul at io n flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { InsightPanel } from '../../components/InsightChrome';
import BarChart from './BarChart';
import PieChart from './PieChart';
import Pagination from './components/Pagination';
import './module6.css';
import { useWorkspaceId } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type AttributionRun = {
  id: string;
  run_id: string;
  model_type: string;
  timestamp: string;
  status: string;
};

type RoiByRunResponse = {
  ok: boolean;
  runId: string;
  totalAttributed: number;
  totalSpend: number;
  netProfit: number;
  overallROI: number | null;
  campaigns: Array<{
    campaign_id: string;
    name: string | null;
    channel: string | null;
    spend: number;
    attributed: number;
    profit: number;
    roi: number | null;
  }>;
  warnings?: string[];
  totalDeals?: number;
  campaignCount?: number;
};

type RunApiItem = {
  id?: string;
  _id?: string;
  runId?: string;
  run_id?: string;
  model_type?: string;
  modelType?: string;
  timestamp?: string;
  status?: string;
};

export default function RoiCalculation() {
  const wid = useWorkspaceId({ redirectToWorkspaces: true });
  const workspaceId = wid || '';
  const [runs, setRuns] = useState<AttributionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoiByRunResponse | null>(null);
  const [campaignPage, setCampaignPage] = useState(1);
  const campaignPageSize = 10;

  useEffect(() => {
    if (!wid) return;
    async function fetchRuns() {
      try {
        setLoadingRuns(true);
        setError(null);
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        params.set('projectId', workspaceId);
        const res = await fetch(`${API_URL}/m06/runs?${params.toString()}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        const j = await res.json();
        if (!res.ok) {
          setError(j?.message || j?.error || 'Failed to load runs');
          setRuns([]);
        } else {
          const list: AttributionRun[] = (j.runs || []).map((r: RunApiItem) => ({
            id: r.id || r._id || r.runId || '',
            run_id: r.run_id || r.id || '',
            model_type: r.model_type || r.modelType || 'unknown',
            timestamp: r.timestamp,
            status: r.status,
          }));
          setRuns(list);
        }
      } catch {
        setError('Network error while loading runs');
        setRuns([]);
      } finally {
        setLoadingRuns(false);
      }
    }
    fetchRuns();
  }, [workspaceId, wid]);

  async function onCalculate() {
    if (!wid || !selectedRunId) return;
    setCalculating(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('projectId', workspaceId);
      params.set('runId', selectedRunId);
      const res = await fetch(`${API_URL}/m06/roi-by-run?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.message || j?.error || 'Failed to calculate ROI for run');
      } else {
        setResult(j as RoiByRunResponse);
        setCampaignPage(1);
      }
    } catch {
      setError('Network error while calculating ROI');
    } finally {
      setCalculating(false);
    }
  }

  function goToDashboard() {
    if (!wid || !selectedRunId) return;
    const params = new URLSearchParams();
    params.set('runId', selectedRunId);
    window.location.hash = `#/workspace/${workspaceId}/m06/roi?${params.toString()}`;
  }

  const tr = (v: number) => `$${Math.round(v || 0).toLocaleString()}`;
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : `${(Math.round(v * 100) / 100).toLocaleString()}%`;

  const topCampaignChart = useMemo(
    () =>
      (result?.campaigns || [])
        .slice()
        .sort((a, b) => (b.attributed || 0) - (a.attributed || 0))
        .slice(0, 6)
        .map((campaign) => ({
          label: (campaign.name || campaign.campaign_id).slice(0, 14),
          value: campaign.attributed || 0,
        })),
    [result]
  );

  const channelMix = useMemo(() => {
    const totals = new Map<string, number>();
    for (const campaign of result?.campaigns || []) {
      const key = campaign.channel || 'other';
      totals.set(key, (totals.get(key) || 0) + (campaign.attributed || 0));
    }
    return Array.from(totals.entries()).map(([label, value]) => ({ label, value }));
  }, [result]);

  const paginatedCampaigns = useMemo(() => {
    const rows = result?.campaigns || [];
    const start = (campaignPage - 1) * campaignPageSize;
    return rows.slice(start, start + campaignPageSize);
  }, [campaignPage, result]);

  if (!workspaceId) {
    return (
      <Layout>
        <main className="page-root">
          <div style={{ fontSize: 13 }}>Open a workspace to calculate ROI.</div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="page-root m06-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <section className="m06-hero">
          <div className="m06-hero-inner">
            <div className="m06-pill">ROI Calculation</div>
            <h1>Run-Based ROI Review</h1>
            <div className="m06-hero-copy">
              Select a completed attribution run, compare revenue against campaign spend, and confirm whether the run is strong enough to justify deeper campaign-level investigation.
            </div>
          </div>
        </section>

        <section className="m06-panel" style={{ paddingBottom: 18 }}>
          <div className="m06-toolbar">
            <div>
              <div className="m06-section-label">Step 1</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Choose an attribution run</h3>
              <div className="m06-helper">
                Use a successful run here. If there are no runs yet, go to `Run Attribution` first and generate one.
              </div>
            </div>
          </div>

          {loadingRuns ? (
            <div style={{ marginTop: 12, fontSize: 13 }}>Loading runs…</div>
          ) : runs.length === 0 ? (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              No successful attribution runs found. Run attribution first from the allocation area.
            </div>
          ) : (
            <div className="m06-filter-grid" style={{ marginTop: 16, alignItems: 'end' }}>
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Attribution run</span>
                <select value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
                  <option value="">Select a run…</option>
                  {runs.map(r => (
                    <option key={r.id || r.run_id} value={r.id || r.run_id}>
                      {r.run_id} - {r.model_type} - {new Date(r.timestamp).toLocaleString()} ({r.status})
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn-primary" disabled={!selectedRunId || calculating} onClick={onCalculate}>
                  {calculating ? 'Calculating…' : 'Calculate ROI'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'crimson' }}>
              {error}
            </div>
          )}
        </section>

        {result && (
          <>
            <section className="m06-kpi-grid">
              <div className="m06-kpi-card">
                <div className="label">Attributed Revenue</div>
                <div className="value">{tr(result.totalAttributed)}</div>
              </div>
              <div className="m06-kpi-card">
                <div className="label">Campaign Spend</div>
                <div className="value">{tr(result.totalSpend)}</div>
              </div>
              <div className="m06-kpi-card">
                <div className="label">Net Profit</div>
                <div className="value">{tr(result.netProfit)}</div>
              </div>
              <div className="m06-kpi-card">
                <div className="label">ROI</div>
                <div className="value">{pct(result.overallROI)}</div>
              </div>
              <div className="m06-kpi-card">
                <div className="label">Campaigns Credited</div>
                <div className="value">{result.campaigns.length}</div>
              </div>
              {result.totalDeals !== undefined && (
                <div className="m06-kpi-card">
                  <div className="label">Deals in Run</div>
                  <div className="value">{result.totalDeals}</div>
                </div>
              )}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 18, marginTop: 18 }}>
              <InsightPanel eyebrow="Top return" title="Best-attributed campaigns">
                <BarChart data={topCampaignChart} height={220} valueFormatter={(value) => tr(value)} />
              </InsightPanel>

              <InsightPanel eyebrow="Channel mix" title="Attributed revenue by channel" soft>
                <PieChart data={channelMix} size={170} />
              </InsightPanel>
            </section>

            <section className="m06-panel">
              <div className="m06-toolbar">
                <div>
                  <div className="m06-section-label">Preview</div>
                  <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Campaign ROI snapshot</h3>
                  <div className="m06-helper">
                    This is the quick comparison view for the currently selected run. Open the full ROI dashboard for broader filtering and ranking.
                  </div>
                </div>
                <button className="btn-secondary" onClick={goToDashboard}>
                  Open Full ROI Dashboard
                </button>
              </div>

              <div className="m06-table-shell" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Channel</th>
                      <th>Spend</th>
                      <th>Attributed</th>
                      <th>ROI %</th>
                      <th>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCampaigns.map(c => (
                      <tr key={c.campaign_id}>
                        <td>{c.name || c.campaign_id}</td>
                        <td>{c.channel || '—'}</td>
                        <td>{tr(c.spend)}</td>
                        <td>{tr(c.attributed)}</td>
                        <td>{pct(c.roi)}</td>
                        <td>{tr(c.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#5B6C8B' }}>
                  Showing {(campaignPage - 1) * campaignPageSize + 1} to {Math.min(campaignPage * campaignPageSize, result.campaigns.length)} of {result.campaigns.length} campaigns.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="btn-ghost btn-sm" disabled={campaignPage <= 1} onClick={() => setCampaignPage((value) => Math.max(1, value - 1))}>Prev</button>
                  <Pagination page={campaignPage} total={result.campaigns.length} limit={campaignPageSize} onPage={setCampaignPage} />
                  <button type="button" className="btn-ghost btn-sm" disabled={campaignPage * campaignPageSize >= result.campaigns.length} onClick={() => setCampaignPage((value) => value + 1)}>Next</button>
                </div>
              </div>
            </section>

            <section className="m06-panel soft">
              <div className="m06-section-label">Notes</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Warnings and interpretation</h3>
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13, color: '#415274' }}>
                {(result.warnings && result.warnings.length > 0
                  ? result.warnings
                  : ['ROI looks stable for this run. No obvious issues were reported by the calculation output.']
                ).map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}
