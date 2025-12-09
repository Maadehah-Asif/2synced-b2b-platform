import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import useFatigueMonitor from './useFatigueMonitor'
import FatigueControlPanel from './FatigueControlPanel'
import FatigueSummaryTiles from './FatigueSummaryTiles'
import CampaignFatigueTable from './CampaignFatigueTable'
import FatiguedLeadsTable from './FatiguedLeadsTable'
import FatigueAlertsPanel from './FatigueAlertsPanel'

function getWorkspaceId() {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function FatigueMonitorPage(){
  const workspaceId = getWorkspaceId();
  const { data, loading, error, refetch, runFatigue } = useFatigueMonitor(workspaceId || undefined);

  if (!workspaceId) {
    window.location.hash = '#/workspaces';
    return null;
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ padding: '24px 24px 0' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#0B2540', fontSize: '28px', fontWeight: 800 }}>Campaign Fatigue Monitor</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Identify over-contacted leads and overstressed campaigns.</p>
          <div style={{ marginTop: 12 }}>
            <ModuleBackButton toSuffix={'/module7'} />
          </div>
          {error && (
            <div style={{ marginTop: 12, color: '#b91c1c' }}>Error: {String(error)}</div>
          )}
        </div>

        <div style={{ padding: 24 }}>
          <FatigueControlPanel loading={loading} onRun={async (opts) => { await runFatigue(opts); refetch(); }} />

          <div style={{ marginTop: 20 }}>
            <FatigueSummaryTiles summary={data?.summary || null} />
          </div>

          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div>
              <CampaignFatigueTable rows={data?.campaignStats || []} onRowClick={(cid) => { console.log('campaign clicked', cid); }} />
              <div style={{ marginTop: 16 }}>
                <FatiguedLeadsTable rows={data?.fatiguedLeads || []} onRowClick={(lid) => { window.location.hash = `#/workspace/${workspaceId}/lead/${lid}` }} />
              </div>
            </div>
            <div>
              <FatigueAlertsPanel alerts={data?.alerts || []} />
            </div>
          </div>
        </div>
      </main>
    </Layout>
  )
}
