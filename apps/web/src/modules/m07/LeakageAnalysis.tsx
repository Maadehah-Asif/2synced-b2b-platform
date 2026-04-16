import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import './module7.css';
import { getFilterOptions, getLeakageAnalysis, sampleLeads, type M07Filters } from './funnelInsightsData';

export default function LeakageAnalysis() {
  const [filters, setFilters] = useState<M07Filters>({});
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const options = useMemo(() => getFilterOptions(), []);
  const leakage = useMemo(() => getLeakageAnalysis(filters), [filters]);
  const stageRow = leakage.rows.find((row) => row.stage === selectedStage) || null;
  const droppedLeads = stageRow ? sampleLeads.filter((lead) => stageRow.droppedLeadIds.includes(lead.lead_id)) : [];

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow">
          <ModuleBackButton toSuffix="/m07" />
        </div>

        <section className="m07-insight-hero">
          <div style={{ padding: 28 }}>
            <div className="m07-insight-badge">M07 Leakage</div>
            <h1 className="m07-insight-title">Leakage Analysis</h1>
            <div className="m07-insight-subtitle">
              Detect bottlenecks, high-drop stages, and delay-heavy parts of the funnel before they turn into conversion loss.
            </div>
          </div>
        </section>

        <section className="m07-workspace-panel m07-workspace-panel-soft">
          <div className="m07-workspace-formgrid">
            <select value={filters.source || ''} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value || undefined }))}>
              <option value="">All sources</option>
              {options.sources.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.industry || ''} onChange={(e) => setFilters((p) => ({ ...p, industry: e.target.value || undefined }))}>
              <option value="">All industries</option>
              {options.industries.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.owner || ''} onChange={(e) => setFilters((p) => ({ ...p, owner: e.target.value || undefined }))}>
              <option value="">All owners</option>
              {options.owners.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.segment || ''} onChange={(e) => setFilters((p) => ({ ...p, segment: e.target.value || undefined }))}>
              <option value="">All segments</option>
              {options.segments.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </section>

        <section className="m07-workspace-panel">
          <div className="m07-analytics-kpis">
            <Kpi label="Highest Leakage Stage" value={leakage.highestLeak?.stage || 'None'} />
            <Kpi label="Total Dropped Leads" value={leakage.totalDropped} />
            <Kpi label="Avg Drop-off Rate" value={`${leakage.avgDropRate}%`} />
            <Kpi label="Stage with Longest Delay" value={leakage.longestDelay?.stage || 'None'} />
          </div>
        </section>

        <section className="m07-analytics-grid">
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Leakage Heatmap</h3>
            <div className="m07-heatmap-grid">
              {leakage.rows.map((row) => (
                <button
                  key={row.stage}
                  className={`m07-heatmap-cell ${row.dropRate >= 50 ? 'high' : row.dropRate >= 25 ? 'medium' : 'low'} ${selectedStage === row.stage ? 'active' : ''}`}
                  onClick={() => setSelectedStage(row.stage)}
                >
                  <strong>{row.stage}</strong>
                  <span>{row.dropRate}% drop</span>
                  <small>{row.avgTime} avg days</small>
                </button>
              ))}
            </div>
          </section>

          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Drop-off & Time in Stage</h3>
            <div className="m07-bar-list">
              {leakage.rows.map((row) => (
                <div key={row.stage} className="m07-bar-row">
                  <span>{row.stage}</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill danger" style={{ width: `${Math.max(6, row.dropRate)}%` }} />
                  </div>
                  <strong>{row.dropRate}%</strong>
                </div>
              ))}
            </div>
            <div className="m07-bar-list" style={{ marginTop: 18 }}>
              {leakage.rows.map((row) => (
                <div key={`${row.stage}-time`} className="m07-bar-row">
                  <span>{row.stage} time</span>
                  <div className="m07-bar-track">
                    <div className="m07-bar-fill" style={{ width: `${Math.max(8, row.avgTime * 4)}%` }} />
                  </div>
                  <strong>{row.avgTime}d</strong>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="m07-workspace-panel">
          <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>Leakage Table</h3>
          <div className="m07-workspace-tablewrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f5f7fa' }}>
                  <th style={th}>Stage</th>
                  <th style={th}>Dropped Leads</th>
                  <th style={th}>Drop %</th>
                  <th style={th}>Avg Time</th>
                  <th style={th}>Exit Reasons</th>
                </tr>
              </thead>
              <tbody>
                {leakage.rows.map((row) => (
                  <tr key={row.stage} onClick={() => setSelectedStage(row.stage)} style={{ cursor: 'pointer' }}>
                    <td style={td}>{row.stage}</td>
                    <td style={td}>{row.droppedLeads}</td>
                    <td style={td}>{row.dropRate}%</td>
                    <td style={td}>{row.avgTime}d</td>
                    <td style={td}>{row.reasons.length ? row.reasons.join(', ') : 'Unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {stageRow && (
          <section className="m07-workspace-panel">
            <h3 className="m07-workspace-title" style={{ marginTop: 0 }}>{stageRow.stage} drilldown</h3>
            <div className="m07-analytics-grid" style={{ marginTop: 12 }}>
              <div className="m07-card-lite">
                <h4>Dropped leads</h4>
                {droppedLeads.length
                  ? droppedLeads.map((lead) => <div key={lead.lead_id} className="m07-list-line">{lead.lead_id} • {lead.full_name}</div>)
                  : <div className="m07-list-line">No dropped leads in this stage.</div>}
              </div>
              <div className="m07-card-lite">
                <h4>Exit reasons</h4>
                {stageRow.reasons.length
                  ? stageRow.reasons.map((reason) => <div key={reason} className="m07-list-line">{reason}</div>)
                  : <div className="m07-list-line">Unknown</div>}
              </div>
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="m07-kpi-card"><div className="m07-kpi-label">{label}</div><div className="m07-kpi-value">{value}</div></div>;
}

const th = { padding: 10, textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb', fontSize: 12 };
const td = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 };
