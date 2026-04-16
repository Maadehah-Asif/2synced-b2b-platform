import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getFatigueAnalysis, getFilterOptions, type M07Filters } from './funnelInsightsData';

export default function FatigueAnalysis() {
  const [filters, setFilters] = useState<M07Filters>({});
  const options = useMemo(() => getFilterOptions(), []);
  const fatigue = useMemo(() => getFatigueAnalysis(filters), [filters]);

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <section className="m07-insight-hero"><div style={{ padding: 28 }}><div className="m07-insight-badge">M07 Fatigue</div><h1 className="m07-insight-title">Engagement Fatigue Monitor</h1><div className="m07-insight-subtitle">Detect over-contacted leads, falling engagement quality, and interaction pressure that could reduce conversion likelihood.</div></div></section>
        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-formgrid">
            <select value={filters.source || ''} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value || undefined }))}><option value="">All sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.owner || ''} onChange={(e) => setFilters((p) => ({ ...p, owner: e.target.value || undefined }))}><option value="">All owners</option>{options.owners.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.segment || ''} onChange={(e) => setFilters((p) => ({ ...p, segment: e.target.value || undefined }))}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </section>
        <section className="m07-workspace-panel"><div className="m07-analytics-kpis">
          <div className="m07-kpi-card"><div className="m07-kpi-label">Total Leads Evaluated</div><div className="m07-kpi-value">{fatigue.totalLeads}</div></div>
          <div className="m07-kpi-card"><div className="m07-kpi-label">Fatigued Leads</div><div className="m07-kpi-value">{fatigue.fatiguedLeads}</div></div>
          <div className="m07-kpi-card"><div className="m07-kpi-label">Avg Interactions per Lead</div><div className="m07-kpi-value">{fatigue.avgInteractions}</div></div>
          <div className="m07-kpi-card"><div className="m07-kpi-label">High-Risk Leads</div><div className="m07-kpi-value">{fatigue.highRiskLeads}</div></div>
        </div></section>

        <section className="m07-analytics-grid">
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Interaction Frequency Chart</h3>
            <div className="m07-bar-list">
              {fatigue.rows.map((row) => (
                <div key={row.lead_id} className="m07-bar-row">
                  <span>{row.lead_id}</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill" style={{ width: `${Math.max(8, row.interactions * 14)}%` }} />
                  </div>
                  <strong>{row.interactions}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Fatigue Distribution</h3>
            <div className="m07-distribution-grid">{['None', 'Low', 'Medium', 'High'].map((level) => <div key={level} className="m07-kpi-card"><div className="m07-kpi-label">{level}</div><div className="m07-kpi-value">{fatigue.rows.filter((row) => row.fatigueLevel === level).length}</div></div>)}</div>
          </section>
        </section>

        <section className="m07-workspace-panel">
          <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Fatigue Table</h3>
          <div className="m07-workspace-tablewrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead><tr style={{ background: '#f5f7fa' }}><th style={th}>Lead</th><th style={th}>Interactions</th><th style={th}>Time Window</th><th style={th}>Engagement Score</th><th style={th}>Fatigue Level</th></tr></thead>
              <tbody>{fatigue.rows.map((row) => <tr key={row.lead_id}><td style={td}>{row.full_name}</td><td style={td}>{row.interactions}</td><td style={td}>{row.timeWindowDays} days</td><td style={td}>{row.avgEngagementScore}</td><td style={td}>{row.fatigueLevel}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </Layout>
  );
}

const th = { padding: 10, textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb', fontSize: 12 };
const td = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 };
