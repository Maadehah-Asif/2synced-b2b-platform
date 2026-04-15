import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { setModule5View } from './navigation'
import type { DashboardData, Module6Lead, PrioritizationRow, StageRecord } from './overview'
import { buildPipelineMetrics, type PipelineKpi, type PipelineStageCard, type PipelineWatchout, type StageSummaryRow } from './pipeline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export default function Module5PipelinePage() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>({
    prioritizedRows: [],
    prioritizedTotal: 0,
    module6Leads: [],
    stageRecords: [],
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!workspaceId) {
        setState('error')
        setError('Workspace context is missing. Open Module 5 from inside a workspace to use the unified pipeline view.')
        return
      }

      setState('loading')
      setError(null)

      try {
        const [m07Res, m06Res, m02Res] = await Promise.all([
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
        ])

        const [m07Json, m06Json, m02Json] = await Promise.all([
          m07Res.json().catch(() => ({})),
          m06Res.json().catch(() => ({})),
          m02Res.json().catch(() => ({})),
        ])

        if (cancelled) return

        if (!m07Res.ok && !m06Res.ok && !m02Res.ok) {
          setState('error')
          setError('Module 5 could not load pipeline signals right now. Please try again in a moment.')
          return
        }

        const nextData: DashboardData = {
          prioritizedRows: Array.isArray(m02Json.rows) ? m02Json.rows as PrioritizationRow[] : [],
          prioritizedTotal: typeof m02Json.total === 'number' ? m02Json.total : 0,
          module6Leads: Array.isArray(m06Json.leads) ? m06Json.leads as Module6Lead[] : [],
          stageRecords: Array.isArray(m07Json.items) ? m07Json.items as StageRecord[] : [],
        }

        setData(nextData)

        const hasAnyData = nextData.stageRecords.length > 0 || nextData.module6Leads.length > 0 || nextData.prioritizedRows.length > 0
        setState(hasAnyData ? 'ready' : 'empty')

        if (!m07Res.ok || !m06Res.ok || !m02Res.ok) {
          setError('Some pipeline inputs are unavailable, so this page is showing the best partial picture it can.')
        }
      } catch {
        if (cancelled) return
        setState('error')
        setError('Module 5 could not reach the current pipeline inputs.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const metrics = useMemo(() => buildPipelineMetrics(data), [data])

  return (
    <div style={{ marginTop: 18 }}>
      <button type="button" onClick={() => setModule5View('home')} style={backBtn}>
        Back to Module 5 Home
      </button>

      <section style={heroSection}>
        <div style={{ padding: 28 }}>
          <div style={heroPill}>M05 Pipeline</div>
          <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>
            Unified pipeline view
          </h1>
          <div style={{ maxWidth: 760, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
            A structured funnel view for managers who need to see where records are concentrated, where movement is showing up, and where the pipeline may be slowing down.
          </div>
        </div>
      </section>

      {state === 'loading' && <LoadingState />}
      {state === 'error' && <ErrorState error={error} />}
      {state === 'empty' && <EmptyState />}

      {state !== 'loading' && state !== 'error' && (
        <>
          {error && (
            <section style={softNotice}>
              <div style={{ fontSize: 13, color: '#6C4E12', lineHeight: 1.7 }}>{error}</div>
            </section>
          )}

          <section style={kpiGrid}>
            {metrics.kpis.map((kpi) => (
              <KpiCard key={kpi.label} card={kpi} />
            ))}
          </section>

          <section style={mainGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Pipeline shape" title="Stage distribution" />
              {metrics.stages.length > 0 ? (
                <>
                  <div style={distributionGrid}>
                    {metrics.stages.map((stage, index) => (
                      <StageDistributionCard key={stage.name} stage={stage} index={index} />
                    ))}
                  </div>
                  <div style={summaryStrip}>
                    <SummaryPill label="Unique stages" value={String(metrics.summary.uniqueStageCount)} />
                    <SummaryPill label="Lead coverage" value={`${Math.round(metrics.summary.activeLeadCoverage)}%`} />
                    <SummaryPill label="High-intent quiet" value={String(metrics.summary.highIntentQuietCount)} />
                  </div>
                </>
              ) : (
                <div style={emptyBox}>
                  No stage history is available yet, so the unified pipeline view is waiting for Module 7 stage records.
                </div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Movement" title="Progression signals" />
              <div style={{ display: 'grid', gap: 12 }}>
                <MovementCard label="Early-stage balance" value={`${Math.round(metrics.summary.earlyShare)}%`} note="of visible stage rows are clustered near the top of funnel" />
                <MovementCard label="Downstream balance" value={`${Math.round(metrics.summary.downstreamShare)}%`} note="of visible stage rows are already in later-stage progression" />
                <MovementCard label="Recent entries" value={String(metrics.summary.recentEntries30d)} note="rows entered in the last 30 days" />
                <MovementCard label="Stagnation clue" value={String(metrics.summary.stagnantStageRows)} note="active stage rows have been sitting for 21+ days" />
              </div>
            </div>
          </section>

          <section style={twoColumnGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Stage table" title="Stage summary" />
              {metrics.stageTable.length > 0 ? (
                <StageSummaryTable rows={metrics.stageTable} />
              ) : (
                <div style={emptyBox}>
                  Stage summaries will appear here once the pipeline has recorded stage activity.
                </div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Watchouts" title="What needs attention" />
              <div style={{ display: 'grid', gap: 12 }}>
                {metrics.watchouts.map((watchout) => (
                  <WatchoutCard key={watchout.title} watchout={watchout} />
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
    <div style={{ marginBottom: 14 }}>
      <div style={sectionPill}>{eyebrow}</div>
      <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>{title}</h3>
    </div>
  )
}

function KpiCard({ card }: { card: PipelineKpi }) {
  const accent = accentPalette[card.tone]
  return (
    <div style={{ ...kpiCard, borderTop: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
        <div style={{ ...miniPill, background: `${accent}18`, color: accent }}>{card.tone === 'amber' ? 'Risk' : card.tone === 'teal' ? 'Progress' : 'Flow'}</div>
      </div>
      <div style={{ marginTop: 16, fontSize: 34, lineHeight: 1, fontWeight: 900, color: '#0B2540' }}>{card.value}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: '#415274' }}>{card.note}</div>
    </div>
  )
}

function StageDistributionCard({ stage, index }: { stage: PipelineStageCard; index: number }) {
  const accent = stage.isLate ? '#0F766E' : stage.isEarly ? '#B7791F' : '#2453A6'
  const bg = stage.isLate ? 'rgba(15,118,110,0.12)' : stage.isEarly ? 'rgba(245,158,11,0.14)' : 'rgba(36,83,166,0.12)'

  return (
    <div style={stageCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 10, background: 'rgba(15,66,88,0.08)', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#0B2540' }}>
          {index + 1}
        </div>
        <div style={{ ...miniPill, background: bg, color: accent }}>{Math.round(stage.share)}%</div>
      </div>
      <div style={{ marginTop: 12, fontSize: 17, fontWeight: 800, color: '#0B2540' }}>{stage.name}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: '#415274' }}>{stage.count} records in this stage</div>
      <div style={track}>
        <div style={{ ...fill, width: `${Math.max(8, Math.min(100, stage.share))}%`, background: `linear-gradient(135deg, ${accent} 0%, #2b6f8a 100%)` }} />
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <MiniMetric label="Stagnant" value={String(stage.stagnantCount)} />
        <MiniMetric label="Done" value={String(stage.completedCount)} />
        <MiniMetric label="Dropped" value={String(stage.droppedCount)} />
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniMetricCard}>
      <div style={{ fontSize: 11, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{value}</div>
    </div>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryPill}>
      <span style={{ fontSize: 12, color: '#5B6C8B', fontWeight: 800 }}>{label}</span>
      <span style={{ fontSize: 16, color: '#0B2540', fontWeight: 900 }}>{value}</span>
    </div>
  )
}

function MovementCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={movementCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0f4258' }}>{value}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: '#415274' }}>{note}</div>
    </div>
  )
}

function StageSummaryTable({ rows }: { rows: StageSummaryRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Stage</th>
            <th style={th}>Count</th>
            <th style={th}>Share</th>
            <th style={th}>Signal</th>
            <th style={th}>Attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} style={tr}>
              <td style={tdStrong}>{row.name}</td>
              <td style={td}>{row.count}</td>
              <td style={td}>{row.shareLabel}</td>
              <td style={td}>{row.signal}</td>
              <td style={td}>
                <span style={attentionBadge(row.tone)}>{row.attention}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WatchoutCard({ watchout }: { watchout: PipelineWatchout }) {
  const accent = watchout.tone === 'amber' ? '#B7791F' : watchout.tone === 'blue' ? '#2453A6' : '#0F766E'
  const bg = watchout.tone === 'amber' ? 'rgba(245, 158, 11, 0.12)' : watchout.tone === 'blue' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(13, 148, 136, 0.12)'
  return (
    <div style={{ ...movementCard, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ ...miniPill, background: bg, color: accent }}>Watchout</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{watchout.stat}</div>
      </div>
      <div style={{ marginTop: 12, fontSize: 16, fontWeight: 800, color: '#0B2540' }}>{watchout.title}</div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#415274' }}>{watchout.body}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <section style={panelCard}>
      <SectionHeader eyebrow="Loading pipeline" title="Reading the current funnel picture" />
      <div style={{ display: 'grid', gap: 12 }}>
        <SkeletonBlock height={108} />
        <SkeletonBlock height={220} />
        <SkeletonBlock height={160} />
      </div>
    </section>
  )
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <section style={panelCard}>
      <SectionHeader eyebrow="Pipeline unavailable" title="Module 5 could not load the unified pipeline view" />
      <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.75 }}>
        {error || 'The current unified pipeline view could not load from the available inputs.'}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section style={panelCard}>
      <SectionHeader eyebrow="Waiting for stages" title="The unified pipeline view is ready, but stage activity is still empty" />
      <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.75 }}>
        Module 5 needs stage history from Module 7 before it can show a useful funnel distribution and progression read.
      </div>
    </section>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 18,
        background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))',
        border: '1px solid rgba(15,66,88,0.06)',
      }}
    />
  )
}

function attentionBadge(tone: StageSummaryRow['tone']): CSSProperties {
  const accent = tone === 'amber' ? '#B7791F' : tone === 'teal' ? '#0F766E' : tone === 'navy' ? '#0f4258' : '#475569'
  return {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: `${accent}18`,
    color: accent,
    fontSize: 12,
    fontWeight: 800,
  }
}

const accentPalette = {
  navy: '#0f4258',
  teal: '#0F766E',
  amber: '#B7791F',
  slate: '#475569',
}

const backBtn: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(15,66,88,0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
  color: '#0B2540',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 10px 22px rgba(13,30,60,0.05)',
}

const heroSection: CSSProperties = {
  marginTop: 16,
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
  background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
  color: '#fff',
}

const heroPill: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const sectionPill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: 'var(--header-secondary)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const kpiGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 16,
}

const kpiCard: CSSProperties = {
  borderRadius: 20,
  padding: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const mainGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.8fr',
  gap: 18,
}

const twoColumnGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr',
  gap: 18,
}

const panelCard: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const panelCardMuted: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
}

const distributionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const stageCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
}

