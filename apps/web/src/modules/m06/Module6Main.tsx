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

const MODEL_OPTIONS = ['first-touch', 'last-touch', 'linear']
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Module6Main() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [dateRange, setDateRange] = useState<DateRangeKey>('90d')
  const [channels] = useState<string[]>(['email', 'ads', 'linkedin', 'webinar'])
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Module 6 stats')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [workspaceId])

  const revenueByChannel = useMemo(() => {
    const list = stats?.revenueByChannel || []
    return list
      .filter((c: any) => channels.includes(String(c.channel || '').toLowerCase()))
      .map((c: any) => ({
        label: c.channel,
        value: Number(c.attributedRevenue ?? c.revenue ?? 0),
      }))
  }, [stats, channels])

  const timelineData = useMemo(() => {
    const list = stats?.revenueOverTime || []
    return list.map((point: any) => ({
      month: point.month || point.period || 'Unknown',
      total: Number(point.total ?? point.revenue ?? 0),
    }))
  }, [stats])

  return (
    <Layout>
      <main className="page-root m06-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6</h2>
        </div>

        <section className="m06-hero">
          <div className="m06-hero-inner">
            <div className="m06-pill">M06 Dashboard</div>
            <h1>Main Revenue Dashboard</h1>
            <div className="m06-hero-copy">
              Review revenue movement and channel contribution before drilling into ROI, forecasting, attribution, and allocation screens.
            </div>
          </div>
        </section>

        <section className="m06-panel">
          {!workspaceId && <div style={{ color: '#c33', marginBottom: 12 }}>Open a workspace to load this dashboard.</div>}
          <div className="m06-toolbar">
            <div>
              <div className="m06-section-label">Filters</div>
              <div className="m06-helper" style={{ marginTop: 8 }}>
                Adjust date range and attribution model for this overview.
              </div>
            </div>
            <button className="btn-primary" onClick={fetchStats}>Apply</button>
          </div>
          <div className="m06-filter-grid" style={{ marginTop: 14 }}>
            <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Date range</span>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeKey)}>
                {DATE_RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {loading && <div style={{ marginTop: 12 }}>Loading...</div>}
          {error && <div style={{ color: '#c33', marginTop: 12 }}>{error}</div>}
          {!error && stats?.message && <div style={{ color: '#6a4b00', marginTop: 12 }}>{stats.message}</div>}
        </section>

        <section className="m06-grid-2">
          <div className="m06-panel">
            <div className="m06-section-label">Timeline</div>
            <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Revenue timeline</h3>
            <div className="m06-helper">Track how revenue changes across the current selection window.</div>
            <div style={{ height: 220, marginTop: 14 }}>
              <TimelineChart data={timelineData} />
            </div>
          </div>
          <div className="m06-panel soft">
            <div className="m06-section-label">Channel Mix</div>
            <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Revenue by channel</h3>
            <div className="m06-helper">Compare which channels are carrying the current revenue profile.</div>
            <div style={{ height: 220, display: 'grid', placeItems: 'center', marginTop: 14 }}>
              <PieChart data={revenueByChannel} size={150} />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  )
}
