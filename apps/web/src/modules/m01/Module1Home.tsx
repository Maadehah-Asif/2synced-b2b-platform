import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module1Home(){
  const wid = getWorkspaceIdFromHash();
  function go(path: string){
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }

  function Card({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }){
    return (
      <div
        onClick={onClick}
        style={{
          cursor: 'pointer',
          borderRadius: 14,
          padding: '26px 26px',
          background: 'linear-gradient(135deg, #0f4258 0%, #083242 100%)',
          color: 'white',
          minHeight: 150,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
          transition: '0.25s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, marginTop: 8, opacity: 0.9 }}>{desc}</div>
      </div>
    )
  }

  return (
    <Layout>
      <main className="page-root">

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop: 16 }}>Module 1 — Home</h2>
        </div>

        <div style={{ fontSize: 12, color: '#555' }}>Quick access to Module 1 features.</div>

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }}
        >
          <Card title="Upload" desc="Import lead data files." onClick={() => go(`#/workspace/:workspaceId/m01/upload`)} />
          <Card title="Leads" desc="Explore and manage leads." onClick={() => go(`#/workspace/:workspaceId/m01/leads`)} />
          <Card title="Merged List" desc="View all merged records." onClick={() => go(`#/workspace/:workspaceId/m01/merged`)} />
        </div>

      </main>
    </Layout>
  )
}
