/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Frontend
 * File: Module5OverviewPage.tsx
 * Purpose: Supports the M od ul e5 Ov er vi ew Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { buildOverviewMetrics, type AlignmentCard, type AttentionRow, type DashboardData, type Module6Lead, type PipelineStagePreview, type PrioritizationRow, type StageRecord, type SummaryCard, type Watchout } from './overview'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export default function Module5OverviewPage() {
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
        setError('Workspace context is missing. Open Module 5 from inside a workspace to see the alignment overview.')
        return
      }

      setState('loading')
      setError(null)

      try {
        const [m02Res, m06Res, m07Res] = await Promise.all([
          fetch(`${API_URL}/m02/prioritization?${new URLSearchParams({
            workspaceId,
            page: '1',
            pageSize: '100',
            segment: 'ALL',
            minIntent: '0',
            maxIntent: '100',
          }).toString()}`),
          fetch(`${API_URL}/m06/leads?${new URLSearchParams({ projectId: workspaceId, limit: '200' }).toString()}`),
          fetch(`${API_URL}/m07/stages?${new URLSearchParams({ workspaceId, page: '1', pageSize: '200' }).toString()}`),
        ])

        const [m02Json, m06Json, m07Json] = await Promise.all([
          m02Res.json().catch(() => ({})),
          m06Res.json().catch(() => ({})),
          m07Res.json().catch(() => ({})),
        ])

        if (cancelled) return

        if (!m02Res.ok && !m06Res.ok && !m07Res.ok) {
          setState('error')
          setError('Module 5 could not load its overview signals right now. Please try again in a moment.')
          return
        }

        const nextData: DashboardData = {
          prioritizedRows: Array.isArray(m02Json.rows) ? m02Json.rows as PrioritizationRow[] : [],
          prioritizedTotal: typeof m02Json.total === 'number' ? m02Json.total : 0,
          module6Leads: Array.isArray(m06Json.leads) ? m06Json.leads as Module6Lead[] : [],
          stageRecords: Array.isArray(m07Json.items) ? m07Json.items as StageRecord[] : [],
        }

        setData(nextData)

        const hasAnyData = nextData.prioritizedRows.length > 0 || nextData.module6Leads.length > 0 || nextData.stageRecords.length > 0
        setState(hasAnyData ? 'ready' : 'empty')

        if (!m02Res.ok || !m06Res.ok || !m07Res.ok) {
          setError('Some overview inputs are unavailable, so this page is showing the best partial picture it can.')
        }
      } catch {
        if (cancelled) return
        setState('error')
        setError('Module 5 could not reach the current alignment inputs.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const metrics = useMemo(() => buildOverviewMetrics(data), [data])

  return (
    <div style={{ marginTop: 18 }}>
      <HeroSection />

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
            {metrics.summaryCards.map((card) => (
              <SummaryCardView key={card.label} card={card} />
            ))}
          </section>

          <section style={mainGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Pipeline" title="Funnel shape" icon="◫" />
              {metrics.pipelineStages.length > 0 ? (
                <>
                  <div style={funnelChart}>
                    {metrics.pipelineStages.map((stage, index) => (
                      <FunnelStageBar key={stage.name} stage={stage} index={index} />
                    ))}
                  </div>
                  <div style={funnelFooterGrid}>
                    <MiniStat label="Early-stage rows" value={String(metrics.movement.earlyStageRows)} />
                    <MiniStat label="Downstream rows" value={String(metrics.movement.downstreamRows)} />
                    <MiniStat label="New in 30d" value={String(metrics.movement.recentEntries30d)} />
                  </div>
                </>
              ) : (
                <div style={emptyBox}>
                  No stage history is available yet, so the funnel visual is waiting for Module 7 stage records.
                </div>
              )}
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Readout" title="Manager snapshot" icon="≣" />
              <div style={{ display: 'grid', gap: 12 }}>
                <HeadlineCard title="Coverage" value={`${Math.round(metrics.movement.coveragePct)}%`} note="of active leads already show up in pipeline tracking" />
                <HeadlineCard title="Progress" value={String(metrics.movement.completedStageRows)} note="completed stage rows are visible across the current funnel" />
                <HeadlineCard title="Risk" value={`${Math.round(metrics.movement.stalePct)}%`} note="of prioritized leads currently look stale or quiet" />
              </div>
            </div>
          </section>

          <section style={twoColumnGrid}>
            <div style={panelCard}>
              <SectionHeader eyebrow="Alignment" title="Marketing to sales handoff" icon="↗" />
              <div style={{ display: 'grid', gap: 14 }}>
                {metrics.alignmentCards.map((card) => (
                  <AlignmentFlowCard key={card.label} card={card} />
                ))}
              </div>
            </div>

            <div style={panelCardMuted}>
              <SectionHeader eyebrow="Watchouts" title="What needs attention" icon="!" />
              <div style={{ display: 'grid', gap: 12 }}>
                {metrics.watchouts.map((watchout) => (
                  <WatchoutCard key={watchout.title} watchout={watchout} />
                ))}
              </div>
            </div>
          </section>

          <section style={panelCard}>
            <SectionHeader eyebrow="Action table" title="Priority records needing attention" icon="□" />
            {metrics.attentionRows.length > 0 ? (
              <AttentionTable rows={metrics.attentionRows} />
            ) : (
              <div style={emptyBox}>
                Priority records will appear here once the prioritization feed starts surfacing leads that need follow-up or review.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function HeroSection() {
  return (
    <section style={heroSection}>
      <div style={{ padding: 28 }}>
        <div style={heroPill}>M05 Overview</div>
        <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>
          Sales Marketing Alignment Dashboard
        </h1>
        <div style={{ maxWidth: 720, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
          A quick visual read on whether marketing is bringing in interest, sales is moving it forward, and where the funnel is getting stuck.
        </div>
      </div>
    </section>
  )
}

function SectionHeader({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionPill}>{eyebrow}</div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <span style={sectionIcon}>{icon}</span>}
        <h3 style={{ margin: 0, fontSize: 24, color: '#0B2540' }}>{title}</h3>
      </div>
    </div>
  )
}

function SummaryCardView({ card }: { card: SummaryCard }) {
  const accent = accentPalette[card.tone]
  return (
    <div style={{ ...summaryCard, borderTop: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {card.label}
        </div>
        <div style={{ ...miniTonePill, background: `${accent}18`, color: accent }}>{card.tone === 'navy' ? 'Core' : card.tone === 'teal' ? 'Ready' : card.tone === 'amber' ? 'Risk' : 'Flow'}</div>
      </div>
      <div style={{ marginTop: 16, fontSize: 34, fontWeight: 900, color: '#0B2540', lineHeight: 1 }}>{card.value}</div>
      <div style={{ marginTop: 10, fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{card.note}</div>
    </div>
  )
}

function FunnelStageBar({ stage, index }: { stage: PipelineStagePreview; index: number }) {
  const accent = stage.isLate ? '#0F766E' : stage.isEarly ? '#B7791F' : '#2453A6'
  const bg = stage.isLate ? 'rgba(15,118,110,0.12)' : stage.isEarly ? 'rgba(245,158,11,0.14)' : 'rgba(36,83,166,0.12)'

  return (
    <div style={funnelRow}>
      <div style={{ width: 24, fontSize: 12, fontWeight: 800, color: '#5B6C8B' }}>0{index + 1}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>{stage.name}</div>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...miniTonePill, background: bg, color: accent }}>{Math.round(stage.share)}%</span>
            <span style={{ fontSize: 13, color: '#415274', fontWeight: 700 }}>{stage.count}</span>
          </div>
        </div>
        <div style={track}>
          <div style={{ ...fill, width: `${Math.max(10, Math.min(100, stage.share))}%`, background: `linear-gradient(135deg, ${accent} 0%, #2b6f8a 100%)` }} />
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCard}>
      <div style={{ fontSize: 11, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 22, color: '#0B2540', fontWeight: 900 }}>{value}</div>
    </div>
  )
}

function HeadlineCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div style={innerCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0f4258' }}>{value}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{note}</div>
    </div>
  )
}

function AlignmentFlowCard({ card }: { card: AlignmentCard }) {
  const accent = accentPalette[card.tone]
  return (
    <div style={innerCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540' }}>{card.label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: accent }}>{card.value}</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{card.helper}</div>
      {typeof card.share === 'number' && (
        <>
          <div style={{ ...track, marginTop: 12, height: 8 }}>
            <div style={{ ...fill, width: `${Math.max(6, Math.min(100, card.share))}%`, background: `linear-gradient(135deg, ${accent} 0%, #2b6f8a 100%)` }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#5B6C8B' }}>{Math.round(card.share)}% share</div>
        </>
      )}
    </div>
  )
}

function WatchoutCard({ watchout }: { watchout: Watchout }) {
  const accent = watchout.tone === 'amber' ? '#B7791F' : watchout.tone === 'blue' ? '#2453A6' : '#0F766E'
  const bg = watchout.tone === 'amber' ? 'rgba(245, 158, 11, 0.12)' : watchout.tone === 'blue' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(13, 148, 136, 0.12)'
  return (
    <div style={{ ...innerCard, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ ...miniTonePill, background: bg, color: accent, width: 'fit-content' }}>Watchout</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{watchout.stat}</div>
      </div>
      <h4 style={{ margin: '12px 0 6px', fontSize: 18, color: '#0B2540' }}>{watchout.title}</h4>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{watchout.body}</div>
    </div>
  )
}

function AttentionTable({ rows }: { rows: AttentionRow[] }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Lead</th>
            <th style={th}>Intent</th>
            <th style={th}>Inactivity</th>
            <th style={th}>Recent Activity</th>
            <th style={th}>Recommended Move</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.label}-${row.company}`} style={tr}>
              <td style={td}>
                <div style={{ fontWeight: 800, color: '#0B2540' }}>{row.label}</div>
                <div style={{ fontSize: 12, color: '#5B6C8B', marginTop: 4 }}>{row.company}</div>
              </td>
              <td style={td}>
                <span style={intentBadge(row.intentLabel)}>{row.intentLabel}</span>
              </td>
              <td style={td}>{row.inactivity}</td>
              <td style={td}>{row.activity}</td>
              <td style={td}>
                <span style={actionBadge}>{row.action}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoadingState() {
  return (
    <section style={panelCard}>
      <div style={panelPill}>Loading overview</div>
      <h3 style={panelTitle}>Reading the current alignment picture</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <SkeletonBlock height={84} />
        <SkeletonBlock height={84} />
        <SkeletonBlock height={84} />
      </div>
    </section>
  )
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <section style={panelCard}>
      <div style={panelPillAlt}>Overview unavailable</div>
      <h3 style={panelTitle}>Module 5 could not load its first dashboard view</h3>
      <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.75 }}>
        {error || 'The current Module 5 overview could not load from the available inputs.'}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section style={panelCard}>
      <div style={panelPill}>Waiting for signals</div>
      <h3 style={panelTitle}>Module 5 overview is ready, but the current dashboard is empty</h3>
      <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.75 }}>
        The overview needs at least one of these foundations to tell a useful story: prioritized leads from Module 2, active leads from Module 6, or stage history from Module 7.
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

const accentPalette = {
  navy: '#0f4258',
  teal: '#0F766E',
  amber: '#B7791F',
  slate: '#475569',
}

const overviewBackBtn: CSSProperties = {
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

const heroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.3fr 0.9fr',
  gap: 18,
  alignItems: 'stretch',
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

const sectionIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 10,
  background: 'rgba(15,66,88,0.08)',
  color: '#0B2540',
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
}

const storyBox: CSSProperties = {
  marginTop: 18,
  maxWidth: 760,
  borderRadius: 20,
  padding: 18,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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

const mainGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.8fr',
  gap: 16,
}

const summaryCard: CSSProperties = {
  borderRadius: 20,
  padding: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const twoColumnGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
}

const funnelChart: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const funnelRow: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
}

const funnelFooterGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
}

const miniStatCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: 'rgba(244,248,252,0.95)',
  border: '1px solid rgba(15,66,88,0.07)',
}

const watchoutGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
}

const nextGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
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

const panelPill: CSSProperties = {
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

const panelPillAlt: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(72,177,217,0.12)',
  color: '#0B2540',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const panelTitle: CSSProperties = {
  margin: '14px 0 12px',
  fontSize: 24,
  color: '#0B2540',
}

const innerCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
}

const stepBadge: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 900,
  flexShrink: 0,
}

const miniTonePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const track: CSSProperties = {
  marginTop: 10,
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

const nextCard: CSSProperties = {
  borderRadius: 20,
  padding: 20,
  minHeight: 190,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 10px 24px rgba(13,30,60,0.10)',
  color: '#fff',
}

const softNotice: CSSProperties = {
  marginTop: 18,
  borderRadius: 16,
  padding: 14,
  background: 'rgba(245, 158, 11, 0.10)',
  border: '1px solid rgba(183, 121, 31, 0.18)',
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

const tr: CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
}

const actionBadge: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: '#0B2540',
  fontWeight: 800,
  fontSize: 12,
}

function intentBadge(intentLabel: string): CSSProperties {
  const key = intentLabel.toUpperCase()
  const palette = key === 'BLAZING' || key === 'HOT'
    ? { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' }
    : key === 'WARM'
      ? { bg: 'rgba(245,158,11,0.14)', color: '#B7791F' }
      : { bg: 'rgba(71,85,105,0.12)', color: '#475569' }

  return {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.color,
    fontWeight: 800,
    fontSize: 12,
  }
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
