import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
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

export default function RoiCalculation() {
  const wid = useWorkspaceId({ redirectToWorkspaces: true });
  const workspaceId = wid || '';
  const [runs, setRuns] = useState<AttributionRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoiByRunResponse | null>(null);

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
          const list: AttributionRun[] = (j.runs || []).map((r: any) => ({
            id: r.id || r._id || r.runId || '',
            run_id: r.run_id || r.id || '',
            model_type: r.model_type || r.modelType || 'unknown',
            timestamp: r.timestamp,
            status: r.status,
          }));
          setRuns(list);
        }
      } catch (e) {
        setError('Network error while loading runs');
        setRuns([]);
      } finally {
        setLoadingRuns(false);
      }
    }
    fetchRuns();
  }, [workspaceId]);

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
      }
    } catch (e) {
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
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — ROI Calculation</h2>
        </div>

        <div className="m7-card" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Step 1 — Choose an attribution run</div>
          {loadingRuns ? (
            <div style={{ marginTop: 8, fontSize: 13 }}>Loading runs…</div>
          ) : runs.length === 0 ? (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              No successful attribution runs found. Run attribution first from the Allocation / Run screen.
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <select
                value={selectedRunId}
                onChange={e => setSelectedRunId(e.target.value)}
                style={{ minWidth: 260 }}
              >
                <option value="">Select a run…</option>
                {runs.map(r => (
                  <option key={r.id || r.run_id} value={r.id || r.run_id}>
                    {r.run_id} — {r.model_type} — {new Date(r.timestamp).toLocaleString()} ({r.status})
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={!selectedRunId || calculating}
                onClick={onCalculate}
              >
                {calculating ? 'Calculating…' : 'Calculate ROI for this run'}
              </button>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'crimson' }}>
              {error}
            </div>
          )}
        </div>

        {result && (
          <>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Attributed Revenue (this run)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(result.totalAttributed)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Campaign Spend (project)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(result.totalSpend)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Net Profit</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(result.netProfit)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>ROI for this run</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{pct(result.overallROI)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Campaigns with credit</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{result.campaigns.length}</div>
              </div>
              {result.totalDeals !== undefined && (
                <div className="m7-card" style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#666' }}>Total deals in run</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{result.totalDeals}</div>
                </div>
              )}
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Campaign ROI preview (this run)</div>
                <button className="btn-secondary" onClick={goToDashboard}>
                  Open full ROI Dashboard
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={{ padding: 8 }}>Campaign</th>
                      <th style={{ padding: 8 }}>Channel</th>
                      <th style={{ padding: 8 }}>Spend</th>
                      <th style={{ padding: 8 }}>Attributed</th>
                      <th style={{ padding: 8 }}>ROI %</th>
                      <th style={{ padding: 8 }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.campaigns.map(c => (
                      <tr key={c.campaign_id}>
                        <td style={{ padding: 8 }}>{c.name || c.campaign_id}</td>
                        <td style={{ padding: 8 }}>{c.channel}</td>
                        <td style={{ padding: 8 }}>{tr(c.spend)}</td>
                        <td style={{ padding: 8 }}>{tr(c.attributed)}</td>
                        <td style={{ padding: 8 }}>{pct(c.roi)}</td>
                        <td style={{ padding: 8 }}>{tr(c.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Warnings & notes</div>
              <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 12, color: '#555' }}>
                {(result.warnings && result.warnings.length > 0
                  ? result.warnings
                  : ['ROI looks stable; no obvious issues detected.']
                ).map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
