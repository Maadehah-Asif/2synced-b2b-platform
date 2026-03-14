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
      <main className="page-root">
        <h2 style={{ marginTop:16 }}>Module 6 — Home</h2>

        <div style={{ marginTop: 8 }}>
          <ModuleBackButton />
        </div>

        <div style={{ fontSize:12, color:'#555', marginTop:8 }}>
          Quick access to Module 6 features.
        </div>

        {/* --- FIXED 5x5x5 GRID --- */}
        <div 
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)', // ALWAYS 5 CARDS PER ROW
            gap: '14px'
          }}
        >
          <Card onClick={() => go(`#/workspace/:workspaceId/m06/element1`)}
            title="Dashboard"
            desc="View key stats and insights." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/roi-calc`)}
            title="ROI Calculation"
            desc="Calculate marketing ROI." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/roi`)}
            title="ROI Dashboard"
            desc="Understand performance with ROI visuals." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/forecast`)}
            title="Forecasts"
            desc="Predict revenue & performance trends." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/campaigns`)}
            title="View Campaigns"
            desc="Browse all active marketing campaigns." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/campaigns/manage`)}
            title="Add Campaign"
            desc="Create and configure new campaigns." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/touches`)}
            title="Campaign Touches"
            desc="Track key customer interactions." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/touches/input`)}
            title="Add Touches"
            desc="Record new campaign touchpoints." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/leads`)}
            title="Leads (Import)"
            desc="Import and manage workspace leads." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/deals`)}
            title="Deals"
            desc="View deal pipelines & progress." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/deals/input`)}
            title="Add Deals"
            desc="Insert new deals into pipeline." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/journeys`)}
            title="Journey Preview"
            desc="Preview customer funnel journeys." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/run-attribution`)}
            title="Run Attribution"
            desc="Analyze campaign contribution impact." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m06/allocation`)}
            title="Allocation Dashboard"
            desc="Review budget allocation insights." />
        </div>
      </main>
    </Layout>
  )
}

/* --- UPDATED GRADIENT CARD COMPONENT --- */
function Card({ title, desc, onClick }: { title: string, desc: string, onClick: ()=>void }) {
  return (
    <div 
      onClick={onClick}
      style={{
        padding: '22px',
        borderRadius: 14,
        cursor: 'pointer',
        height: 135,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',

        /* 💎 Premium gradient */
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',

        /* 🎨 Professional UI: soft border */
        border: '1px solid rgba(255,255,255,0.18)',

        /* 🌫 Smooth depth */
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',

        transition: '0.25s ease',
        color: 'white'
      }}

      onMouseEnter={(e)=> {
        e.currentTarget.style.boxShadow='0 8px 20px rgba(0,0,0,0.22)';
        e.currentTarget.style.transform='translateY(-4px) scale(1.015)';
      }}
      onMouseLeave={(e)=> {
        e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform='translateY(0) scale(1)';
      }}
    >
      <div style={{ 
        fontSize: 17, 
        fontWeight: 700, 
        letterSpacing: '-0.2px'
      }}>
        {title}
      </div>

      <div style={{ 
        fontSize: 13, 
        marginTop: 8, 
        opacity: 0.85, 
        lineHeight: 1.35 
      }}>
        {desc}
      </div>
    </div>
  );
}
