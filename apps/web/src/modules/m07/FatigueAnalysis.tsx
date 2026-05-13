import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens'
import './module7.css'
import { getFatigueAnalysis, getFilterOptions, type M07Filters } from './funnelInsightsData'

export default function FatigueAnalysis() {
  const [filters, setFilters] = useState<M07Filters>({})
  const options = useMemo(() => getFilterOptions(), [])
  const fatigue = useMemo(() => getFatigueAnalysis(filters), [filters])
  const maxInteractions = Math.max(1, ...fatigue.rows.map((row) => row.interactions))
  const fatigueLevels = ['None', 'Low', 'Medium', 'High'] as const

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Fatigue" title="Engagement Fatigue Monitor" subtitle="Detect over-contacted leads, falling engagement quality, and interaction pressure that could reduce conversion likelihood." />

        <InsightPanel eyebrow="Filters" title="Focus the fatigue review" soft>
          <div className="m07-workspace-formgrid">
            <select value={filters.source || ''} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value || undefined }))}><option value="">All sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.owner || ''} onChange={(e) => setFilters((p) => ({ ...p, owner: e.target.value || undefined }))}><option value="">All owners</option>{options.owners.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.segment || ''} onChange={(e) => setFilters((p) => ({ ...p, segment: e.target.value || undefined }))}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Total Leads Evaluated" value={fatigue.totalLeads} note="Records currently included in the interaction-pressure check." tone="navy" />
          <InsightKpiCard label="Fatigued Leads" value={fatigue.fatiguedLeads} note="Leads already showing elevated contact pressure." tone="amber" />
          <InsightKpiCard label="Avg Interactions per Lead" value={fatigue.avgInteractions} note="Current activity density across the filtered set." tone="slate" />
          <InsightKpiCard label="High-Risk Leads" value={fatigue.highRiskLeads} note="Records most likely to need outreach pacing changes." tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Interaction pressure" title="Frequency by lead">
            <div style={{ display: 'grid', gap: 14 }}>
              {fatigue.rows.map((row) => (
                <div key={row.lead_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{row.full_name}</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{row.interactions} interactions</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(row.interactions, maxInteractions, 10), background: 'linear-gradient(135deg, #0f4258 0%, #1d4ed8 100%)' }} />
                  </div>
                </div>
              ))}
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Risk mix" title="Fatigue distribution" soft>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {fatigueLevels.map((level) => (
                <div key={level} style={{ borderRadius: 16, padding: 16, background: '#fff', border: '1px solid rgba(15,66,88,0.08)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>{level}</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: '#0B2540' }}>{fatigue.rows.filter((row) => row.fatigueLevel === level).length}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <InsightNoteCard title="What high fatigue means" body="High fatigue usually signals too many touches in too short a period or steadily worsening engagement quality during repeated outreach." />
              <InsightNoteCard title="What to do next" body="Reduce outreach pressure, rotate channels, or shift the follow-up cadence before those leads become non-responsive." />
            </div>
          </InsightPanel>
        </section>

        <InsightPanel eyebrow="Fatigue table" title="Lead-level fatigue detail">
          <div style={insightTokens.tableWrap}>
            <table style={insightTokens.table}>
              <thead><tr><th style={insightTokens.th}>Lead</th><th style={insightTokens.th}>Interactions</th><th style={insightTokens.th}>Time Window</th><th style={insightTokens.th}>Engagement Score</th><th style={insightTokens.th}>Fatigue Level</th></tr></thead>
              <tbody>{fatigue.rows.map((row) => <tr key={row.lead_id} style={insightTokens.row}><td style={insightTokens.tdStrong}>{row.full_name}</td><td style={insightTokens.td}>{row.interactions}</td><td style={insightTokens.td}>{row.timeWindowDays} days</td><td style={insightTokens.td}>{row.avgEngagementScore}</td><td style={insightTokens.td}>{row.fatigueLevel}</td></tr>)}</tbody>
            </table>
          </div>
        </InsightPanel>
      </main>
    </Layout>
  )
}
