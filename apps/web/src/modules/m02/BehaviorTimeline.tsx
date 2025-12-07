import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import Autocomplete from '../../components/Autocomplete';
import { listTouchesByLead } from '../m06/services/touches';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getWorkspaceFromHash(){
  const m = window.location.hash.match(/workspace=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

function getQueryParam(name:string){
  try{ const p = new URLSearchParams(window.location.hash.split('?')[1] || ''); return p.get(name); }catch(e){return null}
}

export default function BehaviorTimeline(){
  const [workspace] = useState<string|null>(() => getWorkspaceFromHash());
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(getQueryParam('runId'));
  const [leadQuery, setLeadQuery] = useState(getQueryParam('leadId') || '');
  const [samples, setSamples] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(getQueryParam('leadId'));
  const [leadRow, setLeadRow] = useState<any|null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [channels, setChannels] = useState<string>('');
  const [types, setTypes] = useState<string>('');
  const [message, setMessage] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ fetchRuns(); }, [workspace]);
  useEffect(()=>{ if(selectedRun) fetchRunData(selectedRun); }, [selectedRun]);
  useEffect(()=>{ if(selectedRun && selectedLead) loadLeadAndEvents(selectedRun, selectedLead); }, [selectedRun, selectedLead, startDate, endDate, channels, types]);

  async function fetchRuns(){
    if(!workspace) return;
    try{ const res = await fetch(`${API_URL}/m02/intent-runs?workspace=${workspace}`); const j = await res.json(); if(j?.ok) setRuns(j.runs||[]); }catch(e){ }
  }

  async function fetchRunData(id:string){
    try{ const res = await fetch(`${API_URL}/m02/run-data/${id}`); const j = await res.json(); if(j?.ok){ setSamples((j.samples||[]).map((r:any)=>({ lead_id:r[0], name:r[1], email:r[2], LeadScore: parseFloat(r[3]||'0'), IntentScore: parseFloat(r[4]||'0'), IntentCategory: r[5]}))); } }
    catch(e){}
  }

  async function loadLeadAndEvents(runId:string, leadId:string){
    setLoading(true); setMessage(null); setLeadRow(null); setEvents([]);
    try{
      const res = await fetch(`${API_URL}/m02/run-lead/${runId}/${encodeURIComponent(leadId)}`);
      if(!res.ok){ const j = await res.json(); setMessage(j?.error || 'lead not found'); setLoading(false); return; }
      const j = await res.json(); setLeadRow(j.row || null);
      // fetch touches for this lead via m06 service
      const qparams:any = { leadId };
      if(startDate) qparams.from = startDate;
      if(endDate) qparams.to = endDate;
      if(channels) qparams.channel = channels;
      if(types) qparams.type = types;
      const ev = await listTouchesByLead(qparams);
      if(Array.isArray(ev)) setEvents(ev as any[]);
    }catch(e){ setMessage('network error'); }
    setLoading(false);
  }

  const leadOptions = useMemo(()=>samples.map(s=> ({ id: s.lead_id, label: `${s.name||s.lead_id} — ${s.email||''}` })), [samples]);

  function onPickLead(id:string|null){ setSelectedLead(id); }

  // compute driver heuristics from events
  const drivers = useMemo(()=>{
    if(!events || events.length===0) return [];
    const now = Date.now();
    const windows = { short:14*24*3600*1000, medium:45*24*3600*1000, long:120*24*3600*1000 };
    const counts:any = {};
    for(const e of events){
      let t = Date.parse(e.touched_at || e.touchedAt || e.date || ''); if(isNaN(t)) continue;
      const age = now - t;
      const win = age <= windows.short ? 'short' : (age <= windows.medium ? 'medium' : 'long');
      const key = `${win}|${e.type||e.type_name||'other'}`;
      counts[key] = (counts[key]||0)+1;
    }
    const arr = Object.keys(counts).map(k=>{ const [win, type] = k.split('|'); return { window:win, type, count: counts[k] }; }).sort((a,b)=>b.count-a.count);
    return arr.slice(0,10);
  }, [events]);

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display:'flex', alignItems:'center' }}>
          <ModuleBackButton toSuffix="/m02" />
          <h2 style={{ margin:0 }}>Behavior Timeline & Top Drivers</h2>
        </div>
        <div className="mt-8">Inspect a lead's behavior and the top drivers behind their IntentScore.</div>

        <div className="mt-12" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <label>Select Intent Run</label>
          <select value={selectedRun||''} onChange={(e)=>{ const v=e.target.value; setSelectedRun(v||null); setSelectedLead(null); setLeadRow(null); window.location.hash = `#/workspace/${workspace}/m02/behavior?runId=${v||''}`; }}>
            <option value="">-- select run --</option>
            {runs.map(r=> (<option key={r._id} value={r._id}>{(r.filename||r._id) + ' — ' + new Date(r.createdAt).toLocaleString()}</option>))}
          </select>

          <div style={{ marginLeft:12 }}>
            <Autocomplete placeholder="Pick lead" value={leadQuery} fetchItems={async (q)=>{
              setLeadQuery(q);
              return leadOptions.filter(o=>String(o.label).toLowerCase().includes(q.toLowerCase())).slice(0,50).map(o=>({ id:o.id, label:o.label }));
            }} formatItem={(o:any)=>o.label} getValue={(o:any)=>o.id} onChange={(val, item)=>{ if(item) { setSelectedLead(String(item.id)); window.location.hash = `#/workspace/${workspace}/m02/behavior?runId=${selectedRun||''}&leadId=${encodeURIComponent(String(item.id))}`; } }} />
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <label>From</label>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
            <label>To</label>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
            <label>Channel</label>
            <select value={channels} onChange={(e)=>setChannels(e.target.value)}>
              <option value="">All</option>
              <option value="email">Email</option>
              <option value="ads">Ads</option>
              <option value="linkedin">LinkedIn</option>
              <option value="webinar">Webinar</option>
            </select>
            <button className="btn-ghost" onClick={()=>{ if(selectedRun && selectedLead) loadLeadAndEvents(selectedRun, selectedLead); }}>Reload</button>
          </div>
        </div>

        {!selectedRun && <div className="mt-12 muted">Select an intent run to continue.</div>}

        {selectedRun && !selectedLead && <div className="mt-12 muted">Select a lead (or click one from Prioritization) to view timeline.</div>}

        {message && <div className="mt-12" style={{ color:'#900' }}>{message}</div>}

        {loading && <div className="mt-12">Loading...</div>}

        {leadRow && (
          <div className="mt-12" style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16 }}>
            <div>
              <div style={{ background:'#fff', padding:12, borderRadius:8 }}>
                <h4>Timeline</h4>
                <TimelineSVG events={events} />
              </div>

              <div className="mt-12" style={{ background:'#fff', padding:12, borderRadius:8 }}>
                <h4>Event details</h4>
                {events.length===0 && <div className="muted">No events found for this lead.</div>}
                {events.length>0 && (
                  <table className="simple-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Channel</th><th>Campaign</th></tr></thead>
                    <tbody>
                      {events.map((e:any,i:number)=>(<tr key={i}><td>{new Date(e.touched_at).toLocaleString()}</td><td>{e.type}</td><td>{e.channel}</td><td>{e.campaign_name||e.campaign_id}</td></tr>))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div>
              <div style={{ background:'#fff', padding:12, borderRadius:8 }}>
                <h4>Intent Summary</h4>
                <div><strong>IntentScore:</strong> {leadRow.IntentScore || leadRow.intentscore || '—'}</div>
                <div><strong>IntentCategory:</strong> {leadRow.IntentCategory || leadRow.intentcategory || '—'}</div>
                <div style={{ marginTop:8 }}><strong>Top Drivers</strong></div>
                <ul>
                  {drivers.map((d:any,i:number)=> (<li key={i}><strong>{d.type}</strong> — {d.count} events ({d.window})</li>))}
                </ul>
                <div style={{ marginTop:8 }}>
                  <strong>Explanation</strong>
                  <div style={{ fontSize:13, color:'#555' }}>
                    {drivers.length===0 ? 'No recent high-impact behaviors found.' : `Recent ${drivers[0].type} events in the ${drivers[0].window} window are the primary driver.`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

function TimelineSVG({ events }:{ events:any[] }){
  const width = 900, height = 140, padding=30;
  const now = Date.now();
  const minT = events.length? Math.min(...events.map(e=>Date.parse(e.touched_at)||now)) : now - 14*24*3600*1000;
  const maxT = events.length? Math.max(...events.map(e=>Date.parse(e.touched_at)||now)) : now;
  const range = Math.max(1, maxT - minT);
  return (
    <svg width={Math.min(width, window.innerWidth-120)} height={height} style={{ border:'1px solid #eee', background:'#fff' }}>
      {/* windows: short/medium/long shading from right (most recent) */}
      {/* draw events */}
      {events.map((e,i)=>{
        const t = Date.parse(e.touched_at) || now;
        const x = padding + ((t - minT)/range) * (Math.min(width, window.innerWidth-120) - padding*2);
        const y = height/2;
        return (<g key={i}><circle cx={x} cy={y} r={6} fill="#1774FF" /><title>{new Date(t).toLocaleString()}\n{e.type} • {e.channel}</title></g>);
      })}
      <line x1={padding} y1={height-20} x2={Math.min(width, window.innerWidth-120)-padding} y2={height-20} stroke="#ddd" />
    </svg>
  );
}
