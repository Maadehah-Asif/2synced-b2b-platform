import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import { getFilterOptions, getFunnelOverview, type M07Filters } from './funnelInsightsData';

export default function FunnelOverview() {
  const wid = getWorkspaceIdFromHash();
  const [filters, setFilters] = useState<M07Filters>({});
  const options = useMemo(() => getFilterOptions(), []);
  const overview = useMemo(() => getFunnelOverview(filters), [filters]);

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <section className="m07-insight-hero"><div style={{ padding: 28 }}><div className="m07-insight-badge">M07 Funnel Overview</div><h1 className="m07-insight-title">Funnel Overview</h1><div className="m07-insight-subtitle">Track lead movement and conversion across funnel stages, then drill into the exact leads causing bottlenecks.</div></div></section>

        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-label">Filters</div>
          <div className="m07-workspace-formgrid" style={{ marginTop: 14 }}>
            <input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))} />
            <input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))} />
            <select value={filters.source || ''} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value || undefined }))}><option value="">All sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.industry || ''} onChange={(e) => setFilters((p) => ({ ...p, industry: e.target.value || undefined }))}><option value="">All industries</option>{options.industries.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.owner || ''} onChange={(e) => setFilters((p) => ({ ...p, owner: e.target.value || undefined }))}><option value="">All owners</option>{options.owners.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.segment || ''} onChange={(e) => setFilters((p) => ({ ...p, segment: e.target.value || undefined }))}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="m07-workspace-actionsrow"><button className="btn-ghost" onClick={() => setFilters({})}>Reset filters</button></div>
        </section>

        <section className="m07-workspace-panel"><div className="m07-analytics-kpis">
          <StatCard label="Total Leads" value={overview.totalLeads} />
          <StatCard label="Leads in Funnel" value={overview.activeLeads} />
          <StatCard label="Conversion Rate" value={`${overview.conversionRate}%`} />
          <StatCard label="Drop-off Rate" value={`${overview.dropOffRate}%`} />
          <StatCard label="Avg Time in Funnel" value={`${overview.avgTimeInFunnel}d`} />
        </div></section>

        <section className="m07-analytics-grid">
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Funnel Chart</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">Current stage counts and stage-to-stage drop context.</div>
            <div className="m07-funnel-stack" style={{ marginTop: 14 }}>
              {overview.stageCounts.map((item, index) => {
                const next = overview.stageCounts[index + 1];
                const drop = next && item.count ? Math.max(0, Math.round(((item.count - next.count) / item.count) * 100)) : 0;
                return (
                  <div key={item.stage} className="m07-funnel-stage">
                    <div className="m07-funnel-stage-head"><strong>{item.stage}</strong><span>{item.count} leads</span></div>
                    <div className="m07-funnel-bar"><span style={{ width: `${Math.max(14, item.count * 10)}%` }} /></div>
                    {next && <div className="m07-funnel-drop">{drop}% drop to next stage</div>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Stage Distribution</h3>
            <div className="m07-workspace-copy m07-workspace-copy-tight">Current stage occupancy across the active funnel.</div>
            <div className="m07-bar-list" style={{ marginTop: 14 }}>
              {overview.stageCounts.map((item) => (
                <div key={item.stage} className="m07-bar-row">
                  <span>{item.stage}</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill" style={{ width: `${Math.max(8, item.count * 10)}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="m07-workspace-panel">
          <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Conversion Table</h3>
          <div className="m07-workspace-tablewrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead><tr style={{ background: '#f5f7fa' }}><th style={th}>Stage</th><th style={th}>Entered</th><th style={th}>Progressed</th><th style={th}>Dropped</th><th style={th}>Conversion %</th></tr></thead>
              <tbody>{overview.conversionTable.map((row) => <tr key={row.stage}><td style={td}>{row.stage}</td><td style={td}>{row.entered}</td><td style={td}>{row.progressed}</td><td style={td}>{row.dropped}</td><td style={td}>{row.conversion}%</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="m07-workspace-panel">
          <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Lead List</h3>
          <div className="m07-workspace-copy m07-workspace-copy-tight">Click a row to open the lead journey explorer and inspect stage progression with interaction history.</div>
          <div className="m07-workspace-tablewrap" style={{ marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead><tr style={{ background: '#f5f7fa' }}><th style={th}>Lead ID</th><th style={th}>Current Stage</th><th style={th}>Time in Stage</th><th style={th}>Last Interaction</th><th style={th}>Status</th></tr></thead>
              <tbody>{overview.leadsTable.map((row) => <tr key={row.lead_id} onClick={() => { if (wid) window.location.hash = `#/workspace/${wid}/m07/journey/${row.lead_id}`; }} style={{ cursor: wid ? 'pointer' : 'default' }}><td style={td}>{row.lead_id}</td><td style={td}>{row.currentStage}</td><td style={td}>{row.timeInStage}d</td><td style={td}>{row.lastInteractionDate ? new Date(row.lastInteractionDate).toLocaleDateString() : 'No interactions'}</td><td style={td}>{row.status}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <div className="m07-kpi-card"><div className="m07-kpi-label">{label}</div><div className="m07-kpi-value">{value}</div></div>;
}

const th = { padding: 10, textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb', fontSize: 12 };
const td = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 };
