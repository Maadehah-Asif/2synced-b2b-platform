import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import Module5OverviewPage from './Module5OverviewPage'
import Module5PipelinePage from './Module5PipelinePage'
import Module5CommunicationHubPage from './Module5CommunicationHubPage'
import Module5ShortcomingAnalyzerPage from './Module5ShortcomingAnalyzerPage'
import Module5WebEngagementPage from './Module5WebEngagementPage'
import Module5WebEngagementVisualizationPage from './Module5WebEngagementVisualizationPage'
import { getModule5ViewFromHash, setModule5View, type Module5View } from './navigation'

export default function Module5Home() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [view, setView] = useState<Module5View>(() => getModule5ViewFromHash())

  useEffect(() => {
    function syncView() {
      setView(getModule5ViewFromHash())
    }
    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view === 'home' ? (
            <>
              <ModuleBackButton toSuffix="" label="Back" />
              <h2 style={{ marginTop: 16 }}>Sales & Marketing Alignment</h2>
            </>
          ) : (
            <button type="button" className="btn-outline btn-sm" onClick={() => setModule5View('home')}>
              Back
            </button>
          )}
        </div>

        {view === 'overview' ? (
          <Module5OverviewPage />
        ) : view === 'pipeline' ? (
          <Module5PipelinePage />
        ) : view === 'shortcomings' ? (
          <Module5ShortcomingAnalyzerPage />
        ) : view === 'communication' ? (
          <Module5CommunicationHubPage />
        ) : view === 'web-engagement' ? (
          <Module5WebEngagementPage />
        ) : view === 'web-visualization' ? (
          <Module5WebEngagementVisualizationPage />
        ) : (
          <Module5Landing workspaceId={workspaceId} />
        )}
      </main>
    </Layout>
  )
}

function Module5Landing({ workspaceId }: { workspaceId: string | null }) {
  return (
    <>
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
            M05
          </div>
          <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Sales & Marketing Alignment</h1>
          <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
            Module 5 is the shared alignment layer for sales managers, marketing managers, and RevOps users. Use it to open the parts of the module that help both teams work from the same operating picture.
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr',
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
            Module Areas
          </div>
          <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open alignment workspaces</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <ActionCard
              title="Overview Dashboard"
              desc="Start with the current alignment snapshot to see whether lead and pipeline activity looks active, quiet, or uneven."
              action="Open Overview"
              status="Available"
              onClick={() => setModule5View('overview')}
            />
            <ActionCard
              title="Unified Pipeline"
              desc="Bring lead readiness, funnel movement, and ownership context into one manager-level pipeline view."
              action="Open Pipeline"
              status="Available"
              onClick={() => setModule5View('pipeline')}
            />
            <ActionCard
              title="Web Engagement Data Manager"
              desc="Upload, preview, archive, and manage website engagement datasets so the next Module 5 views have a trustworthy web signal layer."
              action="Open Data Manager"
              status="Available"
              onClick={() => setModule5View('web-engagement')}
            />
            <ActionCard
              title="Web Engagement Visualization"
              desc="Turn uploaded website engagement data into quick traffic, campaign, page-interest, and company-level signals for sales and marketing teams."
              action="Open Visualization"
              status="Available"
              onClick={() => setModule5View('web-visualization')}
            />
            <ActionCard
              title="Shortcoming Analyzer"
              desc="Turn alignment watchouts into a more systematic set of operational checks and weak-point detection rules."
              action="Open Analyzer"
              status="Available"
              onClick={() => setModule5View('shortcomings')}
            />
            <ActionCard
              title="Communication Hub"
              desc="Create a shared place for cross-team context, discussion, and follow-through around alignment decisions."
              action="Open Hub"
              status="Available"
              onClick={() => setModule5View('communication')}
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
            Useful Context
          </div>
          <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to use Module 5 now</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <StepCard step="1" title="Start from the overview" text="Use the Overview Dashboard first when you want the fastest shared read on activity, alignment, and visible funnel motion." />
            <StepCard step="2" title="Treat the other cards as the roadmap" text="The remaining cards show how Module 5 will expand into a broader alignment workspace over the next steps." />
            <StepCard step="3" title="Use it as a shared page" text={workspaceId ? 'Module 5 works best when sales and marketing teams review it together rather than as separate reporting views.' : 'Open Module 5 from a workspace context so it can behave like the other module home pages.'} />
          </div>
        </div>
      </section>
    </>
  )
}

function ActionCard({ title, desc, action, status, onClick, disabled = false }: { title: string; desc: string; action: string; status: 'Available' | 'Next' | 'Planned'; onClick?: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={() => {
        if (!disabled && onClick) onClick()
      }}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 18,
        padding: 20,
        minHeight: 182,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 24px rgba(13,30,60,0.10)',
        color: '#fff',
        transition: '0.25s ease',
        opacity: disabled ? 0.84 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 14px 28px rgba(13,30,60,0.16)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 10px 24px rgba(13,30,60,0.10)'
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Module Area
          </div>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: status === 'Available' ? 'rgba(236,253,243,0.16)' : status === 'Next' ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff' }}>
            {status}
          </div>
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
