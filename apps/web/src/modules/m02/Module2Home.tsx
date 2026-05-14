import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

export default function Module2Home() {
  const wid = getWorkspaceIdFromHash();

  function go(path: string) {
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Intent Signals</h2>
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
              Prioritization Layer
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Intent Signals & Prioritization</h1>
            <div style={{ maxWidth: 760, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Intent Signals turns lead and behavior data into prioritization signals. Use it when the question is not just who exists in the pipeline, but who is most worth acting on next.
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
              Insight Tools
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Where to work inside Intent Signals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <InsightCard title="Intent Dashboard" desc="Open the visual dashboard to compare intent mix, lead-fit alignment, and the strongest high-intent pockets inside a selected final CSV." onClick={() => go(`#/workspace/:workspaceId/m02/dashboard`)} />
              <InsightCard title="Generate Intent Scores" desc="Run the scoring pipeline on prepared datasets before reviewing prioritization and forecast outputs." onClick={() => go(`#/workspace/:workspaceId/m02/generate`)} />
              <InsightCard title="Prioritization Dashboard" desc="Rank leads by conversion likelihood and identify who deserves immediate attention." onClick={() => go(`#/workspace/:workspaceId/m02/prioritization`)} />
              <InsightCard title="Report Center" desc="Open the written intent report with prioritization summaries and downloadable supporting exports." onClick={() => go(`#/workspace/:workspaceId/m08/m02`)} />
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
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>How to work through Intent Signals</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Prepare intent-ready data first" text="Use the Data Hub upload and merge screens first so the lead and behavior records are ready before any scoring run starts." />
              <StepCard step="2" title="Run Generate Intent Scores first" text="Open Generate Intent Scores when you want to create or refresh the prioritization layer from the prepared dataset." />
              <StepCard step="3" title="Move into prioritization and reporting" text="Open Prioritization Dashboard when the question is who to act on next, then use the report center to summarize the current intent picture and recommended actions." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function InsightCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 18,
        padding: '22px',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        color: 'white',
        minHeight: 180,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'left',
        appearance: 'none',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
        transition: '0.25s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div>
        <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Insight Page
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>{desc}</div>
      </div>
      <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 800, alignSelf: 'flex-start' }}>
        Open Insight
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
