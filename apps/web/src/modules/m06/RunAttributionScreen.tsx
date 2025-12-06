import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { runAttribution, listRuns, getRunSummary } from './services/attributionRuns';
import '../m06/module6.css';

type RunConfig = {
  model_type: 'first_touch' | 'last_touch' | 'linear';
  date_from: string;
  date_to: string;
  closedWonOnly?: boolean;
  minAmount?: number;
  includeArchived?: boolean;
};

export default function RunAttributionScreen() {
  const [projectId, setProjectId] = useState<string>('default');
  const [config, setConfig] = useState<RunConfig>({ model_type: 'linear', date_from: '', date_to: '', closedWonOnly: true });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [openAllocDealId, setOpenAllocDealId] = useState<string | null>(null);

  useEffect(() => {
    const pid = localStorage.getItem('projectId') || 'default';
    setProjectId(pid);
    // load runs
    listRuns(pid).then(r => setRuns(r.runs || [])).catch(() => {});
  }, []);

  const validate = () => {
    if (!config.model_type) return 'Select an attribution model';
    if (!config.date_from || !config.date_to) return 'Select a date range';
    if (new Date(config.date_from).getTime() > new Date(config.date_to).getTime()) return 'Start date must be before end date';
    return null;
  };

  const onRun = async () => {
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    setRunning(true);
    try {
      const resp = await runAttribution(projectId, config);
      const runId = resp.runId as string;
      setActiveRunId(runId);
      const s = await getRunSummary(projectId, runId);
      setSummary(s);
      const lr = await listRuns(projectId);
      setRuns(lr.runs || []);
    } catch (e: any) {
      setError(e?.message || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const tooltip = {
    first_touch: 'Assigns 100% credit to the first campaign touch in the journey.',
    last_touch: 'Assigns 100% credit to the final campaign touch before the deal closes.',
    linear: 'Splits credit equally across all campaign touches in the journey.'
  } as const;

  function goToROI(){
    const wid = (window.location.hash.match(/#\/workspace\/(.+?)(?:\/|$)/) || [])[1];
    if (!wid || !activeRunId) return;
    window.location.hash = `#/workspace/${wid}/m06/roi?runId=${activeRunId}`;
  }

  async function selectRun(runId: string){
    setActiveRunId(runId);
    setError(null);
    try {
      const s = await getRunSummary(projectId, runId);
      setSummary(s);
    } catch (e: any) {
      setError(e?.message || 'Failed to load summary');
    }
  }

  return (
    <Layout>
      <div style={{ marginTop: 8 }}>
        <ModuleBackButton toSuffix="/m06" />
      </div>
      <div className="surface" style={{ display: 'grid', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h2 style={{ margin: 0 }}>Run Attribution</h2></div>
          <div className="card-body">
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Model</label>
                <select className="input" title={tooltip[config.model_type]} value={config.model_type} onChange={e => setConfig({ ...config, model_type: e.target.value as any })}>
                  <option value="first_touch">First Touch</option>
                  <option value="last_touch">Last Touch</option>
                  <option value="linear">Linear</option>
                </select>
                <div className="hint" style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 6 }}>{tooltip[config.model_type]}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">From</label>
                  <input className="input" type="date" value={config.date_from} onChange={e => setConfig({ ...config, date_from: e.target.value })} />
                </div>
                <div>
                  <label className="label">To</label>
                  <input className="input" type="date" value={config.date_to} onChange={e => setConfig({ ...config, date_to: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!config.closedWonOnly} onChange={e => setConfig({ ...config, closedWonOnly: e.target.checked })} /> Closed-won only
                </label>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Min Amount
                  <input className="input" style={{ width: 140 }} type="number" value={config.minAmount || ''} onChange={e => setConfig({ ...config, minAmount: e.target.value ? Number(e.target.value) : undefined })} />
                </label>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!config.includeArchived} onChange={e => setConfig({ ...config, includeArchived: e.target.checked })} /> Include archived
                </label>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={running} onClick={onRun}>{running ? 'Running…' : 'Run Attribution'}</button>
            </div>
          </div>
        </div>

        {summary && (
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0 }}>Summary</h3></div>
            <div className="card-body">
              <div className="cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="stat"><div className="stat-label">Deals</div><div className="stat-value">{summary.run.deal_count}</div></div>
                <div className="stat"><div className="stat-label">With Journeys</div><div className="stat-value">{summary.run.deals_with_journeys}</div></div>
                <div className="stat"><div className="stat-label">Without Journeys</div><div className="stat-value">{summary.run.deals_without_journeys}</div></div>
                <div className="stat"><div className="stat-label">Total Revenue</div><div className="stat-value">{summary.run.total_revenue}</div></div>
                <div className="stat"><div className="stat-label">Attributed</div><div className="stat-value">{summary.run.attributed_revenue}</div></div>
                <div className="stat"><div className="stat-label">Unattributed</div><div className="stat-value">{summary.run.unattributed_revenue}</div></div>
              </div>

              <h4 style={{ marginTop: 16 }}>Top Campaigns</h4>
              <table className="table">
                <thead><tr><th>Campaign</th><th>Revenue</th><th>Deals</th></tr></thead>
                <tbody>
                  {(summary.campaigns || []).map((c: any) => (
                    <tr key={String(c.campaign_id)}>
                      <td>{String(c.campaign_id)}</td>
                      <td>{c.revenue}</td>
                      <td>{c.deal_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="alert alert-info" style={{ marginTop: 12 }}>
                Deals without journeys are unattributed. Count: {summary.run.deals_without_journeys}. Unattributed revenue equals the gap between total and attributed.
                <button className="btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => { const wid = (window.location.hash.match(/#\/workspace\/(.+?)(?:\/|$)/) || [])[1]; if (!wid) return; window.location.hash = `#/workspace/${wid}/m06/journeys`; }}>Open Journey Preview</button>
              </div>

              <h4 style={{ marginTop: 16 }}>Sample Allocation Preview</h4>
              <table className="table">
                <thead><tr><th>Deal</th><th>Lead</th><th>Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  {(summary.samples || []).map((s: any) => (
                    <React.Fragment key={String(s._id)}>
                      <tr>
                        <td>{String(s._id)}</td>
                        <td>{s.lead_id ?? ''}</td>
                        <td>{s.deal_amount ?? s.total}</td>
                        <td><button className="btn-primary btn-sm" onClick={() => setOpenAllocDealId(openAllocDealId === String(s._id) ? null : String(s._id))}>{openAllocDealId === String(s._id) ? 'Hide Allocation' : 'View Allocation'}</button></td>
                      </tr>
                      {openAllocDealId === String(s._id) && (
                        <tr>
                          <td colSpan={4}>
                            <table className="table">
                              <thead><tr><th>Campaign</th><th>Share</th><th>% of deal</th></tr></thead>
                              <tbody>
                                {(s.items || []).map((it: any, idx: number) => {
                                  const amount = Number(it.share || 0);
                                  const base = Number(s.deal_amount || s.total || 0);
                                  const pct = base > 0 ? ((amount / base) * 100) : 0;
                                  return (<tr key={idx}><td>{String(it.campaign_id)}</td><td>{amount.toFixed(2)}</td><td>{pct.toFixed(2)}%</td></tr>);
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {summary.unattributed_sample && (
                    <tr>
                      <td colSpan={4}>Unattributed example: Deal {String(summary.unattributed_sample.deal_id)} Rev {summary.unattributed_sample.revenue}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header"><h3 style={{ margin: 0 }}>Past Runs</h3></div>
          <div className="card-body">
            <table className="table">
              <thead><tr><th>Run</th><th>Model</th><th>Status</th><th>Date Range</th><th>Created</th><th>Revenue</th></tr></thead>
              <tbody>
                {(runs || []).map((r: any) => (
                  <tr key={String(r._id)} className={activeRunId === String(r._id) ? 'row-active' : ''} style={{ cursor: 'pointer' }} onClick={() => selectRun(String(r._id))}>
                    <td>{r.run_id}</td>
                    <td>{r.model_type}</td>
                    <td>{r.status}</td>
                    <td>{r.date_from?.slice(0, 10)} → {r.date_to?.slice(0, 10)}</td>
                    <td>{r.timestamp ? String(r.timestamp).slice(0, 10) : ''}</td>
                    <td>{Number(r.attributed_revenue || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary btn-sm" disabled={!activeRunId} onClick={goToROI}>Go to ROI for this run</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}