const track: CSSProperties = {
  marginTop: 12,
  width: '100%',
  height: 10,
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  overflow: 'hidden',
}

const fill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)',
}

const miniPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const miniMetricCard: CSSProperties = {
  borderRadius: 12,
  padding: 10,
  background: 'rgba(244,248,252,0.95)',
  border: '1px solid rgba(15,66,88,0.07)',
}

const summaryStrip: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const summaryPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.06)',
  border: '1px solid rgba(15,66,88,0.08)',
}

const movementCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: 18,
  border: '1px solid rgba(15,66,88,0.08)',
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'rgba(255,255,255,0.96)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  color: '#5B6C8B',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(15,66,88,0.08)',
  background: 'rgba(244,248,252,0.95)',
}

const td: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(15,66,88,0.08)',
  fontSize: 13,
  color: '#415274',
  verticalAlign: 'top',
}

const tdStrong: CSSProperties = {
  ...td,
  color: '#0B2540',
  fontWeight: 800,
}

const tr: CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
}

const softNotice: CSSProperties = {
  marginTop: 18,
  borderRadius: 16,
  padding: 14,
  background: 'rgba(245, 158, 11, 0.10)',
  border: '1px solid rgba(183, 121, 31, 0.18)',
}

const emptyBox: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px dashed rgba(15,66,88,0.16)',
  background: 'rgba(245,249,253,0.9)',
  color: '#415274',
  fontSize: 13,
  lineHeight: 1.7,
}
