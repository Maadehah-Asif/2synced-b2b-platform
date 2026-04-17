import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module9Home() {
  const wid = getWorkspaceIdFromHash()

  function go(path: string) {
    if (wid) window.location.hash = path.replace(':workspaceId', wid)
    else window.location.hash = '#/workspaces'
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Module 9</h2>
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
              M09
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Campaign Performance Aggregation & Optimization</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Module 9 is the centralized campaign performance layer. Its job is to combine campaign signals across channels, evaluate pacing and fatigue, and turn channel-level performance data into recommendations and export-ready optimization views.
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
              Module Screens
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open campaign aggregation workflows</h3>
            <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.7, marginBottom: 16, maxWidth: 760 }}>
              Module 9 should follow the same landing-page pattern as the other modules: open the feature area from here, then work inside a focused page for data operations and later optimization outputs.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ActionCard
                title="Campaign Data Import"
                desc="Upload Module 9 campaign CSV files into the shared workspace file library so campaign performance datasets can be collected before normalization and merge logic are added."
                action="Open Import Page"
                tag="Data Entry"
                icon="upload"
                bullets={['Upload raw CSVs', 'Preview and merge datasets']}
                onClick={() => go(`#/workspace/:workspaceId/m09/import`)}
              />
              <ActionCard
                title="What-If ROI Simulator"
                desc="Test campaign changes and see whether they improve outcomes before making the next move."
                action="Open Simulator"
                tag="Optimization"
                icon="simulator"
                bullets={['Decision-friendly results', 'Scenario-based ROI projection']}
                onClick={() => go(`#/workspace/:workspaceId/m09/simulator`)}
              />
              <ActionCard
                title="What-If Dev Tools"
                desc="Inspect model confidence, metrics, and technical scenario details for validation and tuning."
                action="Open Dev Tools"
                tag="Technical"
                icon="devtools"
                bullets={['Model metrics', 'Scenario response inspector']}
                onClick={() => go(`#/workspace/:workspaceId/m09/simulator-dev`)}
              />
              <InfoCard title="Cross-channel performance" body="Use M09 to bring campaign results from different platforms into one place so teams can compare channels without switching tools." />
              <InfoCard title="Optimization direction" body="This module will eventually connect campaign pacing, fatigue, and recommendation logic once imported source files can be normalized into one master dataset." />
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
              Current Status
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to use M09 for now</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Start with campaign data import" text="Use the Campaign Data Import card first so Module 9 source files are stored in the workspace and separated from other module uploads." />
              <StepCard step="2" title="Build normalized data next" text="Once imports are stable, Module 9 can expand into mapping, validation, normalization, and merge flows without changing the landing-page pattern." />
              <StepCard step="3" title="Expand toward optimization views" text="When recommendation panels and exportable optimization reports are added, this home page remains the entry point for those feature cards." />
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

function ActionCard({
  title,
  desc,
  action,
  onClick,
  tag,
  icon,
  bullets,
}: {
  title: string
  desc: string
  action: string
  onClick: () => void
  tag: string
  icon: 'upload' | 'simulator' | 'devtools'
  bullets: string[]
}) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {tag}
          </div>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              display: 'inline-grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {icon === 'upload' && (
                <>
                  <path d="M9 2.5v7.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="m5.8 6 3.2-3.5L12.2 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 11.8v1.7c0 .9.7 1.5 1.6 1.5h6.8c.9 0 1.6-.6 1.6-1.5v-1.7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                </>
              )}
              {icon === 'simulator' && (
                <>
                  <rect x="3" y="3.5" width="12" height="11" rx="2.2" stroke="white" strokeWidth="1.5" />
                  <path d="M5.8 11.4 8.1 9.2l1.9 1.5 2.3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="6" cy="6.6" r="0.8" fill="white" />
                  <circle cx="9" cy="6.6" r="0.8" fill="white" />
                  <circle cx="12" cy="6.6" r="0.8" fill="white" />
                </>
              )}
              {icon === 'devtools' && (
                <>
                  <rect x="3" y="4" width="12" height="10" rx="2.2" stroke="white" strokeWidth="1.5" />
                  <path d="M6 8.1h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M6 10.8h3.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="m11.2 2.6 1.1 1.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="m6 2.6-1.1 1.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
          </span>
        </div>
        <div style={{ marginTop: 12, fontSize: 21, fontWeight: 900, lineHeight: 1.25 }}>{title}</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.88)' }}>{desc}</div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {bullets.map((bullet) => (
            <span
              key={bullet}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.85)' }} />
              {bullet}
            </span>
          ))}
        </div>
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
