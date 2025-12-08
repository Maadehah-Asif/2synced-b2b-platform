import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Prioritization(){
  const [workspace] = useState<string|null>(() => getWorkspaceIdFromHash());
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [meta, setMeta] = useState<any|null>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [message, setMessage] = useState<string|null>(null);
  const [filters, setFilters] = useState({ leadMin:0, leadMax:100, intentMin:0, intentMax:100, category: 'All', q: '' });

  useEffect(()=>{ fetchRuns(); }, [workspace]);

  async function fetchRuns(){
    if (!workspace) return;
    try{
      const res = await fetch(`${API_URL}/m02/intent-runs?workspace=${workspace}`);
      const j = await res.json();
      if (j?.ok) setRuns(j.runs || []); else setMessage(j?.error || 'failed to load runs');
    }catch(e){ setMessage('network error'); }
  }

  async function loadRun(id:string){
    setSelectedRun(id); setMessage(null); setMeta(null); setSamples([]);
    try{
      const res = await fetch(`${API_URL}/m02/run-data/${id}`);
      const j = await res.json();
      if (!j?.ok) { setMessage(j?.error || 'failed to load run'); return; }
      setMeta(j.meta || null);
      setSamples((j.samples || []).map((r:any)=>({ lead_id: r[0], name: r[1], email: r[2], LeadScore: parseFloat(r[3] || '0'), IntentScore: parseFloat(r[4] || '0'), IntentCategory: r[5] })));
    }catch(e){ setMessage('network error'); }
  }

  const filtered = useMemo(() => {
    return samples.filter(s => {
      if (!s) return false;
      if (s.LeadScore < filters.leadMin || s.LeadScore > filters.leadMax) return false;
      if (s.IntentScore < filters.intentMin || s.IntentScore > filters.intentMax) return false;
      if (filters.category !== 'All' && s.IntentCategory !== filters.category) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (!String(s.name||'').toLowerCase().includes(q) && !String(s.email||'').toLowerCase().includes(q) && !String(s.lead_id||'').toLowerCase().includes(q)) return false;
      }
      return true;
    }).slice(0,5000);
  }, [samples, filters]);

  // compute priority tier for display
  function computeTier(s:any){
    const ls = s.LeadScore||0; const is = s.IntentScore||0;
    if (ls >= 70 && is >= 70) return 'P1';
    if ((ls >=70 && is >=40) || (ls >=50 && is >=70)) return 'P2';
    if (ls >=50 && is < 40) return 'P3';
    return 'P4';
  }

  return (
    <Layout>
      <div className="p-20">
        <div style={{ display:'flex', alignItems:'center' }}>
          <ModuleBackButton toSuffix="/m02" />
          <h2 style={{ margin:0 }}>Prioritization Dashboard</h2>
        </div>
        <div className="mt-8">Rank and visualize leads using LeadScore + IntentScore.</div>

        <div className="mt-12" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <label>Select Intent Run</label>
          <select value={selectedRun||''} onChange={(e)=>{ const v=e.target.value; if(v){ loadRun(v); } else { setSelectedRun(null); setMeta(null); setSamples([]); } }}>
            <option value="">-- select run --</option>
            {runs.map(r=> (<option key={r._id} value={r._id}>{(r.filename||r._id) + ' — ' + (r.createdAt ? new Date(r.createdAt).toLocaleString() : '') + (r.rowCountAfter?(' — '+r.rowCountAfter+' rows'): '')}</option>))}
          </select>

          <div style={{ marginLeft: 'auto', display:'flex', gap:8, alignItems:'center' }}>
            {selectedRun && (<a className="btn-sm" href={`${API_URL}/m02/intent-runs/${selectedRun}/download?workspace=${workspace}`}>Download CSV</a>)}
          </div>
        </div>

        {!selectedRun && (
          <div className="mt-12 muted">No run selected. Generate Intent Scores first in Module 2.</div>
        )}

        {meta && (
          <div className="mt-12" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            <div className="box">Total leads<br/><strong>{meta.total}</strong></div>
            <div className="box">Avg LeadScore<br/><strong>{meta.avgLead.toFixed(1)}</strong></div>
            <div className="box">Avg IntentScore<br/><strong>{meta.avgIntent.toFixed(1)}</strong></div>
            <div className="box">Hot (P1)<br/><strong>{meta.quadrantCounts?.hot||0}</strong></div>
          </div>
        )}

        {meta && (
          <div className="mt-12" style={{ display:'flex', gap:20 }}>
            <div style={{ flex:1 }}>
              <h4>Scatter: LeadScore vs IntentScore</h4>
              <ScatterPlot data={filtered} width={600} height={400} />
            </div>
            <div style={{ width:320 }}>
              <h4>Intent category distribution</h4>
              <BarChart counts={meta.intentCategoryCounts || {}} />
              <h4 style={{ marginTop:16 }}>Segment summary</h4>
              <ul>
                <li>Hot (High Fit & High Intent): {meta.quadrantCounts?.hot||0}</li>
                <li>High Intent, Low Fit: {meta.quadrantCounts?.highIntentLowFit||0}</li>
                <li>Good Fit, Low Intent: {meta.quadrantCounts?.nurture||0}</li>
                <li>Cold: {meta.quadrantCounts?.cold||0}</li>
              </ul>
            </div>
          </div>
        )}

        {samples.length > 0 && (
          <div className="mt-12">
            <h4>Leads (sample)</h4>
            <div style={{ display:'flex', gap:12, marginBottom:8 }}>
              <div>LeadScore: <input type="range" min={0} max={100} value={filters.leadMin} onChange={(e)=>setFilters(f=>({ ...f, leadMin: parseInt(e.target.value) }))} /> {filters.leadMin}</div>
              <div>IntentScore: <input type="range" min={0} max={100} value={filters.intentMin} onChange={(e)=>setFilters(f=>({ ...f, intentMin: parseInt(e.target.value) }))} /> {filters.intentMin}</div>
              <div><input placeholder="search" value={filters.q} onChange={(e)=>setFilters(f=>({ ...f, q: e.target.value }))} /></div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="simple-table">
                <thead>
                  <tr><th>Lead</th><th>Email</th><th>LeadScore</th><th>IntentScore</th><th>Category</th><th>Priority</th></tr>
                </thead>
                <tbody>
                  {filtered.slice(0,200).map((s,i)=> (
                    <tr key={i} style={{ background: tierColor(computeTier(s)) }}>
                      <td>{s.name || s.lead_id}</td>
                      <td>{s.email}</td>
                      <td>{s.LeadScore}</td>
                      <td>{s.IntentScore}</td>
                      <td>{s.IntentCategory}</td>
                      <td>{computeTier(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {message && <div className="mt-12 muted">{message}</div>}
      </div>
    </Layout>
  );
}

function tierColor(t:string){
  if (t==='P1') return 'rgba(198, 255, 199, 0.6)';
  if (t==='P2') return 'rgba(255, 243, 205, 0.6)';
  if (t==='P3') return 'rgba(240,240,240,0.6)';
  return 'transparent';
}

function ScatterPlot({ data, width=600, height=400 }:{ data:any[]; width?:number; height?:number }){
  // map LeadScore (0-100) to x, IntentScore (0-100) to y
  const padding = 30;
  const pts = data.map(d => ({ x: (d.LeadScore||0)/100*(width-2*padding)+padding, y: (1-(d.IntentScore||0)/100)*(height-2*padding)+padding, name: d.name, email: d.email, ls: d.LeadScore, is: d.IntentScore }));
  return (
    <svg width={width} height={height} style={{ border:'1px solid #ddd', background:'#fff' }}>
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#eee" />
      <line x1={width/2} y1={padding} x2={width/2} y2={height-padding} stroke="#eee" />
      {pts.map((p,i)=> (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#1774FF" />
          <title>{`${p.name}\n${p.email}\nLeadScore: ${p.ls}\nIntentScore: ${p.is}`}</title>
        </g>
      ))}
      <text x={width-80} y={height/2-6} fontSize={12} fill="#888">Intent=70</text>
      <text x={width/2+6} y={16} fontSize={12} fill="#888">Lead=70</text>
    </svg>
  );
}

function BarChart({ counts }:{ counts:any }){
  const total = Number(Object.values(counts||{}).reduce((a:any,b:any)=>a+(Number(b||0)),0)) || 1;
  const keys = ['High','Medium','Low'];
  return (
    <div>
      {keys.map(k=> (
        <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:80 }}>{k}</div>
          <div style={{ flex:1, background:'#eee', height:12 }}>
            <div style={{ width: `${((Number(counts[k]||0)/total)*100).toFixed(2)}%`, background:'#1774FF', height:12 }} />
          </div>
          <div style={{ width:40, textAlign:'right' }}>{counts[k]||0}</div>
        </div>
      ))}
    </div>
  );
}
