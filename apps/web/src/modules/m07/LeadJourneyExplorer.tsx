import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens'
import './module7.css'
import { getLeadJourney, sampleLeads } from './funnelInsightsData'

function getLeadIdFromHash() {
  const match = (window.location.hash || '').match(/\/m07\/journey\/([^/?]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export default function LeadJourneyExplorer() {
  const leadId = getLeadIdFromHash()
  const journey = getLeadJourney(leadId)
  const stageDurations = journey.stageEvents.map((item) => ({
    stage: item.stage_name,
    days: item.exited_at
      ? Math.max(0, Math.round((new Date(item.exited_at).getTime() - new Date(item.entered_at).getTime()) / (1000 * 60 * 60 * 24)))
      : Math.max(0, Math.round((new Date('2026-04-01').getTime() - new Date(item.entered_at).getTime()) / (1000 * 60 * 60 * 24))),
    status: item.stage_status,
  }))
  const maxDuration = Math.max(1, ...stageDurations.map((item) => item.days))
  const avgEngagement = journey.interactions.length ? Math.round(journey.interactions.reduce((sum, item) => sum + item.engagement_score, 0) / journey.interactions.length) : 0

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Journey" title="Lead Journey Explorer" subtitle="Understand why one lead converted, stalled, or dropped by reading stage history together with interaction events in one timeline." />

        {!journey.lead ? (
          <InsightPanel eyebrow="Journey unavailable" title="Lead not found" soft>
            <div style={insightTokens.mutedText}>The selected journey route does not point to a known lead record.</div>
          </InsightPanel>
        ) : (
          <>
            <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Lead selection" title="Choose the lead journey to inspect">
                <select
                  value={journey.lead.lead_id}
                  onChange={(event) => { window.location.hash = `#/workspace/${(window.location.hash.match(/#\/workspace\/([^/]+)/)?.[1] || '')}/m07/journey/${event.target.value}` }}
                  style={{ width: '100%' }}
                >
                  {sampleLeads.map((lead) => <option key={lead.lead_id} value={lead.lead_id}>{lead.lead_id} • {lead.full_name} • {lead.company}</option>)}
                </select>
              </InsightPanel>

              <InsightPanel eyebrow="Lead profile" title={journey.lead.full_name} soft>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Lead ID:</strong> {journey.lead.lead_id}</div>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Company:</strong> {journey.lead.company}</div>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Source:</strong> {journey.lead.source}</div>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Owner:</strong> {journey.lead.owner}</div>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Lead score:</strong> {journey.lead.lead_score}</div>
                  <div style={insightTokens.mutedText}><strong style={{ color: '#0B2540' }}>Intent score:</strong> {journey.lead.intent_score}</div>
                </div>
              </InsightPanel>
            </section>

            <InsightKpiGrid>
              <InsightKpiCard label="Stage Events" value={journey.stageEvents.length} note="Recorded stage transitions in this lead path." tone="navy" />
              <InsightKpiCard label="Interactions" value={journey.totalInteractions} note="Observed interaction events linked to the lead." tone="teal" />
              <InsightKpiCard label="Avg Engagement" value={avgEngagement} note="Average interaction quality score across the recorded history." tone="slate" />
              <InsightKpiCard label="Final Status" value={journey.finalStatus} note={`Total visible funnel time: ${journey.totalTime} days.`} tone="amber" />
            </InsightKpiGrid>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Journey timeline" title="Chronological lead story">
                <div className="m07-timeline">
                  {journey.timeline.map((item, index) => (
                    <div key={`${item.kind}-${index}`} className="m07-timeline-item">
                      <div className={`m07-timeline-dot ${item.kind}`}></div>
                      <div className="m07-timeline-body">
                        <div className="m07-timeline-date">{new Date(item.date).toLocaleString()}</div>
                        <div className="m07-timeline-title">{item.title}</div>
                        <div className="m07-timeline-subtitle">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </InsightPanel>

              <InsightPanel eyebrow="Stage duration" title="Where the lead spent the most time" soft>
                <div style={{ display: 'grid', gap: 14 }}>
                  {stageDurations.map((item, index) => (
                    <div key={`${item.stage}-${index}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <strong style={{ color: '#0B2540', fontSize: 14 }}>{item.stage}</strong>
                        <span style={{ fontSize: 13, color: '#415274' }}>{item.days} days</span>
                      </div>
                      <div style={insightTokens.track}>
                        <div style={{ ...insightTokens.fill, width: insightBarWidth(item.days, maxDuration, 10), background: item.status === 'dropped' ? 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' : undefined }} />
                      </div>
                    </div>
                  ))}
                </div>
              </InsightPanel>
            </section>

            <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Stage detail" title="Stage history detail">
                <div style={insightTokens.tableWrap}>
                  <table style={insightTokens.table}>
                    <thead><tr><th style={insightTokens.th}>Stage</th><th style={insightTokens.th}>Entered</th><th style={insightTokens.th}>Exited</th><th style={insightTokens.th}>Status</th></tr></thead>
                    <tbody>{journey.stageEvents.map((item) => <tr key={item.id} style={insightTokens.row}><td style={insightTokens.tdStrong}>{item.stage_name}</td><td style={insightTokens.td}>{item.entered_at}</td><td style={insightTokens.td}>{item.exited_at || 'Active'}</td><td style={insightTokens.td}>{item.stage_status}</td></tr>)}</tbody>
                  </table>
                </div>
              </InsightPanel>

              <InsightPanel eyebrow="Interaction detail" title="Interaction history detail" soft>
                <div style={insightTokens.tableWrap}>
                  <table style={insightTokens.table}>
                    <thead><tr><th style={insightTokens.th}>When</th><th style={insightTokens.th}>Type</th><th style={insightTokens.th}>Outcome</th><th style={insightTokens.th}>Score</th></tr></thead>
                    <tbody>{journey.interactions.map((item) => <tr key={item.id} style={insightTokens.row}><td style={insightTokens.td}>{new Date(item.timestamp).toLocaleString()}</td><td style={insightTokens.tdStrong}>{item.interaction_type}</td><td style={insightTokens.td}>{item.outcome}</td><td style={insightTokens.td}>{item.engagement_score}</td></tr>)}</tbody>
                  </table>
                </div>
              </InsightPanel>
            </section>

            <InsightPanel eyebrow="Journey interpretation" title="What this lead path suggests">
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Look for the longest stage first" body="The stage with the longest duration is usually the first place to inspect for owner delay, friction, or weak qualification." />
                <InsightNoteCard title="Compare stage and interaction signals" body="If interaction volume is high but engagement is weakening, the issue is often outreach quality rather than lack of activity." />
                <InsightNoteCard title="Use this after overview or leakage" body="Journey Explorer is most useful once overview, leakage, or fatigue has already pointed you toward a specific lead or stage problem." />
              </div>
            </InsightPanel>
          </>
        )}
      </main>
    </Layout>
  )
}
