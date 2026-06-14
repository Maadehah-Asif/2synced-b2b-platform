/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Frontend
 * File: Module5ShortcomingAnalyzerPage.tsx
 * Purpose: Supports the M od ul e5 Sh or tc om in gA na ly ze rP ag e flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { setModule5View } from './navigation'
import type { DashboardData, Module6Lead, PrioritizationRow, StageRecord } from './overview'
import {
  analyzeShortcomings,
  type IssueBoardItem,
  type ShortcomingActionRow,
  type ShortcomingAnalysis,
  type ShortcomingSeverity,
  type ShortcomingSummaryCard,
  type ShortcomingVisualRow,
} from './shortcomings'
import {
  fetchModule5Analytics,
  fetchModule5Uploads,
  formatBytes,
  getDisplayName,
  type Module5AnalyticsResponse,
  type UploadItem,
} from './webEngagement'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type PipelineState = 'loading' | 'ready' | 'empty' | 'error'
type DatasetsState = 'loading' | 'ready' | 'empty' | 'error'
type AnalyticsState = 'idle' | 'loading' | 'ready' | 'error'
type Tone = 'navy' | 'teal' | 'amber' | 'slate'

export default function Module5ShortcomingAnalyzerPage() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [pipelineState, setPipelineState] = useState<PipelineState>('loading')
  const [datasetsState, setDatasetsState] = useState<DatasetsState>('loading')
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>('idle')
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>({
    prioritizedRows: [],
    prioritizedTotal: 0,
    module6Leads: [],
    stageRecords: [],
  })
  const [datasets, setDatasets] = useState<UploadItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedItem, setSelectedItem] = useState<UploadItem | null>(null)
  const [analytics, setAnalytics] = useState<Module5AnalyticsResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!workspaceId) {
        setPipelineState('error')
        setDatasetsState('error')
        setPipelineError('Workspace context is missing. Open Module 5 from inside a workspace to use the shortcoming analyzer.')
        return
      }

      setPipelineState('loading')
      setDatasetsState('loading')
      setAnalyticsState('idle')
      setPipelineError(null)
      setAnalyticsError(null)

      try {
        const [m07Res, m06Res, m02Res, uploadsResult] = await Promise.all([
          fetch(`${API_URL}/m07/stages?${new URLSearchParams({ workspaceId, page: '1', pageSize: '250' }).toString()}`),
          fetch(`${API_URL}/m06/leads?${new URLSearchParams({ projectId: workspaceId, limit: '250' }).toString()}`),
          fetch(`${API_URL}/m02/prioritization?${new URLSearchParams({
            workspaceId,
            page: '1',
            pageSize: '100',
            segment: 'ALL',
            minIntent: '0',
            maxIntent: '100',
          }).toString()}`),
          fetchModule5Uploads(API_URL, workspaceId, 'active'),
        ])

        const [m07Json, m06Json, m02Json] = await Promise.all([
          m07Res.json().catch(() => ({})),
          m06Res.json().catch(() => ({})),
          m02Res.json().catch(() => ({})),
        ])

        if (cancelled) return

        const nextData: DashboardData = {
          prioritizedRows: Array.isArray(m02Json.rows) ? m02Json.rows as PrioritizationRow[] : [],
          prioritizedTotal: typeof m02Json.total === 'number' ? m02Json.total : 0,
          module6Leads: Array.isArray(m06Json.leads) ? m06Json.leads as Module6Lead[] : [],
          stageRecords: Array.isArray(m07Json.items) ? m07Json.items as StageRecord[] : [],
        }

        setData(nextData)

        const hasPipelineData = nextData.stageRecords.length > 0 || nextData.module6Leads.length > 0 || nextData.prioritizedRows.length > 0
        setPipelineState(hasPipelineData ? 'ready' : 'empty')

        if (!m07Res.ok && !m06Res.ok && !m02Res.ok) {
          setPipelineState('error')
          setPipelineError('Module 5 could not load the current alignment signals from the available pipeline inputs.')
        } else if (!m07Res.ok || !m06Res.ok || !m02Res.ok) {
          setPipelineError('Some inputs are unavailable, so the analyzer is showing the best partial process read it can.')
        }

        if (!uploadsResult.ok) {
          setDatasets([])
          setDatasetsState('error')
          setAnalyticsError(uploadsResult.error || 'Module 5 could not load web engagement datasets for issue enrichment.')
          return
        }

        setDatasets(uploadsResult.items)
        if (uploadsResult.items.length === 0) {
          setSelectedId('')
          setSelectedItem(null)
          setDatasetsState('empty')
          return
        }

        setDatasetsState('ready')
        const nextSelected = uploadsResult.items.find((item) => item._id === selectedId) || uploadsResult.items[0] || null
        setSelectedId(nextSelected?._id || '')
        setSelectedItem(nextSelected)
      } catch {
        if (cancelled) return
        setPipelineState('error')
        setDatasetsState('error')
        setPipelineError('Module 5 could not reach the current inputs for shortcoming analysis.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null)
      return
    }
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
      setAnalyticsError(null)

      try {
        const result = await fetchModule5Analytics(API_URL, workspaceId, selectedId)
        if (cancelled) return

        if (!result.ok || !result.analytics) {
          setAnalyticsState('error')
          setAnalyticsError(result.error || 'The selected dataset could not be turned into web-engagement issue signals.')
          return
        }

        setAnalytics(result.analytics)
        setAnalyticsState('ready')
      } catch {
        if (cancelled) return
        setAnalyticsState('error')
        setAnalytics(null)
        setAnalyticsError('Module 5 could not read full-file analytics for the selected engagement dataset.')
      }
    }

    void loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [workspaceId, selectedId])

  const analysis = useMemo<ShortcomingAnalysis>(() => analyzeShortcomings(data, analytics), [data, analytics])

  const issueStatusNote = useMemo(() => {
    if (analysis.issues.length === 0) {
      return 'Current rules are not flagging any meaningful process weaknesses in the available signals.'
    }
    const topIssue = analysis.issues[0]
    return `${topIssue.severity} priority issue: ${topIssue.title}`
  }, [analysis])

  return (
    <div style={page}>
      <section style={heroSection}>
        <div style={heroBody}>
          <div style={heroGrid}>
            <div>
              <div style={heroPill}>Shortcoming analyzer</div>
              <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>
                Process Weakness Detected
              </h1>
              <div style={{ maxWidth: 720, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.75 }}>
                A rule-based alignment dashboard for spotting where sales and marketing flow is slowing down, where web interest is not turning into progress, and what managers should review first.
              </div>
            </div>

            <div style={heroNote}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.74)' }}>
                Rule-based now, ML-ready later
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)' }}>
                This version separates input signals, derived features, severity scoring, and issue outputs so a future ML layer can plug into the same operational surface without redesigning the page.
              </div>
            </div>
          </div>
        </div>
      </section>

      {pipelineError && (
        <section style={warningNotice}>
          {pipelineError}
        </section>
      )}

      {pipelineState === 'loading' && (
        <section style={panelCard}>
          <SectionHeader eyebrow="Loading analyzer" title="Reading the current sales and marketing flow" />
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <SkeletonBlock height={84} />
            <SkeletonBlock height={200} />
            <SkeletonBlock height={160} />
          </div>
        </section>
      )}

      {pipelineState === 'error' && (
        <section style={panelCard}>
          <SectionHeader eyebrow="Analyzer unavailable" title="Module 5 could not build the current process picture" />
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.75 }}>
            {pipelineError || 'The shortcoming analyzer could not load from the available Module 5 inputs.'}
          </div>
        </section>
      )}

      {pipelineState !== 'loading' && pipelineState !== 'error' && (
        <>
          <section style={controlGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Issue scope" title="What this pass is analyzing" />
              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <SignalRow label="Pipeline coverage" value={pipelineState === 'ready' ? 'Live inputs' : 'Limited'} note={`${data.stageRecords.length} stage rows | ${data.module6Leads.length} leads | ${data.prioritizedRows.length} prioritization rows`} />
                <SignalRow label="Top issue readout" value={issueStatusNote} note="Highest-severity issue derived from current rule scoring." />
              </div>
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Engagement enrichment" title="Selected web dataset" />
              {datasetsState === 'loading' && <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>Loading active Module 5 datasets...</div>}
              {datasetsState === 'error' && <div style={{ marginTop: 14, fontSize: 13, color: '#9D174D' }}>{analyticsError || 'Web-engagement enrichment is unavailable right now.'}</div>}
              {datasetsState === 'empty' && (
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>No active web engagement dataset</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: '#475569' }}>
                    The analyzer can already surface pipeline bottlenecks, but campaign and source inefficiencies get stronger once a validated web dataset is available.
                  </div>
                  <button type="button" className="btn-primary" style={primaryButton} onClick={() => setModule5View('web-engagement')}>
                    Open Data Manager
                  </button>
                </div>
              )}
              {datasetsState === 'ready' && (
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <label style={controlLabel}>Active dataset</label>
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
                  <div style={subtleCallout}>
                    {analyticsState === 'loading'
                      ? 'Refreshing engagement-derived issue signals from the full uploaded file.'
                      : analytics
                        ? `Using full-file analytics from ${analytics.dataset.name}.`
                        : 'Pipeline rules are still available even while engagement enrichment is limited.'}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section style={kpiGrid}>
            {analysis.summaryCards.map((card) => (
              <SummaryCardView key={card.label} card={card} />
            ))}
          </section>

          <section style={mainGrid}>
            <div style={panelCard}>
              <div style={sectionHeaderRow}>
                <SectionHeader eyebrow="Bottleneck board" title="Where the process looks weakest right now" />
                <div style={sectionMeta}>{analysis.issues.length} issues currently triggered</div>
              </div>
              {analysis.issueBoard.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                  {analysis.issueBoard.map((issue, index) => (
                    <IssueBoardCard key={`${issue.title}-${index}`} issue={issue} />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>
                  The current rule set is not finding a meaningful bottleneck from the available signals. As more pipeline and engagement data accumulates, this board will become more opinionated.
                </div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Signal notes" title="How to read this page" />
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <NoteCard
                  title="Pipeline-first coverage"
                  text="Early-stage concentration, downstream weakness, limited progression, and stagnation are derived from the mounted M02, M06, and M07 inputs."
                />
                <NoteCard
                  title="Web issue enrichment"
                  text="Campaign, source, and conversion-quality issues are only added when a valid Module 5 engagement dataset is selected and successfully analyzed."
                />
                <NoteCard
                  title="Action-oriented output"
                  text="Each issue bundles a supporting metric and a short recommendation so managers can move from diagnosis to review quickly."
                />
              </div>
            </div>
          </section>

          <section style={visualGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Issue mix" title="Issue count by area" />
              {analysis.issueTypeDistribution.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {analysis.issueTypeDistribution.map((row) => (
                    <VisualBar key={row.label} row={row} tone="navy" />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>Issue distribution will appear here once the rules detect at least one active weakness.</div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Severity mix" title="How urgent the current issues are" />
              {analysis.severityDistribution.length > 0 ? (
                <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                  {analysis.severityDistribution.map((row) => (
                    <VisualBar key={row.label} row={row} tone={row.label === 'High' ? 'amber' : row.label === 'Medium' ? 'navy' : 'teal'} />
                  ))}
                </div>
              ) : (
                <div style={emptyBox}>Severity distribution will appear once the current rules trigger one or more issues.</div>
              )}
            </div>
          </section>

          <section style={panelCard}>
            <SectionHeader eyebrow="Action table" title="Operational issue summary" />
            {analysis.actionRows.length > 0 ? (
              <ActionTable rows={analysis.actionRows} />
            ) : (
              <div style={{ ...emptyBox, marginTop: 14 }}>
                No issue rows are active yet, so there is nothing to add to the action table.
              </div>
            )}
          </section>

          {(analyticsError && datasetsState === 'ready' && analyticsState === 'error') && (
            <section style={softErrorNotice}>
              {analyticsError}
            </section>
          )}
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

function SummaryCardView({ card }: { card: ShortcomingSummaryCard }) {
  return (
    <div style={summaryCard}>
      <div style={{ ...summaryAccent, background: accentPalette[card.tone] }} />
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
      <div style={{ marginTop: 14, fontSize: 34, lineHeight: 1, fontWeight: 900, color: '#0F172A' }}>{card.value}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: '#475569' }}>{card.note}</div>
    </div>
  )
}

function SignalRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={signalCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{value}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{note}</div>
    </div>
  )
}

function IssueBoardCard({ issue }: { issue: IssueBoardItem }) {
  const severity = severityPalette[issue.severity]
  return (
    <div style={issueCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={groupPill}>{issue.group}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', lineHeight: 1.35 }}>{issue.title}</div>
        </div>
        <div style={{ ...severityBadge, background: severity.bg, color: severity.color }}>{issue.severity}</div>
      </div>
      <div style={metricChip}>{issue.metric}</div>
      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{issue.explanation}</div>
      <div style={recommendationCard}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>Recommended next move</div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7, color: '#334155' }}>{issue.recommendation}</div>
      </div>
    </div>
  )
}

function VisualBar({ row, tone }: { row: ShortcomingVisualRow; tone: Tone }) {
  return (
    <div style={barCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{row.label}</div>
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#64748B' }}>{Math.round(row.share)}% of the current issue mix</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{row.value}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>issues</div>
        </div>
      </div>
      <div style={track}>
        <div style={{ ...fill, width: `${Math.max(10, Math.min(100, row.share))}%`, background: accentPalette[tone] }} />
      </div>
    </div>
  )
}

function ActionTable({ rows }: { rows: ShortcomingActionRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Issue Area</th>
            <th style={th}>Issue Type</th>
            <th style={th}>Severity</th>
            <th style={th}>Affected Count</th>
            <th style={th}>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.type}-${index}`} style={tr}>
              <td style={tdStrong}>{row.area}</td>
              <td style={td}>{row.type}</td>
              <td style={td}>
                <span style={{ ...severityBadge, ...severityBadgeInline(row.severity) }}>{row.severity}</span>
              </td>
              <td style={td}>{row.affectedCount}</td>
              <td style={td}>{row.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NoteCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={noteCard}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>{text}</div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ ...skeleton, height }} />
}

function severityBadgeInline(severity: ShortcomingSeverity): CSSProperties {
  const palette = severityPalette[severity]
  return {
    background: palette.bg,
    color: palette.color,
  }
}

const accentPalette: Record<Tone, string> = {
  navy: '#0F4258',
  teal: '#0F766E',
  amber: '#C47A10',
  slate: '#64748B',
}

const severityPalette: Record<ShortcomingSeverity, { bg: string; color: string }> = {
  High: { bg: 'rgba(245,158,11,0.16)', color: '#B45309' },
  Medium: { bg: 'rgba(15,66,88,0.10)', color: '#0F4258' },
  Low: { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' },
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
  overflow: 'hidden',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
  background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
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

const heroPill: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroNote: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
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

const warningNotice: CSSProperties = {
  borderRadius: 14,
  padding: 14,
  background: 'rgba(245,158,11,0.12)',
  border: '1px solid rgba(245,158,11,0.18)',
  color: '#7C2D12',
  fontSize: 13,
  lineHeight: 1.7,
}

const softErrorNotice: CSSProperties = {
  borderRadius: 14,
  padding: 14,
  background: 'rgba(190,24,93,0.08)',
  border: '1px solid rgba(190,24,93,0.14)',
  color: '#9D174D',
  fontSize: 13,
  lineHeight: 1.7,
}

const controlGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
}

const controlLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#64748B',
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

const subtleCallout: CSSProperties = {
  borderRadius: 12,
  padding: '10px 12px',
  background: '#F8FAFC',
  border: '1px solid rgba(226,232,240,1)',
  color: '#475569',
  fontSize: 12,
  lineHeight: 1.6,
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

const summaryCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 18,
  padding: '18px 18px 16px',
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 8px 24px rgba(15,23,42,0.03)',
}

const summaryAccent: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
}

const mainGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
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

const signalCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#FAFCFD',
}

const issueCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
  display: 'grid',
  gap: 0,
}

const groupPill: CSSProperties = {
  display: 'inline-flex',
  justifySelf: 'start',
  padding: '4px 8px',
  borderRadius: 999,
  background: '#F1F5F9',
  color: '#64748B',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const severityBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 64,
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
}

const metricChip: CSSProperties = {
  marginTop: 12,
  display: 'inline-flex',
  justifySelf: 'start',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#EEF6FA',
  color: '#0F4258',
  fontSize: 12,
  fontWeight: 700,
}

const recommendationCard: CSSProperties = {
  marginTop: 14,
  borderRadius: 14,
  padding: 12,
  background: '#F8FAFC',
  border: '1px solid rgba(226,232,240,1)',
}

const noteCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
}

const visualGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
}

const barCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
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

const emptyBox: CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  padding: 16,
  border: '1px dashed rgba(203,213,225,1)',
  background: '#F8FAFC',
  color: '#475569',
  fontSize: 13,
  lineHeight: 1.75,
}

const skeleton: CSSProperties = {
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(241,245,249,0.9), rgba(248,250,252,1), rgba(241,245,249,0.9))',
  border: '1px solid rgba(226,232,240,1)',
}
