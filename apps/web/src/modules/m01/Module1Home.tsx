import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

export default function Module1Home(){
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
          <h2 style={{ marginTop:16 }}>Module 1 — Home</h2>
        </div>
        <div style={{ fontSize:12, color:'#555' }}>Quick access to Module 1 features.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m01/upload`)}>Upload</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m01/leads`)}>Leads</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m01/merged`)}>Merged List</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m01/merge-columns`)}>Merge Columns</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m01/leads/preview`)}>Upload Preview</button>
        </div>
      </main>
    </Layout>
  )
}
