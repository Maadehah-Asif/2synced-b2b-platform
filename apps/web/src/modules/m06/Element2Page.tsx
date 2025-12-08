import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import './module6.css'
import ModuleBackButton from '../../components/ModuleBackButton'
import { useWorkspaceId } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Element2Page(){
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const [model, setModel] = useState<'first_touch'|'last_touch'|'linear'>('linear');
  const [preview, setPreview] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(()=>{(async()=>{
    if(!workspaceId) return;
    setLoadingPreview(true);
    try{
      const res = await fetch(`${API_URL}/m06/preview?projectId=${encodeURIComponent(workspaceId)}`);
      const j = await res.json();
      if(res.ok && j.deals) setPreview(j.deals || []);
    }catch(e){}
    setLoadingPreview(false);
  })()},[workspaceId]);

  function applyModelToDeal(deal:any, modelType:string){
    const revenue = Number(deal.revenue) || 0;
    const touches = deal.journey || [];
    const seq: string[] = [];
    for (const t of touches){
      const cid = String(t.campaign_id);
      if(seq.length===0 || seq[seq.length-1] !== cid) seq.push(cid);
    }
    if(seq.length===0) return [];
    const out:any[] = [];
    if(modelType === 'first_touch'){
      out.push({ campaign_id: seq[0], amount: revenue });
    } else if(modelType === 'last_touch'){
      out.push({ campaign_id: seq[seq.length-1], amount: revenue });
    } else {
      const n = seq.length;
      const per = n>0 ? (revenue / n) : 0;
      let acc = 0;
      for(let i=0;i<seq.length;i++){
        const amt = i === seq.length-1 ? Number((revenue-acc).toFixed(2)) : Number(per.toFixed(2));
        acc += amt;
        out.push({ campaign_id: seq[i], amount: amt });
      }
    }
    return out;
  }

  async function runAttribution(){
    if(!workspaceId) return;
    setRunning(true);
    setProgress('Collecting deals...');
    setSummary(null);
    try{
      const token = localStorage.getItem('token');
      setProgress('Building journeys...');
      await new Promise(r=>setTimeout(r,200));
      setProgress('Applying model...');
      const res = await fetch(`${API_URL}/m06/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ projectId: workspaceId, modelType: model }) });
      const j = await res.json();
      if(!res.ok) {
        setProgress('Error: ' + (j && j.error) );
        setRunning(false);
        return;
      }
      setProgress('Validating totals...');
      // fetch stored results from backend for this run
      if (j && j.runId) {
        const r2 = await fetch(`${API_URL}/m06/run/${encodeURIComponent(j.runId)}/results?projectId=${encodeURIComponent(workspaceId)}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        const jr = await r2.json();
        if (r2.ok && jr.results) {
          // group results by deal for display
          const byDeal: Record<string, any> = {};
          for (const row of jr.results) {
            const did = row.deal_id;
            byDeal[did] = byDeal[did] || { dealId: did, externalId: row.deal_external_id, revenue: preview.find(p => String(p.dealId)===String(did))?.revenue || null, allocations: [] };
            byDeal[did].allocations.push({ campaign_id: row.campaign_id, campaignName: row.campaignName, amount: row.revenue_share });
          }
          const previewAlloc = Object.values(byDeal);
          setSummary({ run: j, previewAlloc });
          setProgress('Done');
        } else {
          // fallback to local preview compute
          const previewAlloc = preview.map(d => ({ dealId: d.dealId, externalId: d.deal_external_id, revenue: d.revenue, allocations: applyModelToDeal(d, model) }));
          setSummary({ run: j, previewAlloc });
          setProgress('Done (local preview)');
        }
      } else {
        setProgress('Done');
      }
    }catch(e){
      setProgress('Error running attribution');
    }
    setRunning(false);
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — Attribution Runner (Page 2)</h2>
        </div>
        {!workspaceId && <div style={{ fontSize: 13 }}>Open a workspace to use the Attribution Runner.</div>}

        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="m7-card">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Model Selection</div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  <input type="radio" name="model" checked={model==='first_touch'} onChange={()=>setModel('first_touch')} /> First-Touch — Give 100% credit to the first campaign that touched the lead
                </label>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  <input type="radio" name="model" checked={model==='last_touch'} onChange={()=>setModel('last_touch')} /> Last-Touch — Give 100% credit to the last campaign before the deal
                </label>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  <input type="radio" name="model" checked={model==='linear'} onChange={()=>setModel('linear')} /> Linear — Split equally between all campaigns that touched
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" disabled={running || !workspaceId} onClick={runAttribution}>{running ? 'Running...' : 'Run Attribution'}</button>
                <div style={{ marginTop: 8, color: '#666' }}>{progress}</div>
              </div>
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Deal & Journey Preview</div>
              {loadingPreview ? <div style={{ fontSize: 13 }}>Loading preview...</div> : (
                <div style={{ marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <th style={{ padding: 6 }}>Deal</th>
                        <th style={{ padding: 6 }}>Revenue</th>
                        <th style={{ padding: 6 }}>Journey</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map(d => (
                        <tr key={d.dealId}>
                          <td style={{ padding: 6 }}>{d.deal_external_id || d.dealId}</td>
                          <td style={{ padding: 6 }}>${(Number(d.revenue)||0).toLocaleString()}</td>
                          <td style={{ padding: 6 }}>{(d.journey||[]).map((t:any)=>t.campaignName || t.campaign_id).join(' → ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          <div style={{ width: 420 }}>
            <div className="m7-card">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Run Summary</div>
              <div style={{ marginTop: 8 }}>
                {summary ? (
                  <div>
                    <div>Run ID: {summary.run && summary.run.runId}</div>
                    <div>Deals processed: {summary.run && summary.run.dealsProcessed}</div>
                    <div>Total revenue: ${summary.run && (Number(summary.run.totalRevenue)||0).toLocaleString()}</div>
                    <div>Attributed: ${summary.run && (Number(summary.run.totalAttributed)||0).toLocaleString()}</div>
                    <div>Results rows: {summary.run && summary.run.resultCount}</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>Sample Allocations</div>
                    <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <th style={{ padding: 6 }}>Deal</th>
                            <th style={{ padding: 6 }}>Revenue</th>
                            <th style={{ padding: 6 }}>Campaign</th>
                            <th style={{ padding: 6 }}>Assigned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.previewAlloc.map((p:any)=> (
                            p.allocations.map((a:any, idx:number)=> (
                              <tr key={`${p.dealId}-${idx}`}>
                                <td style={{ padding: 6 }}>{p.externalId}</td>
                                <td style={{ padding: 6 }}>${(Number(p.revenue)||0).toLocaleString()}</td>
                                <td style={{ padding: 6 }}>{a.campaign_id}</td>
                                <td style={{ padding: 6 }}>${(Number(a.amount)||0).toLocaleString()}</td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#666' }}>No run performed yet. Use the "Run Attribution" button to execute the model.</div>
                )}
              </div>
            </div>
          </div>

        </div>

      </main>
    </Layout>
  )
}
