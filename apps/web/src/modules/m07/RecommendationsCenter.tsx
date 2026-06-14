/**
 * Module: Funnel Insight (m07)
 * Layer: Frontend
 * File: RecommendationsCenter.tsx
 * Purpose: Supports the R ec om me nd at io ns Ce nt er flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightBarWidth, insightTokens } from '../../components/insightChromeTokens'
import './module7.css'
import { getRecommendations } from './funnelInsightsData'

export default function RecommendationsCenter() {
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const cards = useMemo(() => getRecommendations(), [])
  const visible = cards.filter((card) => (!typeFilter || card.type === typeFilter) && (!priorityFilter || card.priority === priorityFilter) && (!ownerFilter || card.owner === ownerFilter))
  const highPriority = visible.filter((card) => card.priority === 'High').length
  const ownerCounts = visible.reduce<Record<string, number>>((acc, card) => {
    acc[card.owner] = (acc[card.owner] || 0) + 1
    return acc
  }, {})
  const maxOwnerCount = Math.max(1, ...Object.values(ownerCounts))
  const ownerLoad = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])
  const typeMix = Object.entries(visible.reduce<Record<string, number>>((acc, card) => {
    acc[card.type] = (acc[card.type] || 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1])
  const maxTypeCount = Math.max(1, ...typeMix.map(([, count]) => count))
  const topConfidence = visible.length ? Math.max(...visible.map((card) => card.confidence)) : 0

  return (
    <Layout>
      <main className="page-root m07-workspace-page" style={{ padding: 20 }}>
        <div className="m07-workspace-toprow"><ModuleBackButton toSuffix="/m07" /></div>
        <InsightHero eyebrow="Funnel Insight Actions" title="Recommendations" subtitle="Turn leakage, fatigue, and stagnation signals into clear next actions for owners and teams." />

        <InsightPanel eyebrow="Filters" title="Prioritize the action queue" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{visible.length} actions visible</div>}>
          <div className="m07-workspace-formgrid">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option><option value="fatigue">fatigue</option><option value="leakage">leakage</option><option value="recovery">recovery</option></select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="">All priorities</option><option value="High">High</option><option value="Medium">Medium</option></select>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option value="">All owners</option><option value="Rep A">Rep A</option><option value="Rep B">Rep B</option><option value="Rep C">Rep C</option></select>
          </div>
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Visible Actions" value={visible.length} note="Recommendations currently matching the selected queue filters." tone="navy" />
          <InsightKpiCard label="High Priority" value={highPriority} note="Actions that should usually be reviewed first." tone="amber" />
          <InsightKpiCard label="Owners In Queue" value={new Set(visible.map((card) => card.owner)).size} note="Distinct owners currently represented in the queue." tone="slate" />
          <InsightKpiCard label="Avg Confidence" value={`${visible.length ? Math.round(visible.reduce((sum, card) => sum + card.confidence, 0) / visible.length) : 0}%`} note="Average confidence across the visible recommendation set." tone="teal" />
        </InsightKpiGrid>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.95fr)', gap: 18, marginTop: 18 }}>
          <section className="m07-card-grid" style={{ marginTop: 0 }}>
            {visible.map((card) => (
              <div key={card.id} className="m07-rec-card" style={{ boxShadow: '0 16px 38px rgba(13,30,60,0.07)' }}>
                <div className="m07-rec-head"><span className="m07-rec-pill">{card.type}</span><span className="m07-rec-pill secondary">{card.priority}</span></div>
                <h3>{card.leadId}</h3>
                <div className="m07-rec-copy"><strong>Recommendation:</strong> {card.recommendation}</div>
                <div className="m07-rec-copy"><strong>Reason:</strong> {card.reason}</div>
                <div className="m07-rec-copy"><strong>Owner:</strong> {card.owner}</div>
                <div className="m07-rec-copy"><strong>Confidence:</strong> {card.confidence}%</div>
                <div className="m07-workspace-actionsrow"><button className="btn-primary">Apply</button><button className="btn-ghost">Assign</button><button className="btn-ghost">Dismiss</button></div>
              </div>
            ))}
            {!visible.length && <div className="m07-card-lite">No recommendations match the current filters.</div>}
          </section>

          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel eyebrow="Queue guidance" title="How to work this list" soft>
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Work high-confidence items first" body="When confidence is high, the underlying leakage or fatigue pattern is usually already strong enough to justify intervention." />
                <InsightNoteCard title="Use owners to balance load" body="Filtering by owner helps expose where the action queue is unevenly concentrated and where manager support may be needed." />
                <InsightNoteCard title="Treat this as a next-step layer" body="Recommendations are strongest after overview, leakage, journey, or fatigue screens have already identified the core operating issue." />
              </div>
            </InsightPanel>

            <InsightPanel eyebrow="Queue shape" title="Owner and type distribution">
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <InsightMiniStat label="Highest confidence" value={`${topConfidence}%`} />
                  <InsightMiniStat label="Top owner load" value={ownerLoad[0] ? `${ownerLoad[0][0]} (${ownerLoad[0][1]})` : '—'} />
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {ownerLoad.map(([owner, count]) => (
                    <div key={owner}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <strong style={{ color: '#0B2540', fontSize: 13 }}>{owner}</strong>
                        <span style={{ fontSize: 12, color: '#415274' }}>{count} actions</span>
                      </div>
                      <div style={insightTokens.track}>
                        <div style={{ ...insightTokens.fill, width: insightBarWidth(count, maxOwnerCount, 12) }} />
                      </div>
                    </div>
                  ))}
                  {!ownerLoad.length ? <div style={insightTokens.mutedText}>No owner load to show for the current filter set.</div> : null}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {typeMix.map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <strong style={{ color: '#0B2540', fontSize: 13, textTransform: 'capitalize' }}>{type}</strong>
                        <span style={{ fontSize: 12, color: '#415274' }}>{count}</span>
                      </div>
                      <div style={insightTokens.track}>
                        <div style={{ ...insightTokens.fill, width: insightBarWidth(count, maxTypeCount, 12), background: 'linear-gradient(135deg, #0F766E 0%, #14b8a6 100%)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </InsightPanel>
          </div>
        </section>
      </main>
    </Layout>
  )
}
