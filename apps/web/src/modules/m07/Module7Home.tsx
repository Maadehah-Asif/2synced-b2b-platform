import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import './module7.css'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module7Home(){
  const wid = getWorkspaceIdFromHash()

  function go(path: string) {
    if (wid) window.location.hash = path.replace(':workspaceId', wid)
    else window.location.hash = '#/workspaces'
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton />
          <h2 style={{ marginTop:16 }}>Module 7</h2>
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
              M07
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Funnel Insight & Leakage Review</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Module 7 is where funnel data should be interpreted, not maintained. Lead, stage, and interaction records are now handled in Data Hub so this module home can stay focused on funnel analysis and conversion-health context.
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
              Insight Entry
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open funnel interpretation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ActionCard
                title="Funnel Overview"
                desc="Open the module-level overview for leakage reading, stalled-stage interpretation, and funnel health framing."
                action="Open Overview"
                onClick={() => go(`#/workspace/:workspaceId/m07/overview`)}
              />
              <InfoCard title="Where drop-offs happen" body="Use M07 to understand where leads stop progressing and which funnel stages create the most friction." />
              <InfoCard title="How interactions affect movement" body="Stage history and interaction records should explain whether momentum is improving, stalling, or degrading over time." />
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
              Interpretation Notes
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to use M07 now</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Keep records updated in Data Hub" text="Use the workspace-level Data Hub when you need to upload or manage leads, stage transitions, and interactions." />
              <StepCard step="2" title="Use this module for funnel reading" text="Treat this home page as the interpretation layer for leakage, conversion pacing, and campaign fatigue context." />
              <StepCard step="3" title="Expand insight screens later" text="As dedicated funnel dashboards stabilize, this module home can become the clean landing point for those outputs." />
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

function ActionCard({ title, desc, action, onClick }: { title: string; desc: string; action: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 18,
        padding: 20,
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 24px rgba(13,30,60,0.10)',
        color: '#fff',
        transition: '0.25s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 14px 28px rgba(13,30,60,0.16)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 10px 24px rgba(13,30,60,0.10)'
      }}
    >
      <div>
        <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Insight Page
        </div>
        <div style={{ marginTop: 12, fontSize: 21, fontWeight: 900, lineHeight: 1.25 }}>{title}</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.88)' }}>{desc}</div>
      </div>
      <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, alignSelf: 'flex-start' }}>
        {action}
      </div>
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
