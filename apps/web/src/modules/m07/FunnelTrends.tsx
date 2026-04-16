import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getFilterOptions, getTrendSeries } from './funnelInsightsData';

export default function FunnelTrends() {
  const [segment, setSegment] = useState('');
  const [source, setSource] = useState('');
  const options = useMemo(() => getFilterOptions(), []);
  const series = useMemo(() => getTrendSeries({ segment: segment || undefined, source: source || undefined }), [segment, source]);

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <section className="m07-insight-hero"><div style={{ padding: 28 }}><div className="m07-insight-badge">M07 Trends</div><h1 className="m07-insight-title">Funnel Trends</h1><div className="m07-insight-subtitle">Track conversion pace, stage movement, and pipeline growth over time so trend shifts are visible before performance drops.</div></div></section>
        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-formgrid">
            <input type="date" />
            <input type="date" />
            <select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All campaigns/sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </section>

        <section className="m07-analytics-grid">
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Conversion Over Time</h3>
            <div className="m07-bar-list">
              {series.map((row) => (
                <div key={row.label} className="m07-bar-row">
                  <span>{row.label}</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill" style={{ width: `${Math.max(8, row.conversionRate)}%` }} />
                  </div>
                  <strong>{row.conversionRate}%</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Stage Movement Over Time</h3>
            <div className="m07-bar-list">
              {series.map((row) => (
                <div key={`${row.label}-movement`} className="m07-bar-row">
                  <span>{row.label}</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill" style={{ width: `${Math.max(8, row.stageMovement * 8)}%` }} />
                  </div>
                  <strong>{row.stageMovement}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="m07-workspace-panel">
          <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Pipeline Growth</h3>
          <div className="m07-workspace-tablewrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead><tr style={{ background: '#f5f7fa' }}><th style={th}>Period</th><th style={th}>Leads Added</th><th style={th}>Stage Movement</th><th style={th}>Conversion Rate</th><th style={th}>Dropped</th></tr></thead>
              <tbody>{series.map((row) => <tr key={row.label}><td style={td}>{row.label}</td><td style={td}>{row.leadsAdded}</td><td style={td}>{row.stageMovement}</td><td style={td}>{row.conversionRate}%</td><td style={td}>{row.dropped}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </Layout>
  );
}

const th = { padding: 10, textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb', fontSize: 12 };
const td = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 };
