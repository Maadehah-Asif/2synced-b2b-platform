import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module1Home(){
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
          <h2 style={{ marginTop: 16 }}>Lead Quality & Scoring</h2>
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
              Quality Control Layer
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Lead Quality & Scoring</h1>
            <div style={{ maxWidth: 760, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Lead Quality & Scoring is the quality-control layer for lead intake. Its job is to turn uploaded and merged lead records into cleaner, more usable lead scoring inputs so downstream modules can work from a stronger baseline.
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
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
              Lead Workspace
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open lead-quality workflows</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ActionCard
                title="Lead View"
                desc="Open the lead records area to review created lead sets, inspect details, and manage module 1 lead-ready outputs."
                action="Open Lead View"
                onClick={() => go(`#/workspace/:workspaceId/m01/leads`)}
              />
              <ActionCard
                title="Lead Quality Forecast"
                desc="Project average lead score, high-quality share, and data hygiene pressure before future batches reach downstream modules."
                action="Open Forecast"
                onClick={() => go(`#/workspace/:workspaceId/m01/forecast`)}
              />
              <ActionCard
                title="Report Center"
                desc="Open the written lead-quality report with summary findings and downloadable supporting exports."
                action="Open Report"
                onClick={() => go(`#/workspace/:workspaceId/m08/m01`)}
              />
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
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to work through Module 1</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Start in Data Hub" text="Upload raw lead files and review merged CSVs in the workspace Data Hub first so Module 1 receives cleaner source records." />
              <StepCard step="2" title="Open Lead View for record review" text="Use Lead View when you need to inspect the created Module 1 lead records, confirm field completeness, and catch quality issues before scoring-dependent work." />
              <StepCard step="3" title="Open Lead Quality Forecast next" text="Use the forecast screen after the lead set looks stable so you can estimate lead-score direction and decide whether the dataset is ready for downstream intent, revenue, or funnel work." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}

function ActionCard({ title, desc, action, onClick }: { title: string; desc: string; action: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 18,
        padding: 20,
        minHeight: 180,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'left',
        appearance: 'none',
        position: 'relative',
        zIndex: 1,
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
    </button>
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
