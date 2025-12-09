import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import './module6.css'
import PieChart from './PieChart'
import TimelineChart from './TimelineChart'

type DateRangeKey = '30d' | '90d' | 'year' | 'all'
const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

const CHANNEL_OPTIONS = ['email', 'ads', 'linkedin', 'webinar', 'other']
const MODEL_OPTIONS = ['first-touch', 'last-touch', 'linear']

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Element1Page() {
  const [dateRange, setDateRange] = useState<DateRangeKey>('90d')
  const [channels, setChannels] = useState<string[]>(['email', 'ads', 'linkedin', 'webinar'])
  const [model, setModel] = useState<string>('linear')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<any | null>(null)

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('dateRange', dateRange)
      if (channels.length) params.set('channels', channels.join(','))
      if (model) params.set('model', model)
      const res = await fetch(`${API_BASE}/m06/stats?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'failed')
      setStats(json)
    } catch (e) {
      setError('Could not load Module 6 stats')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  function applyFilters() {
    fetchStats()
  }

  const revenueByChannel = useMemo(() => {
    const list = stats?.revenueByChannel || []
    // Filter client-side by selected channels
    return list.filter((r: any) => channels.includes(String(r.channel).toLowerCase()))
  }, [stats, channels])

  const revenueOverTime = useMemo(() => stats?.revenueOverTime || [], [stats])
  const topCampaigns = useMemo(() => stats?.topCampaigns || [], [stats])
  const bottomCampaigns = useMemo(() => stats?.bottomCampaigns || [], [stats])

  const totalRevenue = Number(stats?.totalRevenue || 0)
  const attributedRevenue = Number(stats?.attributedRevenue || 0)
  const unattributedRevenue = Math.max(0, totalRevenue - attributedRevenue)
  const attributedPct = totalRevenue > 0 ? Math.round((attributedRevenue / totalRevenue) * 100) : 0
  const unattributedPct = totalRevenue > 0 ? Math.round((unattributedRevenue / totalRevenue) * 100) : 0
  const campaignCount = Number(stats?.campaignCount || 0)
  const totalSpend = Number(stats?.totalSpend || 0)

  const modelName = stats?.modelName || model
  // Default last run: prefer stats.lastRun; fallback to latest period in revenueOverTime; else '—'
  const lastRunFallback = useMemo(() => {
    if (stats?.lastRun) return new Date(stats.lastRun).toLocaleString()
    const rot = stats?.revenueOverTime || []
    if (rot.length > 0) {
      // Assume period is ISO date or YYYY-MM; take max
      const parse = (p: any) => {
        const s = String(p || '')
        if (/^\d{4}-\d{2}$/.test(s)) return new Date(s + '-01')
        const d = new Date(s)
        return isNaN(d.getTime()) ? null : d
      }
      const dates = rot.map((r: any) => parse(r.period)).filter((d: Date | null) => d) as Date[]
      if (dates.length) {
        const max = new Date(Math.max(...dates.map(d => d.getTime())))
        return max.toLocaleString()
      }
    }
    return '—'
  }, [stats])
  const lastRun = lastRunFallback
  const status = stats?.status || 'pending'

  // Fake trend vs previous window if provided
  const trend30 = stats?.trend30 ?? 0
  const trend90 = stats?.trend90 ?? 0

  const donutData = revenueByChannel.map((c: any) => ({ label: c.channel, value: Number(c.attributedRevenue || c.revenue || 0) }))

  const timelineToggleOptions = ['revenue', 'spend', 'both'] as const
  const [timelineMode, setTimelineMode] = useState<typeof timelineToggleOptions[number]>('both')

  const timelineSeries = useMemo(() => {
    // Map into the shared TimelineChart shape if needed
    // Our TimelineChart expects array of { month, total }
    // For multi-series, we can render two charts or adapt
    // Here, we render one chart showing revenue; if both, show revenue first then spend below
    const rev = revenueOverTime.map((r: any) => ({ month: r.period, total: Number(r.revenue || 0) }))
    const spd = revenueOverTime.map((r: any) => ({ month: r.period, total: Number(r.spend || 0) }))
    return { rev, spd }
  }, [revenueOverTime])

  // Channel health mini-cards
  const bestChannel = useMemo(() => {
    return [...revenueByChannel].sort((a: any, b: any) => Number(b.roi || 0) - Number(a.roi || 0))[0] || null
  }, [revenueByChannel])
  const highestSpendChannel = useMemo(() => {
    return [...revenueByChannel].sort((a: any, b: any) => Number(b.spend || 0) - Number(a.spend || 0))[0] || null
  }, [revenueByChannel])
  const mostEfficientChannel = useMemo(() => {
    return [...revenueByChannel]
      .map((c: any) => ({ ...c, efficiency: Number(c.revenue || 0) / Math.max(1, Number(c.spend || 0)) }))
      .sort((a: any, b: any) => Number(b.efficiency || 0) - Number(a.efficiency || 0))[0] || null
  }, [revenueByChannel])

  return (
    <Layout>
      <main className="page-root">
        {/* Title + back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — Overview</h2>
        </div>

        {/* Filter bar */}
        <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Date range</div>
            <select value={dateRange} onChange={e=>setDateRange(e.target.value as DateRangeKey)}>
              {DATE_RANGE_OPTIONS.map(o=> <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Channels</div>
            <select multiple value={channels} onChange={e=>{
              const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
              setChannels(opts)
            }} style={{ minWidth: 180, height: 72 }}>
              {CHANNEL_OPTIONS.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Attribution model</div>
            <select value={model} onChange={e=>setModel(e.target.value)}>
              {MODEL_OPTIONS.map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <button className="btn-primary" onClick={applyFilters} disabled={loading}>Apply filters</button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
            <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>
            <button className="btn-outline" style={{ marginTop: 8 }} onClick={fetchStats}>Retry</button>
          </div>
        )}

        {/* Top KPI strip + model pill */}
        <div className="summary-metrics" style={{ marginTop: 12 }}>
          <div className="summary-card">
            <h5>Total Revenue</h5>
            <div className="value">{(Math.round(totalRevenue*100)/100).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>vs last 30d: {trend30 >= 0 ? `+${trend30}%` : `${trend30}%`}</div>
          </div>
          <div className="summary-card">
            <h5>Attributed Revenue</h5>
            <div className="value">{(Math.round(attributedRevenue*100)/100).toLocaleString()} ({attributedPct}%)</div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>vs last 90d: {trend90 >= 0 ? `+${trend90}%` : `${trend90}%`}</div>
          </div>
          <div className="summary-card">
            <h5>Unattributed Revenue</h5>
            <div className="value">{(Math.round(unattributedRevenue*100)/100).toLocaleString()} ({unattributedPct}%)</div>
          </div>
          <div className="summary-card">
            <h5>Campaigns & Spend</h5>
            <div className="value">{campaignCount} campaigns</div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>Spend: {(Math.round(totalSpend*100)/100).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, background: '#eef4ff', padding: '4px 8px', borderRadius: 999 }}>Model: {modelName}</div>
          <div style={{ fontSize: 11, background: '#f0f4f7', padding: '4px 8px', borderRadius: 999 }}>Last Run: {lastRun}</div>
          <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, color: '#fff', background: status==='success'?'#3bb273':status==='error'?'#e74c3c':'#f1c40f' }}>{status}</div>
        </div>

        {/* Charts row */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Channel donut */}
          <div className="summary-card" style={{ padding: 12 }}>
            <h5>Revenue by Channel</h5>
            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>
            ) : donutData.length <= 1 ? (
              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Not enough data to compare channels.</div>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <PieChart data={donutData} size={220} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Legend</div>
                  {donutData.map((d: { label: string; value: number })=>{
                    const pct = totalRevenue>0 ? Math.round((d.value/totalRevenue)*100) : 0
                    return (
                      <div key={d.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding: '4px 0', borderBottom:'1px dashed #eee' }}>
                        <span>{d.label}</span>
                        <span>{(Math.round(d.value*100)/100).toLocaleString()} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Revenue Over Time */}
          <div className="summary-card" style={{ padding: 12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h5>Revenue Over Time</h5>
              <div style={{ display:'flex', gap:6, fontSize:11 }}>
                {(['revenue','spend','both'] as const).map(opt=> (
                  <button key={opt} className={timelineMode===opt? 'btn-primary btn-sm':'btn-ghost btn-sm'} onClick={()=>setTimelineMode(opt)}>{opt[0].toUpperCase()+opt.slice(1)}</button>
                ))}
              </div>
            </div>
            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>
            ) : (
              <>
                {(timelineMode==='revenue' || timelineMode==='both') && (
                  <div style={{ marginTop: 8 }}>
                    <TimelineChart data={timelineSeries.rev} />
                  </div>
                )}
                {(timelineMode==='spend' || timelineMode==='both') && (
                  <div style={{ marginTop: 12 }}>
                    <TimelineChart data={timelineSeries.spd} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top & Bottom Campaigns */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="summary-card" style={{ padding: 12 }}>
            <h5>Top 5 Campaigns by ROI</h5>
            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>
            ) : (
              <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background:'#f5f5f5' }}>
                    <th style={{ textAlign:'left', padding:6 }}>Campaign</th>
                    <th style={{ textAlign:'left', padding:6 }}>Channel</th>
                    <th style={{ textAlign:'left', padding:6 }}>Spend</th>
                    <th style={{ textAlign:'left', padding:6 }}>Revenue</th>
                    <th style={{ textAlign:'left', padding:6 }}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.slice(0,5).map((c:any)=> (
                    <tr key={c.name} style={{ borderTop:'1px solid #eee', cursor:'pointer' }} title="Open campaign details">
                      <td style={{ padding:6 }}>{c.name}</td>
                      <td style={{ padding:6 }}>{c.channel}</td>
                      <td style={{ padding:6 }}>{(Math.round(Number(c.spend||0)*100)/100).toLocaleString()}</td>
                      <td style={{ padding:6 }}>{(Math.round(Number(c.revenue||0)*100)/100).toLocaleString()}</td>
                      <td style={{ padding:6 }}>{Math.round(Number(c.roi||0))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="summary-card" style={{ padding: 12 }}>
            <h5>Bottom 5 Campaigns by ROI</h5>
            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>
            ) : (
              <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background:'#f5f5f5' }}>
                    <th style={{ textAlign:'left', padding:6 }}>Campaign</th>
                    <th style={{ textAlign:'left', padding:6 }}>Channel</th>
                    <th style={{ textAlign:'left', padding:6 }}>Spend</th>
                    <th style={{ textAlign:'left', padding:6 }}>Revenue</th>
                    <th style={{ textAlign:'left', padding:6 }}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomCampaigns.slice(0,5).map((c:any)=> (
                    <tr key={c.name} style={{ borderTop:'1px solid #eee', cursor:'pointer' }} title="Open campaign details">
                      <td style={{ padding:6 }}>{c.name}</td>
                      <td style={{ padding:6 }}>{c.channel}</td>
                      <td style={{ padding:6 }}>{(Math.round(Number(c.spend||0)*100)/100).toLocaleString()}</td>
                      <td style={{ padding:6 }}>{(Math.round(Number(c.revenue||0)*100)/100).toLocaleString()}</td>
                      <td style={{ padding:6 }}>{Math.round(Number(c.roi||0))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Channel Health mini-cards */}
        <div style={{ marginTop: 16, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <div className="summary-card">
            <h5>Best channel (ROI)</h5>
            <div style={{ fontSize: 13, color:'#2d2f45' }}>{bestChannel ? `${bestChannel.channel} — ${Math.round(Number(bestChannel.roi||0))}%` : '—'}</div>
          </div>
          <div className="summary-card">
            <h5>Highest spend channel</h5>
            <div style={{ fontSize: 13, color:'#2d2f45' }}>{highestSpendChannel ? `${highestSpendChannel.channel} — ${(Math.round(Number(highestSpendChannel.spend||0)*100)/100).toLocaleString()}` : '—'}</div>
          </div>
          <div className="summary-card">
            <h5>Most efficient channel</h5>
            <div style={{ fontSize: 13, color:'#2d2f45' }}>{mostEfficientChannel ? `${mostEfficientChannel.channel} — ${((Number(mostEfficientChannel.revenue||0)/Math.max(1,Number(mostEfficientChannel.spend||0))).toFixed(2))}` : '—'}</div>
          </div>
        </div>

        {/* No-data state */}
        {!loading && !error && !stats && (
          <div style={{ marginTop: 16, background:'#fff', borderRadius:8, padding:12, fontSize:13, color:'#666' }}>
            No data for this filter selection. Try expanding the date range or channels.
          </div>
        )}
      </main>
    </Layout>
  )
}
