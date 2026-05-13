import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome';
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens';
import './module7.css';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import { getFilterOptions, getFunnelOverview, type M07Filters } from './funnelInsightsData';

export default function FunnelOverview() {
  const wid = getWorkspaceIdFromHash();
  const [filters, setFilters] = useState<M07Filters>({});
  const options = useMemo(() => getFilterOptions(), []);
  const overview = useMemo(() => getFunnelOverview(filters), [filters]);
  const maxStageCount = Math.max(1, ...overview.stageCounts.map((item) => item.count));
  const mostLoadedStage = overview.stageCounts[0] || null;

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Overview" title="Funnel Overview" subtitle="Track lead movement, conversion pace, and stage concentration in one calmer operating view before drilling into the exact records causing friction." />

        <InsightPanel eyebrow="Filters" title="Scope the active funnel view" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{overview.stageCounts.length} stages visible</div>}>
          <div className="m07-workspace-formgrid" style={{ marginTop: 14 }}>
            <input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))} />
            <input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))} />
            <select value={filters.source || ''} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value || undefined }))}><option value="">All sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.industry || ''} onChange={(e) => setFilters((p) => ({ ...p, industry: e.target.value || undefined }))}><option value="">All industries</option>{options.industries.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.owner || ''} onChange={(e) => setFilters((p) => ({ ...p, owner: e.target.value || undefined }))}><option value="">All owners</option>{options.owners.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.segment || ''} onChange={(e) => setFilters((p) => ({ ...p, segment: e.target.value || undefined }))}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="m07-workspace-actionsrow"><button className="btn-ghost" onClick={() => setFilters({})}>Reset filters</button></div>
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Total Leads" value={overview.totalLeads} note="All currently visible funnel records in the selected scope." tone="navy" />
          <InsightKpiCard label="Leads in Funnel" value={overview.activeLeads} note="Records still moving through live stage progression." tone="teal" />
          <InsightKpiCard label="Conversion Rate" value={`${overview.conversionRate}%`} note="Share of records progressing into successful downstream outcomes." tone="teal" />
          <InsightKpiCard label="Drop-off Rate" value={`${overview.dropOffRate}%`} note="Current funnel loss across the same visible population." tone="amber" />
          <InsightKpiCard label="Avg Time in Funnel" value={`${overview.avgTimeInFunnel}d`} note="Average duration spent in the current funnel path." tone="slate" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Funnel shape" title="Current stage progression">
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
          </InsightPanel>

          <InsightPanel eyebrow="Operating readout" title="Stage occupancy summary" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              {overview.stageCounts.map((item) => (
                <div key={item.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, alignItems: 'baseline' }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{item.stage}</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{item.count} leads</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(item.count, maxStageCount, 12) }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
              <InsightMiniStat label="Most loaded stage" value={mostLoadedStage?.stage || 'None'} />
              <InsightMiniStat label="Largest stage count" value={mostLoadedStage?.count || 0} />
              <InsightMiniStat label="Visible stages" value={overview.stageCounts.length} />
            </div>
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Conversion detail" title="Stage conversion table">
            <div style={insightTokens.tableWrap}>
              <table style={insightTokens.table}>
                <thead><tr><th style={insightTokens.th}>Stage</th><th style={insightTokens.th}>Entered</th><th style={insightTokens.th}>Progressed</th><th style={insightTokens.th}>Dropped</th><th style={insightTokens.th}>Conversion %</th></tr></thead>
                <tbody>{overview.conversionTable.map((row) => <tr key={row.stage} style={insightTokens.row}><td style={insightTokens.tdStrong}>{row.stage}</td><td style={insightTokens.td}>{row.entered}</td><td style={insightTokens.td}>{row.progressed}</td><td style={insightTokens.td}>{row.dropped}</td><td style={insightTokens.td}>{row.conversion}%</td></tr>)}</tbody>
              </table>
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Reading guide" title="How to interpret this view" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Start with concentration" body="If one stage holds a disproportionate share of records, check whether qualification, follow-up, or approval steps are slowing movement there." />
              <InsightNoteCard title="Use drop context next" body="Large stage-to-stage drop percentages usually indicate messaging mismatch, process friction, or weak handoff quality between owners." />
              <InsightNoteCard title="Open lead journeys after this" body="When a stage looks overloaded or leaky, move into Lead Journey Explorer to inspect the exact lead histories behind the pattern." />
            </div>
          </InsightPanel>
        </section>

        <InsightPanel eyebrow="Lead drilldown" title="Records behind the current funnel state">
          <div style={{ ...insightTokens.mutedText, marginBottom: 12 }}>Click a row to open the lead journey explorer and inspect stage progression with interaction history.</div>
          <div style={insightTokens.tableWrap}>
            <table style={insightTokens.table}>
              <thead><tr><th style={insightTokens.th}>Lead ID</th><th style={insightTokens.th}>Current Stage</th><th style={insightTokens.th}>Time in Stage</th><th style={insightTokens.th}>Last Interaction</th><th style={insightTokens.th}>Status</th></tr></thead>
              <tbody>{overview.leadsTable.map((row) => <tr key={row.lead_id} onClick={() => { if (wid) window.location.hash = `#/workspace/${wid}/m07/journey/${row.lead_id}`; }} style={{ ...insightTokens.row, cursor: wid ? 'pointer' : 'default' }}><td style={insightTokens.tdStrong}>{row.lead_id}</td><td style={insightTokens.td}>{row.currentStage}</td><td style={insightTokens.td}>{row.timeInStage}d</td><td style={insightTokens.td}>{row.lastInteractionDate ? new Date(row.lastInteractionDate).toLocaleDateString() : 'No interactions'}</td><td style={insightTokens.td}>{row.status}</td></tr>)}</tbody>
            </table>
          </div>
        </InsightPanel>
      </main>
    </Layout>
  );
}
