import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import './module6.css'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module6Home(){
  const wid = getWorkspaceIdFromHash();
  function go(path: string){
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton />
          <h2 style={{ marginTop:16 }}>Module 6</h2>
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
              M06
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Revenue Attribution & ROI</h1>
            <div style={{ maxWidth: 820, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Module 6 is the analysis layer for campaigns, touches, deals, and journeys. Its purpose is to explain contribution, revenue impact, and allocation decisions once the operational data has already been prepared in Data Hub.
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
              Insight Tools
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Open analytical views</h3>
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
                gap: '14px'
              }}
            >
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/element1`)} title="Dashboard" desc="View key stats and insight summaries." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/roi-calc`)} title="ROI Calculation" desc="Run ROI calculations from existing data." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/roi`)} title="ROI Dashboard" desc="Review attributed revenue and ROI visuals." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/forecast`)} title="Forecasts" desc="Predict revenue and performance trends." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/journeys`)} title="Journey Preview" desc="Preview customer journeys built from touch data." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/run-attribution`)} title="Run Attribution" desc="Analyze campaign contribution impact." />
              <Card onClick={() => go(`#/workspace/:workspaceId/m06/allocation`)} title="Allocation Dashboard" desc="Review budget allocation insights." />
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
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>What belongs here</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <MiniInfo title="Insight-side only" text="Campaign creation, touch input, lead tables, and deal management were intentionally moved to the workspace Data Hub." />
              <MiniInfo title="Best use case" text="Use M06 when you want contribution analysis, forecast views, ROI interpretation, or budget allocation guidance." />
              <MiniInfo title="Recommended sequence" text="Prepare campaign, touch, and deal data first. Then come here to interpret revenue and attribution outcomes." />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}

function Card({ title, desc, onClick }: { title: string, desc: string, onClick: ()=>void }) {
  return (
    <div 
      onClick={onClick}
      style={{
        padding: '20px',
        borderRadius: 16,
        cursor: 'pointer',
        minHeight: 142,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.10)',
        transition: '0.25s ease',
        color: 'white'
      }}
      onMouseEnter={(e)=> {
        e.currentTarget.style.boxShadow='0 10px 24px rgba(0,0,0,0.18)';
        e.currentTarget.style.transform='translateY(-4px)';
      }}
      onMouseLeave={(e)=> {
        e.currentTarget.style.boxShadow='0 8px 20px rgba(0,0,0,0.10)';
        e.currentTarget.style.transform='translateY(0)';
      }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.88, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 800, alignSelf: 'flex-start' }}>
        Open Insight
      </div>
    </div>
  );
}

function MiniInfo({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(255,255,255,0.8)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}
