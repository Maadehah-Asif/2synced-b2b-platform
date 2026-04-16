import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import TimelineChart from './TimelineChart'
import BarChart from './BarChart'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { fetchFromApi, parseApiJson } from '../../utils/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type RoiCampaign = {
  campaign_id: string
  name?: string | null
  channel?: string | null
  spend: number
  attributed: number
  roi: number | null
  profit: number
}

type RoiSeriesRow = {
  month: string
  attributed: number
}

type RoiContributionRow = {
  channel: string
  attributed: number
}

type RoiResponse = {
  totalAttributed: number
  totalSpend: number
  overallROI: number | null
  netProfit: number
  campaigns: RoiCampaign[]
  top5?: RoiCampaign[]
  bottom5?: RoiCampaign[]
  monthlySeries?: RoiSeriesRow[]
  channelContribution?: RoiContributionRow[]
}

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
  const [data, setData] = useState<RoiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<Array<Record<string, string>>>([])

  const [channel, setChannel] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [minSpend, setMinSpend] = useState('')
  const [minROI, setMinROI] = useState('')
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
        const json = await parseApiJson<{ runs?: Array<Record<string, string>> }>(res, 'Could not load attribution runs')
        if (Array.isArray(json.runs)) setRuns(json.runs)
      } catch {
        setRuns([])
      }
    }
    fetchRuns()
  }, [workspaceId])

  const fetchData = useCallback(async () => {
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
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      }, API_URL)

      const json = await parseApiJson<RoiResponse>(res, 'Could not load ROI dashboard')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ROI dashboard')
      setData(null)
    }
    setLoading(false)
  }, [channel, endMonth, minROI, minSpend, scopedRunId, startMonth, workspaceId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const sortedByROI = useMemo(() => {
    return [...(data?.campaigns || [])].sort((a, b) => {
      const ra = a.roi === null ? -Infinity : a.roi
      const rb = b.roi === null ? -Infinity : b.roi
      return rb - ra
    })
  }, [data?.campaigns])

  const top5 = data?.top5 || sortedByROI.slice(0, 5)
  const bottom5 = data?.bottom5 || sortedByROI.slice(-5).reverse()

  const healthyCampaigns = sortedByROI.filter((item) => (item.roi ?? -Infinity) >= 100).length
  const negativeCampaigns = sortedByROI.filter((item) => (item.roi ?? 0) < 0).length
  const largestChannel = [...(data?.channelContribution || [])].sort((a, b) => b.attributed - a.attributed)[0]
  const bestCampaign = sortedByROI[0]
  const worstCampaign = sortedByROI[sortedByROI.length - 1]

  const recommendationText = useMemo(() => {
    const notes: string[] = []
    if (bestCampaign?.roi !== null && bestCampaign?.roi !== undefined && bestCampaign.roi > 150) {
      notes.push(`${bestCampaign.name || bestCampaign.campaign_id} is materially outperforming the rest of the mix and is the strongest budget expansion candidate.`)
    }
    if (worstCampaign?.roi !== null && worstCampaign?.roi !== undefined && worstCampaign.roi < 0) {
      notes.push(`${worstCampaign.name || worstCampaign.campaign_id} is destroying margin and should be reviewed before the next spend cycle.`)
    }
    if (largestChannel) {
      notes.push(`${largestChannel.channel} currently contributes the largest share of attributed revenue inside this ROI scope.`)
    }
    if (!notes.length) {
      notes.push('Return is relatively balanced. Use the filters to isolate a narrower run, channel, or month range before changing budget.')
    }
    return notes
  }, [bestCampaign, worstCampaign, largestChannel])

  function tr(v: number) {
    return `$${(Math.round(v) || 0).toLocaleString()}`
  }

  function pct(v: number | null | undefined) {
    return v === null || v === undefined ? '—' : `${(Math.round(v * 100) / 100).toLocaleString()}%`
  }

  function updateRunScope(nextRunId: string) {
    const value = nextRunId || null
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
  }

  function exportCSV() {
    if (!data?.campaigns?.length) return
    const cols = ['campaign_id', 'name', 'channel', 'spend', 'attributed', 'roi', 'profit']
    const header = `${cols.join(',')}\n`
    const body = data.campaigns.map((row) =>
      cols.map((key) => {
        const value = row[key as keyof RoiCampaign]
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
        return String(value)
      }).join(',')
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roi-${workspaceId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!workspaceId) {
    return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Open a workspace to view the ROI dashboard.</div></main></Layout>
  }

  if (loading) {
    return <Layout><main className="page-root"><div style={{ fontSize: 13 }}>Loading ROI dashboard...</div></main></Layout>
  }

  if (!data) {
    return (
      <Layout>
        <main className="page-root">
          <div style={{ fontSize: 13 }}>
            No ROI data available. {error ? <span style={{ color: 'crimson' }}>{error}</span> : null}
          </div>
        </main>
      </Layout>
    )
  }

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero
          eyebrow="Revenue Insight Performance"
          title="ROI Dashboard"
          subtitle="Review return, margin quality, and campaign efficiency across the active attribution scope so budget decisions reflect actual commercial contribution."
        />

        <InsightKpiGrid>
          <InsightKpiCard label="Attributed Revenue" value={tr(data.totalAttributed)} note="Revenue currently credited to campaigns in this ROI slice." tone="navy" />
          <InsightKpiCard label="Campaign Spend" value={tr(data.totalSpend)} note="Spend tied to the campaigns visible in the active scope." tone="slate" />
          <InsightKpiCard label="Overall ROI" value={pct(data.overallROI)} note="Return percentage across all included campaign rows." tone="teal" />
          <InsightKpiCard label="Net Profit" value={tr(data.netProfit)} note="Attributed revenue minus visible campaign spend." tone="amber" />
          <InsightKpiCard label="Healthy Campaigns" value={healthyCampaigns} note="Campaigns currently at or above 100% ROI." tone="teal" />
          <InsightKpiCard label="Negative ROI" value={negativeCampaigns} note="Campaigns currently returning less than they cost." tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel
              eyebrow="Filters"
              title="Campaign ROI table"
              rightMeta={
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={fetchData} className="btn-primary">Apply Filters</button>
                  <button onClick={exportCSV} className="btn-ghost">Export CSV</button>
                </div>
              }
            >
              <div className="m06-filter-grid" style={{ marginTop: 4 }}>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Channel</span>
                  <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    <option value="">All channels</option>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Start month</span>
                  <input value={startMonth} onChange={(e) => setStartMonth(e.target.value)} placeholder="2025-01" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>End month</span>
                  <input value={endMonth} onChange={(e) => setEndMonth(e.target.value)} placeholder="2025-12" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Minimum spend</span>
                  <input value={minSpend} onChange={(e) => setMinSpend(e.target.value)} placeholder="0" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Minimum ROI %</span>
                  <input value={minROI} onChange={(e) => setMinROI(e.target.value)} placeholder="-100" />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Attribution run</span>
                  <select value={scopedRunId || ''} onChange={(e) => updateRunScope(e.target.value)}>
                    <option value="">All runs</option>
                    {runs.map((run) => (
                      <option key={run.id || run._id || run.run_id} value={run.id || run._id || run.run_id}>
                        {(run.run_id || run.id || run._id)} - {run.model_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ ...insightTokens.tableWrap, marginTop: 18 }}>
                <table style={insightTokens.table}>
                  <thead>
                    <tr>
                      <th style={insightTokens.th}>Campaign</th>
                      <th style={insightTokens.th}>Channel</th>
                      <th style={insightTokens.th}>Spend</th>
                      <th style={insightTokens.th}>Attributed</th>
                      <th style={insightTokens.th}>ROI</th>
                      <th style={insightTokens.th}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByROI.map((campaign) => (
                      <tr key={campaign.campaign_id} style={insightTokens.row}>
                        <td style={insightTokens.tdStrong}>{campaign.name || campaign.campaign_id}</td>
                        <td style={insightTokens.td}>{campaign.channel || '—'}</td>
                        <td style={insightTokens.td}>{tr(campaign.spend)}</td>
                        <td style={insightTokens.td}>{tr(campaign.attributed)}</td>
                        <td style={insightTokens.td}>{pct(campaign.roi)}</td>
                        <td style={insightTokens.td}>{tr(campaign.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </InsightPanel>

            <section style={insightTokens.equalCol}>
              <InsightPanel eyebrow="Trend" title="Attributed revenue over time">
                <TimelineChart data={(data.monthlySeries || []).map((item) => ({ month: item.month, total: item.attributed }))} />
              </InsightPanel>

              <InsightPanel eyebrow="Channel mix" title="Channel contribution" soft>
                <BarChart data={(data.channelContribution || []).map((item) => ({ label: item.channel, value: item.attributed }))} />
              </InsightPanel>
            </section>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel eyebrow="Top return" title="Best-performing campaigns" soft>
              <div style={{ display: 'grid', gap: 12 }}>
                {top5.map((item) => (
                  <div key={item.campaign_id} style={{ display: 'grid', gap: 8, borderBottom: '1px solid rgba(15,66,88,0.08)', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ color: '#0B2540' }}>{item.name || item.campaign_id}</strong>
                      <span style={{ color: '#0F766E', fontWeight: 800 }}>{pct(item.roi)}</span>
                    </div>
                    <div style={insightTokens.mutedText}>{tr(item.attributed)} attributed on {tr(item.spend)} spend.</div>
                  </div>
                ))}
              </div>
            </InsightPanel>

            <InsightPanel eyebrow="Margin risk" title="Underperforming campaigns">
              <div style={{ display: 'grid', gap: 12 }}>
                {bottom5.map((item) => (
                  <div key={item.campaign_id} style={{ display: 'grid', gap: 8, borderBottom: '1px solid rgba(15,66,88,0.08)', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ color: '#0B2540' }}>{item.name || item.campaign_id}</strong>
                      <span style={{ color: '#B7791F', fontWeight: 800 }}>{pct(item.roi)}</span>
                    </div>
                    <div style={insightTokens.mutedText}>{tr(item.attributed)} attributed on {tr(item.spend)} spend.</div>
                  </div>
                ))}
              </div>
            </InsightPanel>

            <InsightPanel eyebrow="Executive readout" title="What this ROI profile suggests" soft>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <InsightMiniStat label="Best campaign" value={bestCampaign?.name || '—'} />
                  <InsightMiniStat label="Weakest campaign" value={worstCampaign?.name || '—'} />
                </div>
                {recommendationText.map((item, index) => (
                  <InsightNoteCard key={index} title={`Finding ${index + 1}`} body={item} />
                ))}
              </div>
            </InsightPanel>
          </div>
        </section>
      </main>
    </Layout>
  )
}
