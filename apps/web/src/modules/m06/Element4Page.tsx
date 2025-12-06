import { useEffect, useState } from 'react';
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import './module6.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function useWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

function numberFmt(v: number | null | undefined){
  if(v === null || v === undefined) return '-';
  return (Math.round(v * 100) / 100).toLocaleString();
}

export default function Element4Page(){
  const workspaceId = useWorkspaceIdFromHash();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [monthsAhead, setMonthsAhead] = useState<number>(6);
  const [spendMultiplier, setSpendMultiplier] = useState<number>(1);
  const [targetROI, setTargetROI] = useState<number | null>(20);

  async function fetchForecast(){
    if(!workspaceId) return;
    setLoading(true);
    setError(null);
    try{
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('projectId', workspaceId);
      params.set('months', String(monthsAhead));
      if(spendMultiplier) params.set('spendMultiplier', String(spendMultiplier));
      if(targetROI !== null) params.set('target', String(targetROI));
      const res = await fetch(`${API_URL}/m06/forecast?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      const j = await res.json();
      if(!res.ok) { setError(j && j.message ? String(j.message) : (j && j.error ? String(j.error) : 'error')); setData(null); }
      else setData(j);
    }catch(e){ setError('network error'); setData(null); }
    setLoading(false);
  }

  useEffect(()=>{ fetchForecast() }, [workspaceId]);

  if(loading) return <Layout><main className="page-root"><div>Loading forecast...</div></main></Layout>;
  if(!data) return <Layout><main className="page-root"><div>No forecast data. {error && <span style={{ color: 'crimson' }}>{error}</span>}</div></main></Layout>;

  // Tiles
  const next = data.predictions && data.predictions[0];
  const nextROI = next ? (next.roi === null ? '-' : numberFmt(next.roi) + '%') : '-';
  const confRange = next ? (next.roi_min === null ? '-' : `${numberFmt(next.roi_min)}% – ${numberFmt(next.roi_max)}%`) : '-';

  function exportCSV(){
    if(!data) return;
    const rows = data.predictions || [];
    const cols = ['month','predicted_attributed','attrib_min','attrib_max','spend','roi','roi_min','roi_max'];
    const header = cols.join(',') + '\n';
    const body = rows.map((r:any)=> cols.map(c=>{
      switch(c){
        case 'predicted_attributed': return '"'+String(Math.round(r.attributed||0))+'"';
        case 'attrib_min': return '"'+String(Math.round(r.attributed_min||0))+'"';
        case 'attrib_max': return '"'+String(Math.round(r.attributed_max||0))+'"';
        case 'spend': return '"'+String(Math.round(r.spend||0))+'"';
        case 'roi': return '"'+(r.roi===null? '': String(Math.round(r.roi)))+'"';
        case 'roi_min': return '"'+(r.roi_min===null? '': String(Math.round(r.roi_min)))+'"';
        case 'roi_max': return '"'+(r.roi_max===null? '': String(Math.round(r.roi_max)))+'"';
        default: return '"'+String(r.month || '')+'"';
      }
    }).join(',')).join('\n');
    const csv = header + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `forecast-${workspaceId}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  // Simple SVG line chart for historical ROI and predicted ROI (using attributed -> ROI transformation)
  const hist = data.historical || [];
  const preds = data.predictions || [];
  // derive ROI historical using approxMonthlySpend
  const monthlySpend = data.approxMonthlySpend || 0;
  const histROI = hist.map((h:any) => ({ month: h.month, roi: monthlySpend === 0 ? null : ((h.attributed - monthlySpend)/monthlySpend)*100 }));

  const combined = [...histROI.map((h:any)=> ({ month: h.month, roi: h.roi, type: 'hist' })), ...preds.map((p:any)=> ({ month: p.month, roi: p.roi, min: p.roi_min, max: p.roi_max, type: 'pred' }))];

  // scale for chart
  const roiValues = combined.map(c=> c.roi).filter((v:any)=> v !== null && v !== undefined) as number[];
  const minY = Math.min(...(roiValues.length? roiValues : [0]), 0);
  const maxY = Math.max(...(roiValues.length? roiValues : [100]), 100);

  function svgPathPoints(arr:any[], w:number, h:number){
    const gap = w / Math.max(1, arr.length - 1);
    return arr.map((p:any, i:number)=>{
      const x = i * gap;
      const v = p.roi === null || p.roi === undefined ? 0 : ( (p.roi - minY) / (maxY - minY) ) * h;
      const y = h - v;
      return { x, y };
    });
  }

  const leftWidth = 860;
  const chartH = 220;
  const points = svgPathPoints(combined, leftWidth, chartH);
  const histPoints = points.filter((_,i)=> i < histROI.length);
  const predPoints = points.slice(histROI.length - 1); // include last historic point for continuity

  function toPath(pts:any[]){
    if(pts.length === 0) return '';
    return pts.map((p,i)=> (i===0? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ position: 'absolute', left: 20, top: 84 }}>
            <ModuleBackButton toSuffix="/m06" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff', boxShadow: '0 4px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Projected ROI next month</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{nextROI}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Trend</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{data.trend === 'up' ? '↑ Up' : data.trend === 'down' ? '↓ Down' : '→ Stable'}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Confidence (80%)</div>
                <div style={{ fontSize: 14 }}>{confRange}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Model (MAE)</div>
                <div style={{ fontSize: 14 }}>{data.model?.name || '-'} • MAE {Math.round((data.model?.mae||0))}</div>
              </div>
            </div>

            <div style={{ marginTop: 18, padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Forecast Chart</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={exportCSV}>Download CSV</button>
                  <button className="btn-primary" onClick={()=> window.location.hash = `#/workspace/${workspaceId}/m06/element3`}>Back to ROI</button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <svg width={leftWidth} height={chartH} style={{ background: '#f7fbfc', borderRadius: 8 }}>
                  {/* confidence band for predictions */}
                  {predPoints.length > 1 && (
                    <path d={(() => {
                      // draw area between pred max and pred min
                      const top = predPoints.map((p:any,_i:number)=> `L ${p.x} ${p.y - 8}`).join(' ');
                      const bottom = predPoints.slice().reverse().map((p:any,_i:number)=> `L ${p.x} ${p.y + 8}`).join(' ');
                      const start = `M ${predPoints[0].x} ${predPoints[0].y - 8}`;
                      return `${start} ${top} ${bottom} Z`;
                    })()} fill="rgba(180,200,255,0.18)" stroke="none" />
                  )}

                  {/* historic line */}
                  <path d={toPath(histPoints)} stroke="#2b6cb0" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {/* predicted line */}
                  <path d={toPath(predPoints)} stroke="#d53f8c" strokeWidth={2} fill="none" strokeDasharray="6 6" />
                </svg>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>Model Controls & Scenario</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#666' }}>Months ahead</div>
                      <input type="number" value={monthsAhead} onChange={e=> setMonthsAhead(Math.max(1, Math.min(12, Number(e.target.value||6))))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666' }}>Spend multiplier (scenario)</div>
                      <input type="number" step="0.1" value={spendMultiplier} onChange={e=> setSpendMultiplier(Number(e.target.value||1))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666' }}>Alert if ROI below (%)</div>
                      <input type="number" value={targetROI===null? '': String(targetROI)} onChange={e=> setTargetROI(e.target.value === '' ? null : Number(e.target.value))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" onClick={fetchForecast}>Apply</button>
                      <button className="btn-ghost" onClick={()=>{ setSpendMultiplier(1); setMonthsAhead(6); setTargetROI(20); fetchForecast(); }}>Reset</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Forecast Table</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#666' }}>
                    <th>Month</th><th>Predicted Attributed</th><th>Min (CI)</th><th>Max (CI)</th><th>Spend</th><th>ROI</th><th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.predictions.map((p:any, idx:number)=> (
                    <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 6 }}>{p.month}</td>
                      <td style={{ padding: 6 }}>{Math.round(p.attributed||0)}</td>
                      <td style={{ padding: 6 }}>{Math.round(p.attributed_min||0)}</td>
                      <td style={{ padding: 6 }}>{Math.round(p.attributed_max||0)}</td>
                      <td style={{ padding: 6 }}>{Math.round(p.spend||0)}</td>
                      <td style={{ padding: 6 }}>{p.roi===null? '-': Math.round(p.roi) + '%'}</td>
                      <td style={{ padding: 6 }}>{p.roi !== null ? (p.roi > 0 ? '↑' : (p.roi < 0 ? '↓' : '→')) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 18, padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>Alerts & Insights</div>
              <div style={{ marginTop: 8 }}>
                {data.alerts && data.alerts.length > 0 ? data.alerts.map((a:any,i:number)=>(<div key={i} style={{ color: 'crimson' }}>{a}</div>)) : (<div style={{ color: '#666' }}>No immediate alerts.</div>)}
              </div>
            </div>
          </div>

          <div style={{ width: 360 }}>
            <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>Model Control Panel</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13 }}>Model: {data.model?.name || 'linear_regression'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>Last trained: {new Date(data.model?.trained_at).toLocaleString()}</div>
                <div style={{ marginTop: 8 }}>
                  <button className="btn-ghost">Retrain Model</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>Scenario Testing</div>
              <div style={{ marginTop: 8, color: '#666' }}>Change spend multiplier or test pausing a campaign (future enhancement)</div>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>Actions</div>
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary" onClick={exportCSV}>Download Forecast CSV</button>
                <div style={{ marginTop: 8 }}><button className="btn-ghost" onClick={()=> window.location.hash = `#/workspace/${workspaceId}/m06/element3`}>Back to ROI Dashboard</button></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
