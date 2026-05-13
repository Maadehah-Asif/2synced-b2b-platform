import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module9Home() {
  const cards = [
    {
      title: 'Cross-Channel Performance',
      body: 'Compare campaign results from multiple channels in one place so budget and attention can move based on a shared performance view.',
      action: 'Open Performance',
    },
    {
      title: 'Fatigue & Pacing Checks',
      body: 'Track where spend pace, frequency pressure, or campaign fatigue signals suggest that current delivery is becoming inefficient.',
      action: 'Open Monitoring',
    },
    {
      title: 'Optimization Recommendations',
      body: 'Translate campaign signals into concrete next moves such as budget shifts, refresh decisions, or channel-level changes.',
      action: 'Open Recommendations',
    },
  ]

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Campaign Performance Optimization</h2>
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
              Optimization Workspace
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Campaign Performance Aggregation & Optimization</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Campaign Performance Optimization is the centralized campaign performance layer. Its job is to combine campaign signals across channels, evaluate pacing and fatigue, and turn channel-level performance data into recommendations and export-ready optimization views.
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
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open optimization focus areas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {cards.map((card) => (
                <ActionCard key={card.title} title={card.title} desc={card.body} action={card.action} />
              ))}
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
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to use Campaign Performance Optimization for now</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Start from campaign and attribution context" text="Use campaign operations and revenue-attribution modules first when the source campaign data still needs preparation or interpretation before optimization decisions." />
              <StepCard step="2" title="Use this module for comparison and pressure checks" text="Read the cross-channel and fatigue cards here when the next question is where spend pace, performance, or creative pressure is strongest." />
              <StepCard step="3" title="Finish with optimization decisions" text="Use the recommendations side of this module when the team is ready to decide budget shifts, refresh priorities, or channel adjustments from the combined campaign picture." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}

function ActionCard({ title, desc, action }: { title: string; desc: string; action: string }) {
  return (
    <div
      style={{
        cursor: 'default',
        borderRadius: 18,
        padding: 20,
        minHeight: 180,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'left',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 24px rgba(13,30,60,0.10)',
        color: '#fff',
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
