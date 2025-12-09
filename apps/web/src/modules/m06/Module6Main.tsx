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

export default function Module6Main() {
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
    return list.filter((c: any) => channels.includes(c.channel))
  }, [stats, channels])

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />
        <h2 style={{ marginTop:16 }}>Module 6 — Main Dashboard</h2>
        <div style={{ marginTop:8, display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ display:'flex', gap:8 }}>
            <select value={dateRange} onChange={(e)=>setDateRange(e.target.value as DateRangeKey)}>
              {DATE_RANGE_OPTIONS.map(o=> (<option key={o.key} value={o.key}>{o.label}</option>))}
            </select>
            <select value={model} onChange={(e)=>setModel(e.target.value)}>
              {MODEL_OPTIONS.map(m=> (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <button className="btn-ghost" onClick={applyFilters}>Apply</button>
          </div>
        </div>

        {loading && <div style={{ marginTop:12 }}>Loading...</div>}
        {error && <div style={{ color:'#c33', marginTop:12 }}>{error}</div>}

        {/* Minimal KPI & charts placeholder to keep existing features intact */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginTop:12 }}>
          <div className="card">Revenue timeline
            <div style={{ height:160 }}><TimelineChart data={stats?.revenueOverTime || []} /></div>
          </div>
          <div className="card">Revenue by channel
            <div style={{ height:160 }}><PieChart data={revenueByChannel} size={120} /></div>
          </div>
        </div>
      </main>
    </Layout>
  )
}
