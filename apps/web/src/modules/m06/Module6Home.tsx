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
        <div style={{ fontSize:12, color:'#555', marginTop:8 }}>Quick access to Module 6 features.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/element1`)}>Main Dashboard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/roi-calc`)}>ROI Calculation</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/roi`)}>ROI Dashboard</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/forecast`)}>Forecasts</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/campaigns`)}>View Campaigns</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/campaigns/manage`)}>Add Campaign</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/touches`)}>Campaign Touches</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/touches/input`)}>Add Touches</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/leads`)}>Leads (Import)</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/deals`)}>Deals</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/deals/input`)}>Add Deals</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/journeys`)}>Journey Preview</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/run-attribution`)}>Run Attribution</button>
          <button className="btn-primary btn-sm" onClick={()=>go(`#/workspace/:workspaceId/m06/allocation`)}>Allocation Dashboard</button>
        </div>
      </main>
    </Layout>
  )
}
