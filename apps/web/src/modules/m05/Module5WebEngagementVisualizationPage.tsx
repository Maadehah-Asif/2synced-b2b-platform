/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Frontend
 * File: Module5WebEngagementVisualizationPage.tsx
 * Purpose: Supports the M od ul e5 We bE ng ag em en tV is ua li za ti on Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { setModule5View } from './navigation'
import {
  fetchModule5Analytics,
  fetchModule5Uploads,
  formatBytes,
  getDisplayName,
  type AnalyticsCompanyRow,
  type AnalyticsInsightCard,
  type DistributionItem,
  type Module5AnalyticsResponse,
  type UploadItem,
} from './webEngagement'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type DatasetsState = 'loading' | 'ready' | 'empty' | 'error'
type AnalyticsState = 'idle' | 'loading' | 'ready' | 'error'
type KpiTone = 'navy' | 'teal' | 'amber' | 'slate'

type VisualizationKpi = {
  label: string
  value: string
  note: string
  tone: KpiTone
}

type OperatingSignal = {
  label: string
  value: string
  note: string
}

export default function Module5WebEngagementVisualizationPage() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [datasetsState, setDatasetsState] = useState<DatasetsState>('loading')
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>('idle')
  const [datasets, setDatasets] = useState<UploadItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedItem, setSelectedItem] = useState<UploadItem | null>(null)
  const [analytics, setAnalytics] = useState<Module5AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDatasets() {
      if (!workspaceId) {
        setDatasetsState('error')
        setError('Workspace context is missing. Open Module 5 from inside a workspace to use the visualization page.')
        return
      }

      setDatasetsState('loading')
      setError(null)

      try {
        const result = await fetchModule5Uploads(API_URL, workspaceId, 'active')
        if (cancelled) return

        if (!result.ok) {
          setDatasets([])
          setDatasetsState('error')
          setError(result.error || 'Module 5 could not load the available web engagement datasets.')
          return
        }

        setDatasets(result.items)
        if (result.items.length === 0) {
          setSelectedId('')
          setSelectedItem(null)
          setDatasetsState('empty')
          return
        }

        setDatasetsState('ready')
        setSelectedId((current) => {
          const nextId = current && result.items.some((item) => item._id === current) ? current : result.items[0]!._id
          setSelectedItem(result.items.find((item) => item._id === nextId) || null)
          return nextId
        })
      } catch {
        if (cancelled) return
        setDatasets([])
        setDatasetsState('error')
        setError('Module 5 could not reach the shared file library for visualization data.')
      }
    }

    loadDatasets()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    if (!selectedId) return
    setSelectedItem(datasets.find((item) => item._id === selectedId) || null)
  }, [datasets, selectedId])

  useEffect(() => {
    let cancelled = false

    async function loadAnalytics() {
      if (!workspaceId || !selectedId) {
        setAnalyticsState('idle')
        setAnalytics(null)
        return
      }

      setAnalyticsState('loading')
      setAnalytics(null)
      setError(null)

      try {
        const result = await fetchModule5Analytics(API_URL, workspaceId, selectedId)
        if (cancelled) return

        if (!result.ok || !result.analytics) {
          setAnalyticsState('error')
          setError(result.error || 'The selected dataset could not be analyzed as a full web engagement file.')
          return
        }

        setAnalytics(result.analytics)
        setAnalyticsState('ready')
      } catch {
        if (cancelled) return
        setAnalyticsState('error')
        setAnalytics(null)
        setError('Module 5 could not read the full uploaded CSV for the selected dataset.')
      }
    }

    loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [workspaceId, selectedId])

  const kpis = useMemo<VisualizationKpi[]>(() => {
    if (!analytics) return []

    return [
      {
        label: 'Total Events',
        value: analytics.kpis.totalEvents.toLocaleString(),
        note: 'full-file event count from the selected uploaded dataset',
        tone: 'navy',
      },
      {
        label: 'Unique Companies',
        value: analytics.kpis.uniqueCompanies.toLocaleString(),
        note: 'named companies showing measurable website activity',
        tone: 'teal',
      },
      {
        label: 'High-Intent Events',
        value: analytics.kpis.highIntentEvents.toLocaleString(),
        note: 'pricing, demo, contact, or strong intent-style activity',
        tone: analytics.kpis.highIntentEvents > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Conversion Rate',
        value: `${analytics.kpis.conversionRate.toFixed(1)}%`,
        note: 'share of events showing a conversion-like signal',
        tone: analytics.kpis.conversionRate >= 5 ? 'teal' : 'amber',
      },
      {
        label: 'Top Traffic Source',
        value: analytics.kpis.topTrafficSource,
        note: 'largest visible source contribution across the full file',
        tone: 'navy',
      },
      {
        label: 'Avg. Engagement',
        value: analytics.kpis.averageEngagementScore != null ? analytics.kpis.averageEngagementScore.toFixed(1) : 'N/A',
        note: analytics.kpis.averageEngagementScore != null ? 'average engagement score where the column is available' : 'engagement score column not detected',
        tone: analytics.kpis.averageEngagementScore != null ? 'slate' : 'amber',
      },
    ]
  }, [analytics])

  const insightCards = useMemo(() => {
    if (!analytics) return []
    return [
      analytics.insightCards.topOpportunity,
      analytics.insightCards.strongestSource,
      analytics.insightCards.mainRisk,
      analytics.insightCards.biggestDropOff,
    ].filter(Boolean) as AnalyticsInsightCard[]
  }, [analytics])

  const quickSignals = useMemo<OperatingSignal[]>(() => {
    if (!analytics) return []

    const sourceLeader = analytics.sourceDistribution[0]
    const campaignLeader = analytics.campaignPerformance[0]
    const pageLeader = analytics.pageCategoryEngagement[0]

    return [
      {
        label: 'Source momentum',
        value: sourceLeader ? `${Math.round(sourceLeader.share)}%` : 'N/A',
        note: sourceLeader ? `${sourceLeader.label} is currently the largest website entry point.` : 'No source pattern was detected.',
      },
      {
        label: 'Campaign push',
        value: campaignLeader ? campaignLeader.label : 'No campaign',
        note: campaignLeader ? `${campaignLeader.value.toLocaleString()} events are tied to the leading campaign.` : 'Campaign data is limited in this file.',
      },
      {
        label: 'Engagement focus',
        value: pageLeader ? pageLeader.label : 'Unknown',
        note: pageLeader ? `${Math.round(pageLeader.share)}% of activity is clustered in this page group.` : 'Page-category signals are limited.',
      },
    ]
  }, [analytics])

  return (
    <div style={page}>
      <section style={heroSection}>
        <div style={heroBody}>
          <div style={heroGrid}>
            <div style={heroContent}>
              <div style={heroPill}>Web engagement intelligence</div>
              <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#0F172A' }}>
                Web engagement visualization
              </h1>
              <div style={{ maxWidth: 720, color: '#475569', fontSize: 15, lineHeight: 1.75 }}>
                Turn a full uploaded engagement CSV into a calm, manager-friendly dashboard for traffic quality, campaign pull, page demand, and the companies that look increasingly ready for sales attention.
              </div>
            </div>

            <div style={heroNote}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B' }}>
                What this page answers
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: '#475569' }}>
                Which sources and campaigns are driving activity, which page groups are attracting stronger intent, and where the clearest sales follow-up opportunities or drop-off risks are showing up.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={panelCard}>
        <div style={selectorRow}>
          <div>
            <SectionHeader eyebrow="Dataset" title="Choose a web engagement upload" />
            <div style={{ fontSize: 13, lineHeight: 1.75, color: '#475569' }}>
              Module 5 reads the selected upload from the shared M01-backed file library, then runs a dedicated full-file analytics pass before showing KPIs and company-level signals.
            </div>
          </div>

          <div style={selectorCard}>
            {datasetsState === 'loading' && <div style={{ fontSize: 13, color: '#415274' }}>Loading datasets...</div>}
            {datasetsState === 'error' && <div style={{ fontSize: 13, color: '#9D174D' }}>{error || 'Dataset list unavailable.'}</div>}
            {datasetsState === 'empty' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>No active web engagement dataset yet</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#415274' }}>
                  Upload a validated CSV in the Web Engagement Data Manager first, then come back here to analyze it.
                </div>
                <button type="button" className="btn-primary" style={primaryButton} onClick={() => setModule5View('web-engagement')}>
                  Open Data Manager
                </button>
              </div>
            )}
            {datasetsState === 'ready' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>
                  Active dataset
                </label>
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} style={selectInput}>
                  {datasets.map((item) => (
                    <option key={item._id} value={item._id}>
                      {getDisplayName(item)}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : 'Unknown date'} | {formatBytes(selectedItem.length)}
                  </div>
                )}
                <div style={analyticsCallout}>
                  <span style={analyticsCalloutPill}>Full dataset</span>
                  KPIs, charts, and company insights now reflect the complete uploaded CSV.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {analyticsState === 'loading' && datasetsState === 'ready' && (
        <section style={panelCard}>
          <SectionHeader eyebrow="Loading visualization" title="Reading the selected dataset" />
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <SkeletonBlock height={88} />
            <SkeletonBlock height={220} />
            <SkeletonBlock height={180} />
          </div>
        </section>
      )}

      {analyticsState === 'error' && datasetsState === 'ready' && (
        <section style={panelCard}>
          <SectionHeader eyebrow="Visualization unavailable" title="The selected dataset could not be turned into full-file insights" />
          <div style={{ fontSize: 14, lineHeight: 1.75, color: '#475569' }}>
            {error || 'The current web engagement visualization could not be derived from the selected dataset.'}
          </div>
        </section>
      )}

      {analyticsState === 'ready' && analytics && (
        <>
          <section style={kpiGrid}>
            {kpis.map((card) => (
              <KpiCard key={card.label} card={card} />
            ))}
          </section>

          <section style={dashboardTopGrid}>
            <div style={panelCard}>
              <div style={sectionHeaderRow}>
                <SectionHeader eyebrow="Trend" title="Recent event movement" />
                <div style={sectionMeta}>Last {analytics.trend.length} visible time points</div>
              </div>
              {analytics.trend.length > 1 ? (
                <TrendChart items={analytics.trend} />
              ) : (
                <div style={emptyBox}>Trend data will appear here once the file includes enough usable event timestamps.</div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Operating readout" title="Fast interpretation" />
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {quickSignals.map((signal) => (
                  <div key={signal.label} style={signalCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>{signal.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{signal.value}</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{signal.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={mainGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Source performance" title="Where website activity is coming from" />
              {analytics.sourceDistribution.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {analytics.sourceDistribution.map((item) => (
                    <DistributionBar key={item.label} item={item} />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>No source-like column could be detected in this dataset.</div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Campaign performance" title="Which campaigns are turning into stronger engagement" />
              {analytics.campaignPerformance.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {analytics.campaignPerformance.map((item) => (
                    <DistributionBar key={item.label} item={item} />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>No campaign-like column could be detected in this dataset.</div>
              )}
            </div>
          </section>

          <section style={mainGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Behavior" title="What visitors are engaging with" />
              {analytics.pageCategoryEngagement.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {analytics.pageCategoryEngagement.map((item) => (
                    <DistributionBar key={item.label} item={item} />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>No page-category signal could be derived from the selected dataset.</div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Coverage" title="How much signal the selected file is providing" />
              <div style={coverageGrid}>
                <CoverageMetric
                  label="Detected columns"
                  value={String(analytics.diagnostics.header.length)}
                  note="Raw columns found in the uploaded CSV header"
                />
                <CoverageMetric
                  label="Matched signals"
                  value={String(Object.values(analytics.diagnostics.columnMap).filter(Boolean).length)}
                  note="Recognized fields supporting source, page, company, and conversion interpretation"
                />
                <CoverageMetric
                  label="Top campaign"
                  value={analytics.kpis.topCampaign}
                  note="Leading campaign from the current full-dataset aggregation"
                />
              </div>
            </div>
          </section>

          <section style={twoColumnGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Company focus" title="High-interest companies to watch" />
              {analytics.companyRows.length > 0 ? (
                <CompanyTable rows={analytics.companyRows} />
              ) : (
                <div style={emptyBox}>
                  Company-level insights will appear here once the selected dataset includes a usable company or account signal.
                </div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="What deserves attention" title="Grounded insight cards" />
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {insightCards.map((insight) => (
                  <InsightCard key={insight.title} insight={insight} />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div style={sectionPill}>{eyebrow}</div>
      <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0F172A' }}>{title}</h3>
    </div>
  )
}

function KpiCard({ card }: { card: VisualizationKpi }) {
  return (
    <div style={kpiCard}>
      <div style={{ ...kpiAccent, background: accentPalette[card.tone] }} />
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
      <div style={{ marginTop: 16, fontSize: 34, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{card.value}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: '#475569' }}>{card.note}</div>
    </div>
  )
}

function DistributionBar({ item }: { item: DistributionItem }) {
  const accent = accentPalette[item.tone || 'navy']
  return (
    <div style={distributionCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{item.label}</div>
          {item.helper && <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#64748B' }}>{item.helper}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{item.value}</div>
          <div style={{ marginTop: 2, fontSize: 12, color: '#64748B', fontWeight: 700 }}>{Math.round(item.share)}%</div>
        </div>
      </div>
      <div style={track}>
        <div style={{ ...fill, width: `${Math.max(8, Math.min(100, item.share))}%`, background: accent }} />
      </div>
    </div>
  )
}

function TrendChart({ items }: { items: DistributionItem[] }) {
  const width = 760
  const height = 240
  const paddingX = 28
  const paddingTop = 22
  const paddingBottom = 36
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingTop - paddingBottom

  const points = items.map((item, index) => {
    const x = paddingX + (index * innerWidth) / Math.max(items.length - 1, 1)
    const y = paddingTop + innerHeight - (item.value / maxValue) * innerHeight
    return { ...item, x, y }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? paddingX} ${height - paddingBottom} L ${points[0]?.x ?? paddingX} ${height - paddingBottom} Z`
  const yTicks = [0, 0.5, 1].map((step) => Math.round(maxValue * step))

  return (
    <div style={{ marginTop: 18 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={trendSvg} preserveAspectRatio="none" aria-label="Event trend chart">
        {yTicks.map((tick, index) => {
          const y = paddingTop + innerHeight - ((tick || 0) / maxValue) * innerHeight
          return (
            <g key={`${tick}-${index}`}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
              <text x={8} y={y + 4} fill="#94A3B8" fontSize="11">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={areaPath} fill="rgba(15,66,88,0.08)" />
        <path d={linePath} fill="none" stroke="#0F4258" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#ffffff" stroke="#0F4258" strokeWidth="2" />
            <text x={point.x} y={height - 14} textAnchor="middle" fill="#64748B" fontSize="11">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <div style={trendSummaryGrid}>
        {items.map((item) => (
          <div key={item.label} style={trendSummaryCard}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{item.label}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#0F172A', fontWeight: 800 }}>{item.value} events</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyTable({ rows }: { rows: AnalyticsCompanyRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Company</th>
            <th style={th}>Events</th>
            <th style={th}>High Intent</th>
            <th style={th}>Conversions</th>
            <th style={th}>Top Page Category</th>
            <th style={th}>Top Page</th>
            <th style={th}>Last Activity</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.company} style={tr}>
              <td style={tdStrong}>{row.company}</td>
              <td style={td}>{row.eventCount}</td>
              <td style={td}>{row.highIntentEvents}</td>
              <td style={td}>{row.conversions}</td>
              <td style={td}>{row.topPageCategory}</td>
              <td style={td}>{row.topPage}</td>
              <td style={td}>{row.lastActivityLabel}</td>
              <td style={td}>
                <span style={statusBadge(row.status)}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InsightCard({ insight }: { insight: AnalyticsInsightCard }) {
  const accent = accentPalette[insight.tone]
  return (
    <div style={insightCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ ...insightPill, background: `${accent}12`, color: accent }}>{insight.title}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: accent }}>{insight.stat}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{insight.body}</div>
    </div>
  )
}

function CoverageMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={coverageCard}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{note}</div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ ...skeleton, height }} />
}

function statusBadge(status: 'Hot' | 'Warm' | 'Cold'): CSSProperties {
  const tone = status === 'Hot'
    ? { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' }
    : status === 'Warm'
      ? { bg: 'rgba(245,158,11,0.14)', color: '#B45309' }
      : { bg: 'rgba(148,163,184,0.16)', color: '#475569' }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    padding: '5px 10px',
    borderRadius: 999,
    background: tone.bg,
    color: tone.color,
    fontSize: 12,
    fontWeight: 700,
  }
}

const accentPalette = {
  navy: '#0F4258',
  teal: '#0F766E',
  amber: '#C47A10',
  slate: '#64748B',
}

const page: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gap: 18,
}

const backBtn: CSSProperties = {
  justifySelf: 'start',
  borderRadius: 10,
  padding: '10px 14px',
  border: '1px solid rgba(203,213,225,1)',
  background: '#ffffff',
  color: '#0F172A',
  fontWeight: 700,
  cursor: 'pointer',
}

const heroSection: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(226,232,240,1)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)',
}

const heroBody: CSSProperties = {
  padding: 28,
}

const heroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
  alignItems: 'start',
}

const heroContent: CSSProperties = {
  display: 'grid',
  gap: 4,
}

const heroPill: CSSProperties = {
  display: 'inline-flex',
  justifySelf: 'start',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#EEF6FA',
  color: '#0F4258',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const heroNote: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: '#F8FAFC',
  border: '1px solid rgba(226,232,240,1)',
}

const panelCard: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
}

const panelCardMuted: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: '#FCFDFE',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.03)',
}

const sectionPill: CSSProperties = {
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#F1F5F9',
  color: '#64748B',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const selectorRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
  alignItems: 'start',
}

const selectorCard: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: '#F8FAFC',
  border: '1px solid rgba(226,232,240,1)',
}

const selectInput: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(203,213,225,1)',
  padding: '11px 12px',
  fontSize: 14,
  color: '#0F172A',
  background: '#ffffff',
}

const primaryButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
}

const kpiGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 14,
}

const kpiCard: CSSProperties = {
  position: 'relative',
  borderRadius: 18,
  padding: '18px 18px 16px',
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 8px 24px rgba(15,23,42,0.03)',
  overflow: 'hidden',
}

const kpiAccent: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
}

const mainGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
}

const twoColumnGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
}

const dashboardTopGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
}

const coverageGrid: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 14,
}

const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const sectionMeta: CSSProperties = {
  fontSize: 12,
  color: '#64748B',
  fontWeight: 600,
}

const distributionCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
}

const signalCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#FAFCFD',
}

const analyticsCallout: CSSProperties = {
  marginTop: 6,
  borderRadius: 12,
  padding: '10px 12px',
  background: '#ECFDF5',
  border: '1px solid rgba(16,185,129,0.16)',
  fontSize: 12,
  lineHeight: 1.6,
  color: '#166534',
}

const analyticsCalloutPill: CSSProperties = {
  display: 'inline-flex',
  marginRight: 8,
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(16,185,129,0.12)',
  color: '#047857',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const track: CSSProperties = {
  marginTop: 12,
  width: '100%',
  height: 8,
  borderRadius: 999,
  background: '#E2E8F0',
  overflow: 'hidden',
}

const fill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
}

const trendSvg: CSSProperties = {
  width: '100%',
  height: 250,
  display: 'block',
}

const trendSummaryGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
  gap: 10,
}

const trendSummaryCard: CSSProperties = {
  borderTop: '1px solid rgba(226,232,240,1)',
  paddingTop: 10,
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: 16,
  border: '1px solid rgba(226,232,240,1)',
  marginTop: 16,
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#ffffff',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  color: '#64748B',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(226,232,240,1)',
  background: '#F8FAFC',
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(241,245,249,1)',
  fontSize: 13,
  color: '#475569',
  verticalAlign: 'top',
}

const tdStrong: CSSProperties = {
  ...td,
  color: '#0F172A',
  fontWeight: 700,
}

const tr: CSSProperties = {
  background: '#ffffff',
}

const insightCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
}

const insightPill: CSSProperties = {
  display: 'inline-flex',
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
}

const emptyBox: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px dashed rgba(203,213,225,1)',
  background: '#F8FAFC',
  color: '#475569',
  fontSize: 13,
  lineHeight: 1.75,
  marginTop: 14,
}

const coverageCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#FAFCFD',
}

const skeleton: CSSProperties = {
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(241,245,249,0.9), rgba(248,250,252,1), rgba(241,245,249,0.9))',
  border: '1px solid rgba(226,232,240,1)',
}
