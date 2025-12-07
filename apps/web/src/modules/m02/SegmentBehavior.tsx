import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

function getWorkspaceId(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function SegmentBehavior(){
  const wid = getWorkspaceId();
  const [runs, setRuns] = useState<any[]>([]);
  const [runId, setRunId] = useState<string>('');
  const [segmentType, setSegmentType] = useState<string>('priority');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [channels, setChannels] = useState<string>('');
  const [eventTypes, setEventTypes] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{ if (!wid) return; fetch(`/m02/intent-runs?workspace=${wid}`).then(r=>r.json()).then(j=>{ if (j && j.runs) setRuns(j.runs); }).catch(()=>{}); },[wid]);

  function load(){
    setError(null);
    if (!runId) return setError('Select an intent run');
    if (start && end && new Date(start) > new Date(end)) return setError('Start date cannot be after end date');
    setLoading(true); setData(null);
    const params = new URLSearchParams();
    params.set('runId', runId);
    params.set('segmentType', segmentType);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (channels) params.set('channels', channels);
    if (eventTypes) params.set('eventTypes', eventTypes);
    fetch(`/m02/segment-behavior?${params.toString()}`).then(r=>r.json()).then(j=>{ setLoading(false); if (j.ok) setData(j); else setError(j.error || 'no data'); }).catch(()=>{ setLoading(false); setError('unable to load'); });
  }

  function openLead(runId:string, leadId:string){
    if (!wid) return; window.location.hash = `#/workspace/${wid}/m02/behavior?runId=${runId}&leadId=${leadId}`;
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" label="Back" />
          <h2 style={{ marginTop:16 }}>M2-4 — Segment Behavior Timeline</h2>
        </div>
        <div style={{ marginTop:12, display:'flex', gap:12, alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:12 }}>Intent Run</div>
            <select value={runId} onChange={e=>setRunId(e.target.value)} style={{ minWidth:260 }}>
              <option value="">-- select run --</option>
              {runs.map(r=> <option key={r._id} value={r._id}>{r.filename || r._id} — {r.rowCountAfter || r.rowCountBefore || 0} rows</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:12 }}>Segment Type</div>
            <select value={segmentType} onChange={e=>setSegmentType(e.target.value)}>
              <option value="priority">Priority Tier (P1..P4)</option>
              <option value="intentCategory">Intent Category (High/Medium/Low)</option>
              <option value="leadScoreBand">LeadScore Band</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:12 }}>Start</div>
            <input type="date" value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12 }}>End</div>
            <input type="date" value={end} onChange={e=>setEnd(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12 }}>Channels (csv)</div>
            <input placeholder="email,ads,linkedin" value={channels} onChange={e=>setChannels(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:12 }}>Event types (csv)</div>
            <input placeholder="email_open,site_visit" value={eventTypes} onChange={e=>setEventTypes(e.target.value)} />
          </div>
          <div>
            <button className="btn-primary btn-sm" onClick={load} disabled={loading}>Load</button>
          </div>
        </div>

        {error && <div style={{ marginTop:12, color:'crimson' }}>{error}</div>}
        {loading && <div style={{ marginTop:12 }}>Loading...</div>}

        {data && (
          <div style={{ marginTop:16 }}>
            <h3>Segment overview</h3>
            <div style={{ display:'flex', gap:12 }}>
              {Object.keys(data.groups || {}).map(k => {
                const g = data.groups[k];
                return (
                  <div key={k} style={{ border:'1px solid #ddd', padding:12, minWidth:180 }}>
                    <div style={{ fontWeight:600 }}>{k}</div>
                    <div style={{ fontSize:12 }}>Leads: {g.totalLeads}</div>
                    <div style={{ fontSize:12 }}>Avg Intent: {Number(g.avgIntent).toFixed(2)}</div>
                    <div style={{ fontSize:12 }}>Avg LeadScore: {Number(g.avgLead).toFixed(2)}</div>
                    <div style={{ marginTop:8 }}>
                      <button className="btn-link" onClick={()=>{ /* filter to this segment */ setData({...data, filteredSegment:k}); }}>Focus</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <h3 style={{ marginTop:18 }}>Timeline</h3>
            <div style={{ border:'1px solid #eee', padding:12 }}>
              {Object.keys(data.timeseries || {}).map(seg => (
                <div key={seg} style={{ marginBottom:12 }}>
                  <div style={{ fontWeight:600 }}>{seg}</div>
                  <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:80 }}>
                    {Object.entries((data.timeseries && data.timeseries[seg]) || {}).map(([k,v]) => {
                      const n = Number(v as any || 0);
                      return (<div key={k} title={`${k}: ${n}`} style={{ width:10, height: Math.min(80, n*2), background:'#3b82f6', opacity:0.9 }}></div>);
                    })}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop:18 }}>Channel Breakdown</h3>
            <div style={{ display:'flex', gap:12 }}>
              {Object.keys(data.channelBreakdown || {}).map(seg => (
                <div key={seg} style={{ minWidth:220, border:'1px solid #eee', padding:8 }}>
                  <div style={{ fontWeight:600 }}>{seg}</div>
                  {Object.entries((data.channelBreakdown && data.channelBreakdown[seg]) || {}).map(([ch,cnt]) => (
                    <div key={ch} style={{ display:'flex', justifyContent:'space-between' }}>
                      <div>{ch}</div>
                      <div style={{ fontWeight:600 }}>{String(cnt)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <h3 style={{ marginTop:18 }}>Top leads by segment</h3>
            <div>
              {Object.keys(data.topLeads || {}).map(seg => (
                <div key={seg} style={{ marginBottom:12 }}>
                  <div style={{ fontWeight:600 }}>{seg}</div>
                  <table className="simple-table" style={{ width:'100%' }}>
                    <thead><tr><th>lead</th><th>intent</th><th>leadScore</th><th></th></tr></thead>
                    <tbody>
                      {(data.topLeads[seg]||[]).map((l:any)=> (
                        <tr key={l.leadId}>
                          <td>{l.row && (l.row.name || l.row.Name) ? (l.row.name||l.row.Name) : l.leadId}</td>
                          <td>{Number(l.intent).toFixed(2)}</td>
                          <td>{Number(l.leadScore).toFixed(2)}</td>
                          <td><button className="btn-link" onClick={()=>openLead(runId, l.leadId)}>View lead</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </Layout>
  )
}
