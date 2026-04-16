import type { CSSProperties, ReactNode } from 'react'

type Tone = 'navy' | 'teal' | 'amber' | 'slate'

const toneMap: Record<Tone, { accent: string; soft: string }> = {
  navy: { accent: '#0f4258', soft: 'rgba(15,66,88,0.10)' },
  teal: { accent: '#0F766E', soft: 'rgba(15,118,110,0.12)' },
  amber: { accent: '#B7791F', soft: 'rgba(245,158,11,0.14)' },
  slate: { accent: '#475569', soft: 'rgba(71,85,105,0.12)' },
}

const toneLabel: Record<Tone, string> = {
  navy: 'Core',
  teal: 'Ready',
  amber: 'Risk',
  slate: 'Context',
}

export function InsightHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <section style={heroSection}>
      <div style={{ padding: 28 }}>
        <div style={heroPill}>{eyebrow}</div>
        <h1 style={heroTitle}>{title}</h1>
        <div style={heroCopy}>{subtitle}</div>
      </div>
    </section>
  )
}

export function InsightPanel({
  eyebrow,
  title,
  children,
  soft = false,
  rightMeta,
}: {
  eyebrow: string
  title: string
  children: ReactNode
  soft?: boolean
  rightMeta?: ReactNode
}) {
  return (
    <section style={soft ? panelSoft : panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={sectionPill}>{eyebrow}</div>
          <h3 style={sectionTitle}>{title}</h3>
        </div>
        {rightMeta}
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  )
}

export function InsightKpiGrid({ children }: { children: ReactNode }) {
  return <section style={kpiGrid}>{children}</section>
}

export function InsightKpiCard({
  label,
  value,
  note,
  tone = 'navy',
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Tone
}) {
  const palette = toneMap[tone]
  return (
    <div style={{ ...kpiCard, borderTop: `4px solid ${palette.accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={kpiLabel}>{label}</div>
        <div style={{ ...miniPill, background: palette.soft, color: palette.accent }}>{toneLabel[tone]}</div>
      </div>
      <div style={kpiValue}>{value}</div>
      {note ? <div style={kpiNote}>{note}</div> : null}
    </div>
  )
}

export function InsightMiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  )
}

export function InsightNoteCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={noteCard}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#415274' }}>{body}</div>
    </div>
  )
}

const heroSection: CSSProperties = {
  marginTop: 18,
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
  background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.22) 100%)',
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

const heroTitle: CSSProperties = {
  margin: '16px 0 8px',
  fontSize: 38,
  lineHeight: 1.05,
  fontWeight: 900,
  color: '#fff',
}

const heroCopy: CSSProperties = {
  maxWidth: 780,
  color: 'rgba(255,255,255,0.84)',
  fontSize: 15,
  lineHeight: 1.7,
}

const panel: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const panelSoft: CSSProperties = {
  ...panel,
  background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
  boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
}

const sectionPill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: '#0B2540',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const sectionTitle: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 24,
  color: '#0B2540',
}

const kpiGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  marginTop: 18,
}

const kpiCard: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: '#fff',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 10px 24px rgba(13,30,60,0.06)',
}

const kpiLabel: CSSProperties = {
  fontSize: 12,
  color: '#5B6C8B',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const miniPill: CSSProperties = {
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const kpiValue: CSSProperties = {
  marginTop: 14,
  fontSize: 30,
  fontWeight: 900,
  color: '#0B2540',
  lineHeight: 1.05,
}

const kpiNote: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.65,
  color: '#415274',
}

const miniStatCard: CSSProperties = {
  borderRadius: 14,
  padding: 14,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(244,248,252,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
}

const miniStatLabel: CSSProperties = {
  fontSize: 11,
  color: '#5B6C8B',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const miniStatValue: CSSProperties = {
  marginTop: 7,
  fontSize: 20,
  fontWeight: 900,
  color: '#0B2540',
}

const noteCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
}
