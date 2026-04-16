import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

export default function Module5Home() {
  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Sales & Marketing Alignment</h2>
        </div>

        <section
          style={{
            marginTop: 18,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
            background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
            color: '#fff',
          }}
        >
          <div style={{ padding: 28 }}>
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Sales & Marketing Alignment
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Sales & Marketing Alignment</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Sales & Marketing Alignment is the shared performance layer for sales and marketing teams. Its role is to keep both sides aligned through common KPIs, funnel visibility, and collaboration signals so planning decisions come from the same operational picture.
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
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
              Dashboard Purpose
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>What this module should help teams see</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoCard title="Shared KPI visibility" body="Use Sales & Marketing Alignment to compare the KPIs that matter to both sales and marketing instead of forcing each team to read different dashboards in isolation." />
              <InfoCard title="Funnel alignment" body="This module should make it easier to spot where lead quality, conversion movement, and handoff performance are drifting between teams." />
              <InfoCard title="Collaboration checkpoints" body="It is the right place to surface follow-up ownership, response gaps, and places where joint planning needs attention." />
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
              Recommended Use
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to treat Sales & Marketing Alignment for now</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Use it as the alignment landing" text="This page defines the role of module 5 while the deeper alignment dashboards are still being introduced." />
              <StepCard step="2" title="Read it across modules" text="The best signals here will eventually combine lead, funnel, intent, and revenue context rather than staying isolated in one workflow." />
              <StepCard step="3" title="Expand from shared metrics" text="When the actual alignment dashboard is added, this is the right place to connect KPI summaries, collaboration indicators, and funnel checkpoints." />
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
