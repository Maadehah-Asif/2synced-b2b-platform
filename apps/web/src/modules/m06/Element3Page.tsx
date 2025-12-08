import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import './module6.css'
import ModuleBackButton from '../../components/ModuleBackButton'
import TimelineChart from './TimelineChart'
import BarChart from './BarChart'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function useWorkspaceContextFromHash(){
  const hash = window.location.hash || '';
  const workspaceId = getWorkspaceIdFromHash();
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const runId = params.get('runId');
  return { workspaceId, runId };
}

export default function RoiDashboard(){
  const { workspaceId, runId } = useWorkspaceContextFromHash();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);

  // filters
  const [channel, setChannel] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [minSpend, setMinSpend] = useState<string>('');
  const [minROI, setMinROI] = useState<string>('');
  const [scopedRunId] = useState<string | null>(runId);

  useEffect(() => {
    if (!workspaceId) return;
    async function fetchRuns() {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        params.set('projectId', workspaceId || '');
        const res = await fetch(`${API_URL}/m06/runs?${params.toString()}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        const j = await res.json();
        if (res.ok && Array.isArray(j.runs)) {
          setRuns(j.runs);
        }
      } catch {
        // ignore run selector errors, dashboard still usable
      }
    }
    fetchRuns();
  }, [workspaceId]);

  async function fetchData(){
    if(!workspaceId) return;
    setLoading(true);
    setError(null);
    try{
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('projectId', workspaceId || '');
      if(scopedRunId) params.set('runId', scopedRunId);
      if(channel) params.set('channel', channel);
      if(startMonth) params.set('start', startMonth);
      if(endMonth) params.set('end', endMonth);
      if(minSpend) params.set('minSpend', minSpend);
      if(minROI) params.set('minROI', minROI);
      const res = await fetch(`${API_URL}/m06/roi?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      const j = await res.json();
      if(!res.ok) { setError(j && j.message ? String(j.message) : (j && j.error ? String(j.error) : 'error')); setData(null); }
      else setData(j);
    }catch(e){ setError('network error'); setData(null); }
    setLoading(false);
  }

  useEffect(()=>{ fetchData() },[workspaceId, scopedRunId]);

  if(!workspaceId) return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Open a workspace to view ROI dashboard.</div></main></Layout>
  if(loading) return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Loading...</div></main></Layout>
  if(!data) return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>No ROI data. {error && <span style={{ color: 'crimson' }}>{error}</span>}</div></main></Layout>

  const tr = (v:number)=> `$${(Math.round(v)||0).toLocaleString()}`;
  const pct = (v:number|null|undefined)=> v===null||v===undefined ? '—' : `${(Math.round(v*100)/100).toLocaleString()}%`;

  const sortedByROI = [...(data.campaigns || [])].sort((a:any,b:any)=> {
    const ra = a.roi === null ? -Infinity : a.roi;
    const rb = b.roi === null ? -Infinity : b.roi;
    return rb - ra;
  });

  // server returns top5/bottom5, prefer that if present
  const top5 = data.top5 || sortedByROI.slice(0,5);
  const bottom5 = data.bottom5 || sortedByROI.slice(-5).reverse();

  function exportCSV(){
    if(!data || !data.campaigns) return;
    const rows = data.campaigns;
    const cols = ['campaign_id','name','channel','spend','attributed','roi','profit'];
    const header = cols.join(',') + '\n';
    const body = rows.map((r:any)=> cols.map(c=> {
      const v = r[c];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return '"' + v.replace(/"/g,'""') + '"';
      return String(v);
    }).join(',')).join('\n');
    const csv = header + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-${workspaceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — ROI Dashboard</h2>
        </div>

        <div style={{ marginTop: 4, fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            Scope:
            <select
              style={{ marginLeft: 6 }}
              value={scopedRunId || ''}
              onChange={(e) => {
                const value = e.target.value || null;
                const hash = window.location.hash;
                const workspace = getWorkspaceIdFromHash();
                if (!workspace) {
                  window.location.hash = '#/workspaces';
                  return;
                }
                const base = hash.split('?')[0];
                const params = new URLSearchParams(hash.split('?')[1] || '');
                if (value) params.set('runId', value);
                else params.delete('runId');
                window.location.hash = params.toString() ? `${base}?${params.toString()}` : base;
              }}
            >
              <option value="">All runs</option>
              {runs.map((r:any) => (
                <option key={r.id || r._id || r.run_id} value={r.id || r._id || r.run_id}>
                  {r.run_id || r.id} — {r.model_type || r.modelType || 'unknown'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Total Attributed Revenue</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(data.totalAttributed)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Total Campaign Spend</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(data.totalSpend)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Overall ROI</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{pct(data.overallROI)}</div>
              </div>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Net Profit</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{tr(data.netProfit)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {sortedByROI.length > 0 && (
                <div className="m7-card" style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#666' }}>Best Campaign ROI</div>
                  <div style={{ fontSize: 14 }}>{sortedByROI[0].name || sortedByROI[0].campaign_id}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{pct(sortedByROI[0].roi)}</div>
                </div>
              )}
              {sortedByROI.length > 0 && (
                <div className="m7-card" style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#666' }}>Worst Campaign ROI</div>
                  <div style={{ fontSize: 14 }}>{sortedByROI[sortedByROI.length - 1].name || sortedByROI[sortedByROI.length - 1].campaign_id}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{pct(sortedByROI[sortedByROI.length - 1].roi)}</div>
                </div>
              )}
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Campaign ROI Table</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={fetchData}>Apply Filters</button>
                  <button className="btn-ghost" onClick={exportCSV}>Export CSV</button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Channel</div>
                    <select value={channel} onChange={e=>setChannel(e.target.value)}>
                      <option value="">All</option>
                      <option value="email">Email</option>
                      <option value="ads">Ads</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="webinar">Webinar</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Start (YYYY-MM)</div>
                    <input value={startMonth} onChange={e=>setStartMonth(e.target.value)} placeholder="2025-01" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>End (YYYY-MM)</div>
                    <input value={endMonth} onChange={e=>setEndMonth(e.target.value)} placeholder="2025-12" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Min Spend</div>
                    <input value={minSpend} onChange={e=>setMinSpend(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Min ROI %</div>
                    <input value={minROI} onChange={e=>setMinROI(e.target.value)} placeholder="-100" />
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={{ padding: 8 }}>Campaign</th>
                      <th style={{ padding: 8 }}>Channel</th>
                      <th style={{ padding: 8 }}>Spend</th>
                      <th style={{ padding: 8 }}>Attributed</th>
                      <th style={{ padding: 8 }}>ROI %</th>
                      <th style={{ padding: 8 }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByROI.map((c:any)=> (
                      <tr key={c.campaign_id}>
                        <td style={{ padding: 8 }}>{c.name || c.campaign_id}</td>
                        <td style={{ padding: 8 }}>{c.channel}</td>
                        <td style={{ padding: 8 }}>{tr(c.spend)}</td>
                        <td style={{ padding: 8 }}>{tr(c.attributed)}</td>
                        <td style={{ padding: 8 }}>{pct(c.roi)}</td>
                        <td style={{ padding: 8 }}>{tr(c.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div className="m7-card" style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>ROI Trend</div>
                <div style={{ marginTop: 8 }}>
                  <TimelineChart data={(data.monthlySeries || []).map((m:any)=>({ month: m.month, total: m.attributed }))} />
                </div>
              </div>

              <div className="m7-card" style={{ width: 360 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Channel Contribution</div>
                <div style={{ marginTop: 8 }}>
                  <BarChart data={(data.channelContribution || []).map((c:any)=>({ label: c.channel, value: c.attributed }))} />
                </div>
              </div>
            </div>

          </div>

          <div>
            <div className="m7-card">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Top 5 Campaigns (ROI)</div>
              <div style={{ marginTop: 8 }}>
                <ol style={{ paddingLeft: 18 }}>
                  {top5.map((t:any)=>(<li key={t.campaign_id}>{t.name || t.campaign_id} — {pct(t.roi)} — {tr(t.attributed)}</li>))}
                </ol>
              </div>
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Bottom 5 Campaigns (ROI)</div>
              <div style={{ marginTop: 8 }}>
                <ol style={{ paddingLeft: 18 }}>
                  {bottom5.map((t:any)=>(<li key={t.campaign_id}>{t.name || t.campaign_id} — {pct(t.roi)} — {tr(t.attributed)}</li>))}
                </ol>
              </div>
            </div>

            <div className="m7-card" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Recommendations</div>
              <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                {top5 && top5.length > 0 && top5[0].roi !== null && top5[0].roi > 150 && (
                  <div>Top campaign {top5[0].name || top5[0].campaign_id} is delivering exceptional ROI. Consider increasing spend.</div>
                )}
                {bottom5 && bottom5.length > 0 && bottom5[0].roi !== null && bottom5[0].roi < 0 && (
                  <div>Some campaigns are generating negative ROI. Review messaging, targeting, or pause low performers.</div>
                )}
                {!((top5 && top5.length > 0) || (bottom5 && bottom5.length > 0)) && (
                  <div>ROI profile looks balanced. Use filters on the left to explore specific segments.</div>
                )}
              </div>
            </div>

          </div>
        </div>

      </main>
    </Layout>
  )
}
