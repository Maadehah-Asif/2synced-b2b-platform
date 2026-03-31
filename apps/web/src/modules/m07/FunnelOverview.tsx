import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

export default function FunnelOverview() {
  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m07" />
          <h2 style={{ marginTop: 16 }}>Funnel Overview</h2>
        </div>

        <section
          style={{
            marginTop: 18,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
            background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.22) 100%)',
            color: '#fff',
          }}
        >
          <div style={{ padding: 28 }}>
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              M07 Overview
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Funnel Health Overview</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              This page is the high-level interpretation layer for funnel movement. Use it to frame where drop-offs, stalled stages, and weak follow-up patterns are likely to be happening before drilling into record-level screens.
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr',
            gap: 18,
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Read This Module
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>What to look for first</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoCard title="Stage bottlenecks" body="Identify where progression slows down, especially between early qualification, active engagement, and later-stage conversion points." />
              <InfoCard title="Interaction quality" body="Compare movement against the timing and quality of interaction records to spot where follow-up volume exists but momentum does not." />
              <InfoCard title="Leakage patterns" body="Use the operational screens when needed, but keep this page focused on understanding why records are leaking rather than editing them directly." />
            </div>
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Recommended Flow
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to work from here</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Review funnel context here" text="Start from the module insight layer to frame the likely leakage pattern before making record-level changes." />
              <StepCard step="2" title="Open data screens when needed" text="If a bottleneck needs correction, move into leads, stage history, or interaction pages from the workspace Data Hub." />
              <StepCard step="3" title="Return for interpretation" text="Use this page as the reset point for understanding whether updates should improve movement through the funnel." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0B2540', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>{body}</div>
    </div>
  )
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>
        {step}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}
