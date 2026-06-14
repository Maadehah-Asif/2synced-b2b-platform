/**
 * Module: Funnel Insight (m07)
 * Layer: Frontend
 * File: LeakageAnalysis.tsx
 * Purpose: Supports the L ea ka ge An al ys is flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens'
import './module7.css'
import { getFilterOptions, getLeakageAnalysis, sampleLeads, type M07Filters } from './funnelInsightsData'

export default function LeakageAnalysis() {
  const [filters, setFilters] = useState<M07Filters>({})
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const options = useMemo(() => getFilterOptions(), [])
  const leakage = useMemo(() => getLeakageAnalysis(filters), [filters])
  const stageRow = leakage.rows.find((row) => row.stage === selectedStage) || null
  const droppedLeads = stageRow ? sampleLeads.filter((lead) => stageRow.droppedLeadIds.includes(lead.lead_id)) : []
  const maxDrop = Math.max(1, ...leakage.rows.map((row) => row.dropRate))
  const maxTime = Math.max(1, ...leakage.rows.map((row) => row.avgTime))

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Leakage" title="Leakage Analysis" subtitle="Detect bottlenecks, heavy-drop stages, and delay pressure before they turn into sustained conversion loss." />

        <InsightPanel eyebrow="Filters" title="Focus the leakage diagnosis" soft>
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
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Highest Leakage Stage" value={leakage.highestLeak?.stage || 'None'} note="Stage currently showing the heaviest drop pressure." tone="amber" />
          <InsightKpiCard label="Total Dropped Leads" value={leakage.totalDropped} note="Visible dropped records in the active leakage view." tone="amber" />
          <InsightKpiCard label="Avg Drop-off Rate" value={`${leakage.avgDropRate}%`} note="Average loss rate across all currently visible stages." tone="slate" />
          <InsightKpiCard label="Longest Delay Stage" value={leakage.longestDelay?.stage || 'None'} note="Area most likely to be compounding drop risk through delay." tone="navy" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Leakage heatmap" title="Stage pressure by severity">
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
          </InsightPanel>

          <InsightPanel eyebrow="Pattern readout" title="Drop-off and delay comparison" soft>
            <div style={{ display: 'grid', gap: 16 }}>
              {leakage.rows.map((row) => (
                <div key={row.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{row.stage}</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{row.dropRate}% drop</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(row.dropRate, maxDrop, 10), background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              {leakage.rows.map((row) => (
                <div key={`${row.stage}-time`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{row.stage} delay</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{row.avgTime}d avg</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(row.avgTime, maxTime, 10) }} />
                  </div>
                </div>
              ))}
            </div>
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Leakage table" title="Stage-by-stage leakage detail">
            <div style={insightTokens.tableWrap}>
              <table style={insightTokens.table}>
                <thead><tr><th style={insightTokens.th}>Stage</th><th style={insightTokens.th}>Dropped Leads</th><th style={insightTokens.th}>Drop %</th><th style={insightTokens.th}>Avg Time</th><th style={insightTokens.th}>Exit Reasons</th></tr></thead>
                <tbody>
                  {leakage.rows.map((row) => (
                    <tr key={row.stage} onClick={() => setSelectedStage(row.stage)} style={{ ...insightTokens.row, cursor: 'pointer' }}>
                      <td style={insightTokens.tdStrong}>{row.stage}</td>
                      <td style={insightTokens.td}>{row.droppedLeads}</td>
                      <td style={insightTokens.td}>{row.dropRate}%</td>
                      <td style={insightTokens.td}>{row.avgTime}d</td>
                      <td style={insightTokens.td}>{row.reasons.length ? row.reasons.join(', ') : 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Interpretation notes" title="How to use this diagnosis" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="High drop with short time" body="Usually points to weak qualification, wrong targeting, or messaging mismatch early in the process." />
              <InsightNoteCard title="High drop with long time" body="Usually signals friction, indecision, or slow owner follow-up before the record eventually falls out." />
              <InsightNoteCard title="Use drilldown on the right stage" body="Select the stage with the most meaningful leakage pattern, then inspect the dropped leads and exit reasons below." />
            </div>
          </InsightPanel>
        </section>

        {stageRow && (
          <InsightPanel eyebrow="Drilldown" title={`${stageRow.stage} drop detail`}>
            <div style={{ ...insightTokens.equalCol, marginTop: 12 }}>
              <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: '#fff' }}>
                <h4>Dropped leads</h4>
                {droppedLeads.length
                  ? droppedLeads.map((lead) => <div key={lead.lead_id} className="m07-list-line">{lead.lead_id} • {lead.full_name}</div>)
                  : <div className="m07-list-line">No dropped leads in this stage.</div>}
              </div>
              <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: '#fff' }}>
                <h4>Exit reasons</h4>
                {stageRow.reasons.length
                  ? stageRow.reasons.map((reason) => <div key={reason} className="m07-list-line">{reason}</div>)
                  : <div className="m07-list-line">Unknown</div>}
              </div>
            </div>
          </InsightPanel>
        )}
      </main>
    </Layout>
  )
}
