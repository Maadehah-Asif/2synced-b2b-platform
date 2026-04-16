import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function IntentForecast() {
  const [segments, setSegments] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [segment, setSegment] = useState('');
  const [industry, setIndustry] = useState('');
  const [horizonMonths, setHorizonMonths] = useState(3);
  const [datasetPath, setDatasetPath] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/m02/forecast/options`).then((r) => r.json()).then((j) => {
      if (!j?.ok) return;
      setSegments(Array.isArray(j.segments) ? j.segments : []);
      setIndustries(Array.isArray(j.industries) ? j.industries : []);
      setDatasetPath(typeof j.datasetPath === 'string' ? j.datasetPath : '');
    }).catch(() => {});
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/m02/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segment || undefined, industry: industry || undefined, horizonMonths }),
      });
      const j = await r.json();
      if (!r.ok) setError(j?.path ? `Dataset missing: ${j.path}` : j?.error || 'Forecast failed.');
      setResult(r.ok ? j : null);
    } catch {
      setError('Unable to run forecast.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <ModuleBackButton toSuffix="/m02" label="Module 2 Home" />
        <section style={hero}>
          <div style={badge}>Forecast</div>
          <h1 style={title}>Intent Forecast Explorer</h1>
          <div style={copy}>Forecast how scored leads are likely to shift across COLD, WARM, HOT, and BLAZING intent bands so Module 2 can prioritize outreach before signal quality cools.</div>
        </section>

        <section style={panel}>
          <div style={badgeDark}>Scenario Setup</div>
          <div style={grid}>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="">All segments</option>
              {segments.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">All industries</option>
              {industries.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={String(horizonMonths)} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="9">9 months</option>
            </select>
            <button className="btn-primary" onClick={run} disabled={loading}>{loading ? 'Generating…' : 'Generate Forecast'}</button>
          </div>
          {datasetPath && <div style={{ marginTop: 10, fontSize: 12, color: '#5a6786' }}>Dataset path: {datasetPath}</div>}
          {error && <div style={{ marginTop: 10, color: 'crimson' }}>{error}</div>}
        </section>

        {result && (
          <>
            <section style={cards}>
              <Card label="Latest Avg Intent" value={result.kpis.latestAvgIntentScore} />
              <Card label="BLAZING Share" value={`${result.history?.[result.history.length - 1]?.blazingRate ?? 0}%`} />
              <Card label="Dormant Leads" value={result.kpis.latestDormantLeads} />
              <Card label="Projected Intent" value={result.kpis.projectedAvgIntentScore} />
            </section>
            <section style={twoCol}>
              <section style={panel}>
                <div style={badgeDark}>History</div>
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Avg Intent</th><th style={th}>COLD %</th><th style={th}>HOT %</th><th style={th}>BLAZING %</th></tr></thead>
                  <tbody>{(result.history || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.avgIntentScore}</td><td style={td}>{row.coldRate}%</td><td style={td}>{row.hotRate}%</td><td style={td}>{row.blazingRate}%</td></tr>)}</tbody>
                </table>
              </section>
              <section style={panel}>
                <div style={badgeDark}>Forecast</div>
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Avg Intent</th><th style={th}>WARM %</th><th style={th}>HOT %</th><th style={th}>BLAZING %</th></tr></thead>
                  <tbody>{(result.forecast || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.projectedAvgIntentScore}</td><td style={td}>{row.projectedWarmRate}%</td><td style={td}>{row.projectedHotRate}%</td><td style={td}>{row.projectedBlazingRate}%</td></tr>)}</tbody>
                </table>
              </section>
            </section>
            <section style={panel}>
              <div style={badgeDark}>Explanation</div>
              <div style={{ marginTop: 12, color: '#415274', lineHeight: 1.8 }}>{result.explanation}</div>
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return <div style={card}><div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5c6a86', fontWeight: 800 }}>{label}</div><div style={{ fontSize: 30, fontWeight: 900, color: '#0B2540', marginTop: 10 }}>{value}</div></div>;
}

const hero: React.CSSProperties = { marginTop: 18, borderRadius: 24, padding: 28, background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)', color: '#fff' };
const panel: React.CSSProperties = { marginTop: 18, borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.06)' };
const badge: React.CSSProperties = { display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' };
const badgeDark: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' };
const title: React.CSSProperties = { margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' };
const copy: React.CSSProperties = { maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 };
const cards: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 18 };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 };
const card: React.CSSProperties = { borderRadius: 18, padding: 18, background: '#fff', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 10px 24px rgba(13,30,60,0.06)' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 12 };
const th: React.CSSProperties = { padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: 12, background: '#f5f7fa' };
const td: React.CSSProperties = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 };
