import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import './module7.css'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module7Home(){
  const wid = getWorkspaceIdFromHash();
  function go(path: string){
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop:16 }}>Module 7 — Funnel Home</h2>

        <div style={{ marginTop: 8 }}>
          <ModuleBackButton />
        </div>

        <div style={{ fontSize:12, color:'#555', marginTop:8 }}>
          Access Funnel diagnostics, leakage maps and campaign fatigue tools.
        </div>

        <div 
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '14px'
          }}
        >
          <Card onClick={() => go(`#/workspace/:workspaceId/m07/leads/upload`) }
            title="Leads - Add / Upload"
            desc="Add single leads or bulk CSV upload for funnel analysis." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/leads`) }
            title="Leads - Manage"
            desc="View, filter, edit, and archive funnel leads." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/stages/upload`) }
            title="Stage History - Add / Upload"
            desc="Import or manually add lead stage transitions (entered/exited dates)." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/stages`) }
            title="Stage History - Manage"
            desc="View, filter, edit, archive stage history records." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/interactions/upload`) }
            title="Interactions - Add / Upload"
            desc="Add interaction events or bulk CSV uploads (email, call, ad)." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/interactions`) }
            title="Interactions - Manage"
            desc="View, filter, edit, and archive interaction events." />

          <Card onClick={() => go(`#/workspace/:workspaceId/m07/overview`) }
            title="Funnel Overview"
            desc="Top-level funnel health and key conversion metrics (placeholder)." />
        </div>
      </main>
    </Layout>
  )
}

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
        background: 'linear-gradient(145deg, #0f4258 0%, #195b74 50%, #1e6b88 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
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
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85, lineHeight: 1.35 }}>{desc}</div>
    </div>
  );
}
