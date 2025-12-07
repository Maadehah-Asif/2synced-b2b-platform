import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

function getWorkspaceId(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function IntentForecast(){
  const wid = getWorkspaceId();
  const [runs, setRuns] = useState<any[]>([]);
  const [runId, setRunId] = useState<string>('');
  const [scopeType, setScopeType] = useState<string>('all');
  const [scopeBy, setScopeBy] = useState<string>('priority');
  const [scopeValue, setScopeValue] = useState<string>('');
  const [query, setQuery] = useState<string>('Forecast short-term (7 days) and medium-term (30 days) intent for P1 leads.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{ if (!wid) return; fetch(`/m02/intent-runs?workspace=${wid}`).then(r=>r.json()).then(j=>{ if (j && j.runs) setRuns(j.runs); }).catch(()=>{}); },[wid]);

  async function generate(){
    setError(null);
    if (!runId) return setError('Select an intent run');
    if (!query || query.trim().length < 3) return setError('Enter a query');
    setLoading(true); setResult(null);
    const payload = { runId, scope: scopeType === 'all' ? { type:'all' } : { type:'segment', by: scopeBy, value: scopeValue }, query, horizons: [7,30,90] };
    try{
      const r = await fetch('/m02/intent-forecast', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      setLoading(false);
      if (j.ok) setResult(j);
      else setError(j.error || 'forecast failed');
    } catch(e){ setLoading(false); setError('unable to call forecast'); }
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" label="Back" />
          <h2 style={{ marginTop:16 }}>M2-5 — Intent Forecast</h2>
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
            <div style={{ fontSize:12 }}>Scope</div>
            <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
              <option value="all">All leads (portfolio)</option>
              <option value="segment">Specific segment</option>
            </select>
          </div>
          {scopeType === 'segment' && (
            <>
              <div>
                <div style={{ fontSize:12 }}>By</div>
                <select value={scopeBy} onChange={e=>setScopeBy(e.target.value)}>
                  <option value="priority">Priority Tier</option>
                  <option value="intentCategory">Intent Category</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:12 }}>Value</div>
                <input value={scopeValue} onChange={e=>setScopeValue(e.target.value)} placeholder={scopeBy==='priority'?'P1|P2|P3|P4':'High|Medium|Low'} />
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:12, marginBottom:6 }}>Ask the forecasting engine</div>
          <textarea rows={4} style={{ width:'100%' }} value={query} onChange={e=>setQuery(e.target.value)} />
          <div style={{ marginTop:8 }}>
            <button className="btn-primary btn-sm" onClick={generate} disabled={loading || !runId || !query}>Generate Forecast</button>
          </div>
        </div>

        {error && <div style={{ marginTop:12, color:'crimson' }}>{error}</div>}
        {loading && <div style={{ marginTop:12 }}>Generating forecast…</div>}

        {result && (
          <div style={{ marginTop:16 }}>
            <h3>Summary</h3>
            <div style={{ display:'flex', gap:12 }}>
              {(result.forecast||[]).map((f:any)=>(
                <div key={f.horizonDays} style={{ border:'1px solid #eee', padding:12, minWidth:160 }}>
                  <div style={{ fontWeight:700 }}>{f.horizonDays} days</div>
                  <div>Predicted Avg Intent: <strong>{f.predictedAvg}</strong></div>
                  <div style={{ fontSize:12, color:'#666' }}>Range: {f.lower} — {f.upper}</div>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop:12 }}>Explanation</h3>
            <div style={{ whiteSpace:'pre-wrap', background:'#fafafa', padding:12, border:'1px solid #eee' }}>{result.explanation}</div>

            <h3 style={{ marginTop:12 }}>Historical</h3>
            <div style={{ border:'1px solid #eee', padding:8 }}>
              <table className="simple-table" style={{ width:'100%' }}>
                <thead><tr><th>Date</th><th>Avg Intent</th></tr></thead>
                <tbody>
                  {(result.historical||[]).map((h:any)=> (
                    <tr key={h.date}><td>{h.date}</td><td>{Number(h.avgIntent).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginTop:12 }}>Top leads</h3>
            <div>
              <table className="simple-table" style={{ width:'100%' }}>
                <thead><tr><th>lead</th><th>intent</th></tr></thead>
                <tbody>
                  {(result.topLeads||[]).map((l:any)=>(
                    <tr key={l.leadId}><td>{l.leadId}</td><td>{Number(l.intent).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </Layout>
  )
}
