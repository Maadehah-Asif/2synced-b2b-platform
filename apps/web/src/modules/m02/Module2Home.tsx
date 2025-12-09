import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module2Home(){
  const wid = getWorkspaceIdFromHash();
  function go(path: string){
    if (wid) window.location.hash = path.replace(':workspaceId', wid);
    else window.location.hash = '#/workspaces';
  }
  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="" label="Back" />
          <h2 style={{ marginTop:16 }}>Module 2  Home</h2>
        </div>
        <div style={{ fontSize:12, color:'#555' }}>Quick access to Module 2 features.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/upload`)}>Upload</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/upload-wizard`)}>Upload Wizard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/leads`)}>Leads</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/merged`)}>Merged List</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/merge-columns`)}>Merge Columns</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/generate`)}>Generate Intent Scores</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/prioritization`)}>Prioritization Dashboard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m02/intent-forecast`)}>Intent Forecast</button>
        </div>
      </main>
    </Layout>
  )
}

