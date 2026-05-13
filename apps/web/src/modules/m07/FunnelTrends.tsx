import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens'
import './module7.css'
import { getFilterOptions, getTrendSeries } from './funnelInsightsData'

export default function FunnelTrends() {
  const [segment, setSegment] = useState('')
  const [source, setSource] = useState('')
  const options = useMemo(() => getFilterOptions(), [])
  const series = useMemo(() => getTrendSeries({ segment: segment || undefined, source: source || undefined }), [segment, source])
  const latest = series[series.length - 1]
  const maxConversion = Math.max(1, ...series.map((row) => row.conversionRate))
  const maxMovement = Math.max(1, ...series.map((row) => row.stageMovement))
  const strongestConversion = [...series].sort((a, b) => b.conversionRate - a.conversionRate)[0]
  const highestMovement = [...series].sort((a, b) => b.stageMovement - a.stageMovement)[0]
  const totalDropped = series.reduce((sum, row) => sum + row.dropped, 0)
  const totalAdded = series.reduce((sum, row) => sum + row.leadsAdded, 0)

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Trends" title="Funnel Trends" subtitle="Track conversion pace, stage movement, and pipeline growth over time so trend shifts are visible before performance drops." />

        <InsightPanel eyebrow="Filters" title="Choose the trend slice" soft>
          <div className="m07-workspace-formgrid">
            <select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All campaigns or sources</option>{options.sources.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">All segments</option>{options.segments.map((item) => <option key={item}>{item}</option>)}</select>
            <div style={{ ...insightTokens.panelSoft, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>Trend Scope</div>
              <div style={{ marginTop: 6, color: '#0B2540', fontWeight: 700 }}>Monthly funnel movement snapshot</div>
              <div style={{ marginTop: 6, ...insightTokens.mutedText }}>This view reads the monthly trend blocks available in the current funnel dataset rather than a custom date picker.</div>
            </div>
          </div>
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Latest Conversion" value={`${latest?.conversionRate ?? 0}%`} note="Most recent conversion rate in the filtered timeline." tone="teal" />
          <InsightKpiCard label="Latest Movement" value={latest?.stageMovement ?? 0} note="Latest visible stage transitions across the selected trend slice." tone="navy" />
          <InsightKpiCard label="Latest Leads Added" value={latest?.leadsAdded ?? 0} note="Newest period of funnel growth in the active scope." tone="slate" />
          <InsightKpiCard label="Latest Dropped" value={latest?.dropped ?? 0} note="Current drop volume at the end of the visible trend window." tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Conversion trend" title="Conversion over time">
            <div style={{ display: 'grid', gap: 14 }}>
              {series.map((row) => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{row.label}</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{row.conversionRate}%</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(row.conversionRate, maxConversion, 10), background: 'linear-gradient(135deg, #0F766E 0%, #14b8a6 100%)' }} />
                  </div>
                </div>
              ))}
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Movement trend" title="Stage movement over time" soft>
            <div style={{ display: 'grid', gap: 14 }}>
              {series.map((row) => (
                <div key={`${row.label}-movement`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ color: '#0B2540', fontSize: 14 }}>{row.label}</strong>
                    <span style={{ fontSize: 13, color: '#415274' }}>{row.stageMovement}</span>
                  </div>
                  <div style={insightTokens.track}>
                    <div style={{ ...insightTokens.fill, width: insightBarWidth(row.stageMovement, maxMovement, 10) }} />
                  </div>
                </div>
              ))}
            </div>
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Pipeline growth" title="Time-based funnel table">
            <div style={insightTokens.tableWrap}>
              <table style={insightTokens.table}>
                <thead><tr><th style={insightTokens.th}>Period</th><th style={insightTokens.th}>Leads Added</th><th style={insightTokens.th}>Stage Movement</th><th style={insightTokens.th}>Conversion Rate</th><th style={insightTokens.th}>Dropped</th></tr></thead>
                <tbody>{series.map((row) => <tr key={row.label} style={insightTokens.row}><td style={insightTokens.tdStrong}>{row.label}</td><td style={insightTokens.td}>{row.leadsAdded}</td><td style={insightTokens.td}>{row.stageMovement}</td><td style={insightTokens.td}>{row.conversionRate}%</td><td style={insightTokens.td}>{row.dropped}</td></tr>)}</tbody>
              </table>
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Trend notes" title="How to read this timeline" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <InsightNoteCard title="Best conversion month" body={strongestConversion ? `${strongestConversion.label} is currently the strongest conversion period at ${strongestConversion.conversionRate}%.` : 'No conversion peak available.'} />
                <InsightNoteCard title="Highest movement month" body={highestMovement ? `${highestMovement.label} shows the heaviest stage movement volume at ${highestMovement.stageMovement} transitions.` : 'No movement peak available.'} />
              </div>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <InsightKpiCard label="Leads Added" value={totalAdded} note="Combined new lead inflow across the visible monthly trend blocks." tone="slate" />
                <InsightKpiCard label="Dropped Across Trend" value={totalDropped} note="Combined lead drops across the same visible trend periods." tone="amber" />
              </div>
              <InsightNoteCard title="Watch conversion first" body="If conversion weakens while leads added stays stable, the issue is usually operational quality rather than top-of-funnel volume." />
              <InsightNoteCard title="Read movement alongside drops" body="High stage movement is only positive when drops do not rise at the same time. Otherwise the process may be moving quickly but leaking." />
              <InsightNoteCard title="Use trends before recommendations" body="Trend shifts help confirm whether a leakage or fatigue issue is isolated or becoming a broader recurring pattern." />
            </div>
          </InsightPanel>
        </section>
      </main>
    </Layout>
  )
}
