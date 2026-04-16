import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import './module6.css'
import ModuleBackButton from '../../components/ModuleBackButton'
import TimelineChart from './TimelineChart'
import BarChart from './BarChart'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { fetchFromApi, parseApiJson } from '../../utils/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function useWorkspaceContextFromHash() {
  const hash = window.location.hash || ''
  const workspaceId = getWorkspaceIdFromHash()
  const params = new URLSearchParams(hash.split('?')[1] || '')
  const runId = params.get('runId')
  return { workspaceId, runId }
}

export default function Module6RoiDashboardPage() {
  const { workspaceId, runId } = useWorkspaceContextFromHash()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<any[]>([])

  const [channel, setChannel] = useState<string>('')
  const [startMonth, setStartMonth] = useState<string>('')
  const [endMonth, setEndMonth] = useState<string>('')
  const [minSpend, setMinSpend] = useState<string>('')
  const [minROI, setMinROI] = useState<string>('')
  const scopedRunId = runId

  useEffect(() => {
    if (!workspaceId) return
    async function fetchRuns() {
      try {
        const token = localStorage.getItem('token')
        const params = new URLSearchParams()
        params.set('projectId', workspaceId || '')
        const res = await fetchFromApi(`${API_URL}/m06/runs?${params.toString()}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        }, API_URL)
        const j = await parseApiJson<any>(res, 'Could not load attribution runs')
        if (Array.isArray(j.runs)) {
          setRuns(j.runs)
        }
      } catch {}
    }
    fetchRuns()
  }, [workspaceId])

  async function fetchData() {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.set('projectId', workspaceId || '')
      if (scopedRunId) params.set('runId', scopedRunId)
      if (channel) params.set('channel', channel)
      if (startMonth) params.set('start', startMonth)
      if (endMonth) params.set('end', endMonth)
      if (minSpend) params.set('minSpend', minSpend)
      if (minROI) params.set('minROI', minROI)

      const res = await fetchFromApi(`${API_URL}/m06/roi?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      }, API_URL)

      const j = await parseApiJson<any>(res, 'Could not load ROI dashboard')
      setData(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ROI dashboard')
      setData(null)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [workspaceId, scopedRunId])

  if (!workspaceId) {
    return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Open a workspace to view ROI dashboard.</div></main></Layout>
  }

  if (loading) {
    return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Loading...</div></main></Layout>
  }

  if (!data) {
    return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>No ROI data. {error && <span style={{ color: 'crimson' }}>{error}</span>}</div></main></Layout>
  }

  const tr = (v: number) => `$${(Math.round(v) || 0).toLocaleString()}`
  const pct = (v: number | null | undefined) => v === null || v === undefined ? '—' : `${(Math.round(v * 100) / 100).toLocaleString()}%`

  const sortedByROI = [...(data.campaigns || [])].sort((a: any, b: any) => {
    const ra = a.roi === null ? -Infinity : a.roi
    const rb = b.roi === null ? -Infinity : b.roi
    return rb - ra
  })

  const top5 = data.top5 || sortedByROI.slice(0, 5)
  const bottom5 = data.bottom5 || sortedByROI.slice(-5).reverse()

  function exportCSV() {
    if (!data || !data.campaigns) return
    const rows = data.campaigns
    const cols = ['campaign_id', 'name', 'channel', 'spend', 'attributed', 'roi', 'profit']
    const header = cols.join(',') + '\n'
    const body = rows.map((r: any) =>
      cols.map(c => {
        const v = r[c]
        if (v === null || v === undefined) return ''
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`
        return String(v)
      }).join(',')
    ).join('\n')

    const csv = header + body
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roi-${workspaceId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const recommendationText: string[] = []
  if (top5?.length > 0 && top5[0].roi !== null && top5[0].roi > 150) {
    recommendationText.push(`Top campaign ${top5[0].name} is delivering unusually strong ROI and may justify additional budget.`)
  }
  if (bottom5?.length > 0 && bottom5[0].roi !== null && bottom5[0].roi < 0) {
    recommendationText.push('Some campaigns are returning negative ROI, so targeting, spend level, or timing likely needs review.')
  }
  if (!recommendationText.length) {
    recommendationText.push('ROI profile looks balanced. Use the filters above to inspect narrower segments before making allocation changes.')
  }

  return (
    <Layout>
      <main className="page-root m06-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6</h2>
        </div>

        <section className="m06-hero">
          <div className="m06-hero-inner">
            <div className="m06-pill">ROI Dashboard</div>
            <h1>Revenue Attribution Overview</h1>
            <div className="m06-hero-copy">
              Compare campaign-level ROI, review top and bottom performers, and adjust filters to understand which channels and runs are actually creating return.
            </div>
          </div>
        </section>

        <section className="m06-kpi-grid">
          <div className="m06-kpi-card">
            <div className="label">Attributed Revenue</div>
            <div className="value">{tr(data.totalAttributed)}</div>
          </div>
          <div className="m06-kpi-card">
            <div className="label">Campaign Spend</div>
            <div className="value">{tr(data.totalSpend)}</div>
          </div>
          <div className="m06-kpi-card">
            <div className="label">Overall ROI</div>
            <div className="value">{pct(data.overallROI)}</div>
          </div>
          <div className="m06-kpi-card">
            <div className="label">Net Profit</div>
            <div className="value">{tr(data.netProfit)}</div>
          </div>
          <div className="m06-kpi-card">
            <div className="label">Best Campaign</div>
            <div className="value" style={{ fontSize: 20 }}>{sortedByROI[0]?.name || '—'}</div>
          </div>
          <div className="m06-kpi-card">
            <div className="label">Worst Campaign</div>
            <div className="value" style={{ fontSize: 20 }}>{sortedByROI[sortedByROI.length - 1]?.name || '—'}</div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <section className="m06-panel">
              <div className="m06-toolbar">
                <div>
                  <div className="m06-section-label">Filters</div>
                  <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Campaign ROI table</h3>
                  <div className="m06-helper">
                    Narrow the ROI table by channel, run scope, month range, spend floor, or minimum return.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={fetchData} className="btn-primary">Apply Filters</button>
                  <button onClick={exportCSV} className="btn-secondary">Export CSV</button>
                </div>
              </div>

              <div className="m06-filter-grid" style={{ marginTop: 16 }}>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Channel</span>
                  <select value={channel} onChange={e => setChannel(e.target.value)}>
                    <option value="">All</option>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Start month</span>
                  <input value={startMonth} onChange={e => setStartMonth(e.target.value)} placeholder="2025-01" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>End month</span>
                  <input value={endMonth} onChange={e => setEndMonth(e.target.value)} placeholder="2025-12" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Minimum spend</span>
                  <input value={minSpend} onChange={e => setMinSpend(e.target.value)} placeholder="0" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Minimum ROI %</span>
                  <input value={minROI} onChange={e => setMinROI(e.target.value)} placeholder="-100" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Run scope</span>
                  <select
                    value={scopedRunId || ''}
                    onChange={(e) => {
                      const value = e.target.value || null
                      const hash = window.location.hash
                      const workspace = getWorkspaceIdFromHash()

                      if (!workspace) {
                        window.location.hash = '#/workspaces'
                        return
                      }

                      const base = hash.split('?')[0]
                      const params = new URLSearchParams(hash.split('?')[1] || '')
                      if (value) params.set('runId', value)
                      else params.delete('runId')

                      window.location.hash = params.toString() ? `${base}?${params.toString()}` : base
                    }}
                  >
                    <option value="">All runs</option>
                    {runs.map((r: any) => (
                      <option key={r.id || r._id || r.run_id} value={r.id || r._id || r.run_id}>
                        {r.run_id || r.id} - {r.model_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="m06-table-shell" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Channel</th>
                      <th>Spend</th>
                      <th>Attributed</th>
                      <th>ROI %</th>
                      <th>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByROI.map((c: any) => (
                      <tr key={c.campaign_id}>
                        <td>{c.name || c.campaign_id}</td>
                        <td>{c.channel || '—'}</td>
                        <td>{tr(c.spend)}</td>
                        <td>{tr(c.attributed)}</td>
                        <td>{pct(c.roi)}</td>
                        <td>{tr(c.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: 18 }}>
              <section className="m06-panel">
                <div className="m06-section-label">Trend</div>
                <h3 className="m06-panel-title" style={{ marginTop: 12 }}>ROI timeline</h3>
                <div className="m06-helper">Read the revenue trend over time inside the active ROI scope.</div>
                <div style={{ marginTop: 14 }}>
                  <TimelineChart data={(data.monthlySeries || []).map((m: any) => ({ month: m.month, total: m.attributed }))} />
                </div>
              </section>

              <section className="m06-panel soft">
                <div className="m06-section-label">Channel Mix</div>
                <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Channel contribution</h3>
                <div className="m06-helper">See how much attributed revenue each channel is contributing.</div>
                <div style={{ marginTop: 14 }}>
                  <BarChart data={(data.channelContribution || []).map((c: any) => ({ label: c.channel, value: c.attributed }))} />
                </div>
              </section>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <section className="m06-panel">
              <div className="m06-section-label">Top Performers</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Top 5 campaigns</h3>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {top5.map((t: any) => (
                  <li key={t.campaign_id}>{t.name || t.campaign_id} - {pct(t.roi)} - {tr(t.attributed)}</li>
                ))}
              </ol>
            </section>

            <section className="m06-panel soft">
              <div className="m06-section-label">Risk Area</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Bottom 5 campaigns</h3>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {bottom5.map((t: any) => (
                  <li key={t.campaign_id}>{t.name || t.campaign_id} - {pct(t.roi)} - {tr(t.attributed)}</li>
                ))}
              </ol>
            </section>

            <section className="m06-panel">
              <div className="m06-section-label">Interpretation</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Recommended reading</h3>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {recommendationText.map((text, idx) => <li key={idx}>{text}</li>)}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  )
}
