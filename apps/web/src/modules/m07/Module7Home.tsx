import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

function getWorkspaceId(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function Module7Home(){
  const wid = getWorkspaceId();
  function go(path: string){ if(!wid) return; window.location.hash = path.replace(':workspaceId', wid); }
  
  const buttons = [
    { label: 'Funnel Health', path: '#/workspace/:workspaceId/module7/funnel-health' },
    { label: 'Leakage Prediction', path: '#/workspace/:workspaceId/module7/leakage-prediction' },
    { label: 'Fatigue Monitor', path: '#/workspace/:workspaceId/module7/fatigue-monitor' },
    { label: 'Recommendations', path: '#/workspace/:workspaceId/module7/recommendations' },
  ];

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop: 16 }}>Module 7 — Home</h2>
        <div style={{ marginTop: 8 }}>
          <ModuleBackButton toSuffix={''} />
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>Quick access to Module 7 features.</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          {buttons.map((btn) => (
            <button
              key={btn.label}
              className="bg-[#0A1A75] text-white px-6 py-3 rounded-full text-sm font-semibold shadow-md shadow-blue-900/20 hover:bg-[#1c2fb3] transition"
              onClick={() => go(btn.path)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </main>
    </Layout>
  )
}
