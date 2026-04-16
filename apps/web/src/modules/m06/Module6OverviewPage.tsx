import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { useWorkspaceId } from '../../utils/workspace'
import { fetchFromApi, parseApiJson } from '../../utils/api'
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

export default function Module6OverviewPage() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [dateRange, setDateRange] = useState<DateRangeKey>('90d')
  const [channels, setChannels] = useState<string[]>(['email', 'ads', 'linkedin', 'webinar'])
  const [model, setModel] = useState<string>('linear')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<any | null>(null)

  async function fetchStats() {
    if (!workspaceId) {
      setStats(null)
      setError('Open a workspace to view Module 6 stats')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('projectId', workspaceId)
      params.set('dateRange', dateRange)
      if (channels.length) params.set('channels', channels.join(','))
      if (model) params.set('model', model)
      const res = await fetchFromApi(`${API_BASE}/m06/stats?${params.toString()}`, undefined, API_BASE)
      const json = await parseApiJson<any>(res, 'Could not load Module 6 stats')
      setStats(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Module 6 stats')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [workspaceId])

  function applyFilters() {
    fetchStats()
  }

  const revenueByChannel = useMemo(() => {
    const list = stats?.revenueByChannel || []
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

  const lastRunFallback = useMemo(() => {
    if (stats?.lastRun) return new Date(stats.lastRun).toLocaleString()
    const rot = stats?.revenueOverTime || []
    if (rot.length > 0) {
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

  const trend30 = stats?.trend30 ?? 0
  const trend90 = stats?.trend90 ?? 0

  const donutData = revenueByChannel.map((c: any) => ({ label: c.channel, value: Number(c.attributedRevenue || c.revenue || 0) }))

  const [timelineMode, setTimelineMode] =
    useState<'revenue' | 'spend' | 'both'>('both')

  const timelineSeries = useMemo(() => {
    const rev = revenueOverTime.map((r: any) => ({ month: r.period, total: Number(r.revenue || 0) }))
    const spd = revenueOverTime.map((r: any) => ({ month: r.period, total: Number(r.spend || 0) }))
    return { rev, spd }
  }, [revenueOverTime])

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

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — Overview</h2>
        </div>

        {/* ⭐ NEW FILTER BAR - ONE ROW, BLUE BUTTONS */}
        <div
          style={{
            marginTop: 12,
            background: '#fff',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}
        >
          {/* Date range */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>Date range</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRangeKey)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ccc',
                fontSize: 13
              }}
            >
              {DATE_RANGE_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Channels */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>Channels</label>
            <select
              multiple
              value={channels}
              onChange={e => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                setChannels(opts)
              }}
              style={{
                minWidth: 160,
                height: 70,
                padding: 6,
                borderRadius: 8,
                border: '1px solid #ccc',
                fontSize: 13
              }}
            >
              {CHANNEL_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Attribution model */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>Attribution model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #ccc',
                fontSize: 13
              }}
            >
              {MODEL_OPTIONS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Apply button */}
          <button
            onClick={applyFilters}
            disabled={loading}
            style={{
              background: '#0f4258',
              padding: '10px 18px',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              fontSize: 14,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.17)'
            }}
          >
            Apply filters
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
            <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>

            {/* ⭐ Retry button updated */}
            <button
              onClick={fetchStats}
              style={{
                marginTop: 8,
                background: '#0f4258',
                color: 'white',
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.16)'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="summary-metrics" style={{ marginTop: 12 }}>
          <div className="summary-card">
            <h5>Total Revenue</h5>
            <div className="value">{totalRevenue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>
              vs last 30d: {trend30 >= 0 ? `+${trend30}%` : `${trend30}%`}
            </div>
          </div>

          <div className="summary-card">
            <h5>Attributed Revenue</h5>
            <div className="value">
              {attributedRevenue.toLocaleString()} ({attributedPct}%)
            </div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>
              vs last 90d: {trend90 >= 0 ? `+${trend90}%` : `${trend90}%`}
            </div>
          </div>

          <div className="summary-card">
            <h5>Unattributed Revenue</h5>
            <div className="value">
              {unattributedRevenue.toLocaleString()} ({unattributedPct}%)
            </div>
          </div>

          <div className="summary-card">
            <h5>Campaigns & Spend</h5>
            <div className="value">{campaignCount} campaigns</div>
            <div style={{ fontSize: 11, color: '#4d4f67', marginTop: 4 }}>
              Spend: {totalSpend.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Model status pills */}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, background: '#eef4ff', padding: '4px 8px', borderRadius: 999 }}>
            Model: {modelName}
          </div>
          <div style={{ fontSize: 11, background: '#f0f4f7', padding: '4px 8px', borderRadius: 999 }}>
            Last Run: {lastRun}
          </div>
          <div
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 999,
              color: '#fff',
              background: status === 'success'
                ? '#3bb273'
                : status === 'error'
                ? '#e74c3c'
                : '#f1c40f'
            }}
          >
            {status}
          </div>
        </div>

        {/* Charts */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

                  {donutData.map((d: any) => {
                    const pct = totalRevenue > 0
                      ? Math.round((d.value / totalRevenue) * 100)
                      : 0

                    return (
                      <div
                        key={d.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          padding: '4px 0',
                          borderBottom: '1px dashed #eee'
                        }}
                      >
                        <span>{d.label}</span>
                        <span>
                          {d.value.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="summary-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5>Revenue Over Time</h5>

              {/* ⭐ BLUE timeline buttons */}
              <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                {(['revenue', 'spend', 'both'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTimelineMode(opt)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      background: timelineMode === opt ? '#0f4258' : '#eef2f5',
                      color: timelineMode === opt ? 'white' : '#333',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {opt[0].toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>
            ) : (
              <>
                {(timelineMode === 'revenue' || timelineMode === 'both') && (
                  <div style={{ marginTop: 8 }}>
                    <TimelineChart data={timelineSeries.rev} />
                  </div>
                )}

                {(timelineMode === 'spend' || timelineMode === 'both') && (
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
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: 6 }}>Campaign</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Channel</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Spend</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Revenue</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>ROI</th>
                  </tr>
                </thead>

                <tbody>
                  {topCampaigns.slice(0, 5).map((c: any) => (
                    <tr key={c.name} style={{ borderTop: '1px solid #eee', cursor: 'pointer' }}>
                      <td style={{ padding: 6 }}>{c.name}</td>
                      <td style={{ padding: 6 }}>{c.channel}</td>
                      <td style={{ padding: 6 }}>{c.spend?.toLocaleString()}</td>
                      <td style={{ padding: 6 }}>{c.revenue?.toLocaleString()}</td>
                      <td style={{ padding: 6 }}>{Math.round(Number(c.roi || 0))}%</td>
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
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: 6 }}>Campaign</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Channel</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Spend</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Revenue</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>ROI</th>
                  </tr>
                </thead>

                <tbody>
                  {bottomCampaigns.slice(0, 5).map((c: any) => (
                    <tr key={c.name} style={{ borderTop: '1px solid #eee', cursor: 'pointer' }}>
                      <td style={{ padding: 6 }}>{c.name}</td>
                      <td style={{ padding: 6 }}>{c.channel}</td>
                      <td style={{ padding: 6 }}>{c.spend?.toLocaleString()}</td>
                      <td style={{ padding: 6 }}>{c.revenue?.toLocaleString()}</td>
                      <td style={{ padding: 6 }}>{Math.round(Number(c.roi || 0))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Channel health */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="summary-card">
            <h5>Best channel (ROI)</h5>
            <div style={{ fontSize: 13 }}>{bestChannel ? `${bestChannel.channel} — ${Math.round(bestChannel.roi)}%` : '—'}</div>
          </div>

          <div className="summary-card">
            <h5>Highest spend channel</h5>
            <div style={{ fontSize: 13 }}>{highestSpendChannel ? `${highestSpendChannel.channel} — ${highestSpendChannel.spend?.toLocaleString()}` : '—'}</div>
          </div>

          <div className="summary-card">
            <h5>Most efficient channel</h5>
            <div style={{ fontSize: 13 }}>
              {mostEfficientChannel
                ? `${mostEfficientChannel.channel} — ${(mostEfficientChannel.revenue / Math.max(1, mostEfficientChannel.spend)).toFixed(2)}`
                : '—'}
            </div>
          </div>
        </div>

      </main>
    </Layout>
  )
}
