import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import useLeakagePrediction from './useLeakagePrediction';

function getWorkspaceId() {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function LeakagePredictionPage() {
  const workspaceId = getWorkspaceId();
  const [stagesFilter] = useState<string[]>([]);
  const [bucketsFilter] = useState<Array<'LOW'|'MEDIUM'|'HIGH'>>([]);

  const { data, loading, error, refetch, runPrediction } = useLeakagePrediction(workspaceId, { stages: stagesFilter, riskBuckets: bucketsFilter });

  const kpis = data?.kpis;
  const buckets = data?.riskDistribution?.buckets || [];
  const highRiskLeads = data?.highRiskLeads || [];
  const stageSummary = data?.stageRiskSummary || [];
  const modelConfidence = data?.modelConfidence || null;

  const riskTotal = useMemo(() => buckets.reduce((s: number, b: any) => s + (b.count || 0), 0), [buckets]);

  return (
    <Layout>
      <main className="page-root">
        <div style={{ padding: '24px 24px 0' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#0B2540', fontSize: '28px', fontWeight: 800 }}>
            Leakage Prediction & Risk Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Predicted lead leakage probabilities and risk distribution</p>
            <div style={{ marginTop: '12px' }}>
            <ModuleBackButton toSuffix={'/module7'} />
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 12 }}>Model: {modelConfidence?.modelVersion || 'v1'}</div>
              <div style={{ fontSize: 12 }}>Last run: {kpis?.lastRun?.startedAt ? new Date(kpis.lastRun.startedAt).toLocaleString() : 'n/a'}</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => runPrediction()} className="btn btn-primary" disabled={loading}>{loading ? 'Running...' : 'Run Leakage Prediction'}</button>
                <button onClick={() => refetch()} className="btn" style={{ marginLeft: 8 }}>Refresh</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div className="card p-4">
                <div style={{ fontSize: 12, color: '#666' }}>Total scored leads</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{kpis?.totalScoredLeads ?? 0}</div>
              </div>
              <div className="card p-4">
                <div style={{ fontSize: 12, color: '#666' }}>High risk</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#b91c1c' }}>{kpis?.highRiskCount ?? 0}</div>
              </div>
              <div className="card p-4">
                <div style={{ fontSize: 12, color: '#666' }}>Most risky stage</div>
                <div style={{ fontSize: 16 }}>{kpis?.mostRiskyStage ?? '—'}</div>
              </div>
              <div className="card p-4">
                <div style={{ fontSize: 12, color: '#666' }}>Risk total</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{riskTotal}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Risk Distribution</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {buckets.map((b: any) => (
                <div key={b.bucket} className="card p-4" style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 12 }}>{b.bucket}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{b.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>High-Risk Leads</h3>
            {loading ? <div>Loading...</div> : error ? <div style={{ color: '#b91c1c' }}>{error}</div> : (
              <div className="card p-4">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Company</th>
                      <th>Stage</th>
                      <th>Probability</th>
                      <th>Time in stage</th>
                      <th>Last touch</th>
                      <th>Owner</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highRiskLeads.map((r: any) => (
                      <tr key={r.leadId}>
                        <td>{r.leadName || '—'}</td>
                        <td>{r.company || '—'}</td>
                        <td>{r.currentStage || '—'}</td>
                        <td><span style={{ padding: '4px 8px', borderRadius: 6, background: r.leakageProbability >= 0.7 ? '#fee2e2' : r.leakageProbability >= 0.3 ? '#fef3c7' : '#ecfdf5' }}>{Math.round(r.leakageProbability * 100)}%</span></td>
                        <td>{r.timeInStageDays ? `${r.timeInStageDays.toFixed(1)}d` : '—'}</td>
                        <td>{r.lastTouchAt ? new Date(r.lastTouchAt).toLocaleString() : '—'}</td>
                        <td>{r.ownerName || '—'}</td>
                        <td>{r.status || 'NEW'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Stage-Level Risk Summary</h3>
            <div className="card p-4">
              <table className="w-full">
                <thead>
                  <tr><th>Stage</th><th>Avg Probability</th><th>High-risk</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {stageSummary.map((s: any) => (
                    <tr key={s.stage}><td>{s.stage}</td><td>{Math.round((s.avgLeakageProbability || 0) * 100)}%</td><td>{s.highRiskCount}</td><td>{s.totalLeads}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Model Confidence</h3>
            <div className="card p-4">
              {modelConfidence ? (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div>Model version</div>
                    <div style={{ fontWeight: 700 }}>{modelConfidence.modelVersion}</div>
                    <div>AUC: {modelConfidence.auc ?? 'n/a'}</div>
                    <div>Accuracy: {modelConfidence.accuracy ?? 'n/a'}</div>
                    <div>Samples: {modelConfidence.totalSamples ?? 'n/a'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>Top features</div>
                    {modelConfidence.topFeatures && modelConfidence.topFeatures.length ? modelConfidence.topFeatures.map((f: any) => (
                      <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 140 }}>{f.feature}</div><div style={{ flex: 1, background: '#f3f4f6', height: 8 }}><div style={{ width: `${Math.round((f.importance||0)*100)}%`, height: 8, background: '#0ea5e9' }} /></div></div>
                    )) : <div style={{ color: '#6b7280' }}>No feature data</div>}
                  </div>
                </div>
              ) : <div style={{ color: '#6b7280' }}>No model run data available</div>}
              <div style={{ marginTop: 8, fontStyle: 'italic', color: '#6b7280' }}>This model is directional and requires human judgment.</div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
