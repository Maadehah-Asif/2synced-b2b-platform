import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import BarChart from './BarChart'
import PieChart from './PieChart'
import Pagination from './components/Pagination'
import '../m06/module6.css'
import { useWorkspaceId } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type RunOption = {
  id: string
  label: string
  model_type: string
  status: string
}

type CampaignSummary = {
  campaign_id: string
  name: string | null
  channel: string | null
  total_revenue: number
  deal_count: number
  avg_revenue_per_deal: number
}

type DealSummary = {
  deal_id: string
  amount: number
  closed_at?: string
  closed_won?: boolean
  lead_name?: string | null
  lead_email?: string | null
  total_attributed: number
  unattributed: number
  campaign_count: number
}

type CampaignAllocationRow = {
  deal_id: string
  deal_amount: number
  revenue_share: number
  closed_at?: string
  lead_name?: string | null
  lead_email?: string | null
}

type DealAllocationRow = {
  campaign_id: string
  campaign_name: string | null
  channel: string | null
  revenue_share: number
}

type Mode = 'campaign' | 'deal'
type ApiErrorShape = { error?: string; message?: string }
type RunApiRecord = {
  _id: string
  model_type: string
  status: string
  date_from?: string
  date_to?: string
}

type RunsApiResponse = {
  runs?: RunApiRecord[]
}

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'ads', label: 'Ads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'other', label: 'Other' },
]

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatDate(input?: string) {
  if (!input) return '—'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function mapError(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as ApiErrorShape
    if (anyErr.message) return anyErr.message
    if (anyErr.error) return anyErr.error
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

export default function AllocationDashboard() {
  const projectId = useWorkspaceId({ redirectToWorkspaces: true })
  const [runs, setRuns] = useState<RunOption[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('campaign')
  const [draftRunId, setDraftRunId] = useState<string | null>(null)
  const [draftChannel, setDraftChannel] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState('')

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [deals, setDeals] = useState<DealSummary[]>([])
  const [loadingMain, setLoadingMain] = useState(false)
  const [mainError, setMainError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [campaignAllocations, setCampaignAllocations] = useState<CampaignAllocationRow[]>([])
  const [campaignAllocLoading, setCampaignAllocLoading] = useState(false)
  const [campaignAllocError, setCampaignAllocError] = useState<string | null>(null)
  const [campaignAllocPage, setCampaignAllocPage] = useState(1)
  const drillPageSize = 8

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [dealAllocations, setDealAllocations] = useState<DealAllocationRow[]>([])
  const [dealAllocLoading, setDealAllocLoading] = useState(false)
  const [dealAllocError, setDealAllocError] = useState<string | null>(null)
  const [dealAllocPage, setDealAllocPage] = useState(1)

  useEffect(() => {
    if (!projectId) return

    async function fetchRuns() {
      setRunsLoading(true)
      setRunsError(null)
      try {
        const res = await fetch(`${API_URL}/m06/runs?projectId=${encodeURIComponent(projectId || '')}`)
        const data = await res.json() as RunsApiResponse
        if (!res.ok) throw data as ApiErrorShape

        const options: RunOption[] = (data.runs || [])
          .filter((item: RunApiRecord) => item.status === 'success')
          .map((item: RunApiRecord) => ({
            id: String(item._id),
            label: `${(item.model_type || '').toUpperCase()} · ${(item.date_from || '').slice(0, 10)} to ${(item.date_to || '').slice(0, 10)}`,
            model_type: item.model_type,
            status: item.status,
          }))

        setRuns(options)
        if (!selectedRunId && options.length) {
          setSelectedRunId(options[0].id)
          setDraftRunId(options[0].id)
        }
      } catch (err) {
        setRunsError(mapError(err))
      } finally {
        setRunsLoading(false)
      }
    }

    void fetchRuns()
  }, [projectId, selectedRunId])

  useEffect(() => {
    if (!projectId || !selectedRunId) return
    setLoadingMain(true)
    setMainError(null)

    const params = new URLSearchParams({ projectId, runId: selectedRunId, page: String(page), limit: String(limit) })
    if (channelFilter) params.set('channel', channelFilter)

    const controller = new AbortController()

    async function fetchData() {
      try {
        if (mode === 'campaign') {
          const res = await fetch(`${API_URL}/m06/allocation/campaigns?${params.toString()}`, { signal: controller.signal })
          const data = await res.json()
          if (!res.ok) throw data as ApiErrorShape
          setCampaigns(data.campaigns || [])
          setTotal(data.total || 0)
          setDeals([])
        } else {
          const res = await fetch(`${API_URL}/m06/allocation/deals?${params.toString()}`, { signal: controller.signal })
          const data = await res.json()
          if (!res.ok) throw data as ApiErrorShape
          setDeals(data.deals || [])
          setTotal(data.total || 0)
          setCampaigns([])
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setMainError(mapError(err))
        setCampaigns([])
        setDeals([])
      } finally {
        setLoadingMain(false)
      }
    }

    void fetchData()
    return () => controller.abort()
  }, [projectId, selectedRunId, channelFilter, mode, page, limit])

  useEffect(() => {
    if (!projectId || !selectedRunId || !selectedCampaignId || mode !== 'campaign') {
      setCampaignAllocations([])
      setCampaignAllocError(null)
      return
    }

    const params = new URLSearchParams({ projectId, runId: selectedRunId, campaignId: selectedCampaignId })
    const controller = new AbortController()

    async function load() {
      setCampaignAllocLoading(true)
      setCampaignAllocError(null)
      try {
        const res = await fetch(`${API_URL}/m06/allocation/campaign-deals?${params.toString()}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw data as ApiErrorShape
        setCampaignAllocations(data.allocations || [])
        setCampaignAllocPage(1)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setCampaignAllocError(mapError(err))
        setCampaignAllocations([])
      } finally {
        setCampaignAllocLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [projectId, selectedRunId, selectedCampaignId, mode])

  useEffect(() => {
    if (!projectId || !selectedRunId || !selectedDealId || mode !== 'deal') {
      setDealAllocations([])
      setDealAllocError(null)
      return
    }

    const params = new URLSearchParams({ projectId, runId: selectedRunId, dealId: selectedDealId })
    const controller = new AbortController()

    async function load() {
      setDealAllocLoading(true)
      setDealAllocError(null)
      try {
        const res = await fetch(`${API_URL}/m06/allocation/deal-campaigns?${params.toString()}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw data as ApiErrorShape
        setDealAllocations(data.allocations || [])
        setDealAllocPage(1)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setDealAllocError(mapError(err))
        setDealAllocations([])
      } finally {
        setDealAllocLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [projectId, selectedRunId, selectedDealId, mode])

  function applyFilters() {
    setSelectedRunId(draftRunId)
    setChannelFilter(draftChannel)
    setPage(1)
    setSelectedCampaignId(null)
    setSelectedDealId(null)
  }

  const hasRuns = runs.length > 0
  const runLabel = useMemo(() => runs.find((run) => run.id === selectedRunId)?.label || 'Select run', [runs, selectedRunId])
  const showEmptyState = !loadingMain && !mainError && selectedRunId && ((mode === 'campaign' && campaigns.length === 0) || (mode === 'deal' && deals.length === 0))

  const visibleCampaignRevenue = campaigns.reduce((sum, item) => sum + item.total_revenue, 0)
  const visibleDealValue = deals.reduce((sum, item) => sum + item.amount, 0)
  const visibleAttributed = deals.reduce((sum, item) => sum + item.total_attributed, 0)
  const avgSharePerCampaign = campaigns.length ? visibleCampaignRevenue / campaigns.length : 0

  const campaignChart = useMemo(
    () =>
      campaigns.slice(0, 6).map((item) => ({
        label: (item.name || item.campaign_id).slice(0, 14),
        value: item.total_revenue,
      })),
    [campaigns]
  )

  const allocationPie = useMemo(() => {
    if (mode === 'campaign') {
      const totals = new Map<string, number>()
      for (const item of campaigns) {
        const key = item.channel || 'other'
        totals.set(key, (totals.get(key) || 0) + item.total_revenue)
      }
      return Array.from(totals.entries()).map(([label, value]) => ({ label, value }))
    }

    return [
      { label: 'Attributed', value: visibleAttributed },
      { label: 'Unattributed', value: Math.max(0, visibleDealValue - visibleAttributed) },
    ]
  }, [campaigns, mode, visibleAttributed, visibleDealValue])

  const paginatedCampaignAllocations = useMemo(() => {
    const start = (campaignAllocPage - 1) * drillPageSize
    return campaignAllocations.slice(start, start + drillPageSize)
  }, [campaignAllocPage, campaignAllocations])

  const paginatedDealAllocations = useMemo(() => {
    const start = (dealAllocPage - 1) * drillPageSize
    return dealAllocations.slice(start, start + drillPageSize)
  }, [dealAllocPage, dealAllocations])

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero
          eyebrow="Revenue Insight Allocation"
          title="Allocation Dashboard"
          subtitle="Trace how attributed revenue is distributed across campaigns and deals for a selected run, then drill down into the individual rows carrying that allocation."
        />

        <InsightKpiGrid>
          <InsightKpiCard label="Successful Runs" value={runs.length} note="Attribution runs currently available for allocation review." tone="navy" />
          <InsightKpiCard label="Visible Campaign Revenue" value={formatCurrency(visibleCampaignRevenue)} note="Revenue attributed to the currently visible campaign rows." tone="teal" />
          <InsightKpiCard label="Visible Deal Value" value={formatCurrency(visibleDealValue)} note="Gross deal value inside the current deal selection." tone="slate" />
          <InsightKpiCard label="Attributed In Deal View" value={formatCurrency(visibleAttributed)} note="Attributed portion visible across the current deal slice." tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel
              eyebrow="Setup"
              title="Run scope and filters"
              rightMeta={<button type="button" className="btn-primary" onClick={applyFilters} disabled={!draftRunId}>Apply Filters</button>}
            >
              {!projectId ? <div style={{ color: '#b91c1c', fontSize: 13 }}>Open a workspace to explore allocations.</div> : null}
              {runsLoading ? <div style={insightTokens.mutedText}>Loading attribution runs...</div> : null}
              {runsError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{runsError}</div> : null}

              {!hasRuns && !runsLoading ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={insightTokens.mutedText}>No successful attribution runs exist for this workspace yet.</div>
                  <div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        if (!projectId) return
                        window.location.hash = `#/workspace/${projectId}/m06/run-attribution`
                      }}
                    >
                      Go to Run Attribution
                    </button>
                  </div>
                </div>
              ) : null}

              {hasRuns ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div className="m06-filter-grid">
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Select attribution run</span>
                      <select className="input" value={draftRunId || ''} onChange={(e) => setDraftRunId(e.target.value || null)}>
                        <option value="">Select run...</option>
                        {runs.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
                      </select>
                    </label>

                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Channel</span>
                      <select className="input" value={draftChannel} onChange={(e) => setDraftChannel(e.target.value)}>
                        {CHANNEL_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className={`btn-ghost btn-sm ${mode === 'campaign' ? 'active' : ''}`} onClick={() => { setMode('campaign'); setSelectedDealId(null) }}>View by Campaign</button>
                      <button type="button" className={`btn-ghost btn-sm ${mode === 'deal' ? 'active' : ''}`} onClick={() => { setMode('deal'); setSelectedCampaignId(null) }}>View by Deal</button>
                    </div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Rows per page</span>
                      <select className="input" style={{ width: 84 }} value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value) || 10) }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
            </InsightPanel>

            {selectedRunId ? (
              <InsightPanel eyebrow="Allocation table" title={`${mode === 'campaign' ? 'Campaign allocations' : 'Deal allocations'} for ${runLabel}`} soft>
                {loadingMain ? <div style={insightTokens.mutedText}>Loading allocations...</div> : null}
                {mainError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{mainError}</div> : null}
                {showEmptyState ? <div style={insightTokens.mutedText}>No allocation rows match the active filter set.</div> : null}

                {!loadingMain && !mainError && !showEmptyState && mode === 'campaign' && campaigns.length ? (
                  <>
                    <div style={insightTokens.tableWrap}>
                      <table style={insightTokens.table}>
                        <thead>
                          <tr>
                            <th style={insightTokens.th}>Campaign</th>
                            <th style={insightTokens.th}>Channel</th>
                            <th style={insightTokens.th}>Total revenue</th>
                            <th style={insightTokens.th}>Deals</th>
                            <th style={insightTokens.th}>Avg / deal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((item) => (
                            <tr
                              key={item.campaign_id}
                              style={{ ...insightTokens.row, cursor: 'pointer', background: selectedCampaignId === item.campaign_id ? '#f3f7fb' : undefined }}
                              onClick={() => { setSelectedCampaignId(item.campaign_id); setSelectedDealId(null) }}
                            >
                              <td style={insightTokens.tdStrong}>{item.name || item.campaign_id}</td>
                              <td style={insightTokens.td}>{item.channel || 'other'}</td>
                              <td style={insightTokens.td}>{formatCurrency(item.total_revenue)}</td>
                              <td style={insightTokens.td}>{formatNumber(item.deal_count)}</td>
                              <td style={insightTokens.td}>{formatCurrency(item.avg_revenue_per_deal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedCampaignId ? (
                      <div style={{ marginTop: 16 }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#0B2540' }}>Deals for selected campaign</h4>
                        {campaignAllocLoading ? <div style={insightTokens.mutedText}>Loading campaign drill-down...</div> : null}
                        {campaignAllocError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{campaignAllocError}</div> : null}
                        {!campaignAllocLoading && !campaignAllocError && campaignAllocations.length ? (
                          <>
                            <div style={insightTokens.tableWrap}>
                              <table style={insightTokens.table}>
                                <thead>
                                  <tr>
                                    <th style={insightTokens.th}>Deal</th>
                                    <th style={insightTokens.th}>Lead</th>
                                    <th style={insightTokens.th}>Deal amount</th>
                                    <th style={insightTokens.th}>Revenue share</th>
                                    <th style={insightTokens.th}>% of deal</th>
                                    <th style={insightTokens.th}>Closed at</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedCampaignAllocations.map((row) => (
                                    <tr key={`${row.deal_id}-${row.closed_at || 'row'}`} style={insightTokens.row}>
                                      <td style={insightTokens.tdStrong}>{row.deal_id}</td>
                                      <td style={insightTokens.td}>{row.lead_name || row.lead_email || '—'}</td>
                                      <td style={insightTokens.td}>{formatCurrency(row.deal_amount)}</td>
                                      <td style={insightTokens.td}>{formatCurrency(row.revenue_share)}</td>
                                      <td style={insightTokens.td}>{row.deal_amount ? `${((row.revenue_share / row.deal_amount) * 100).toFixed(1)}%` : '—'}</td>
                                      <td style={insightTokens.td}>{formatDate(row.closed_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-ghost btn-sm" disabled={campaignAllocPage <= 1} onClick={() => setCampaignAllocPage((value) => Math.max(1, value - 1))}>Prev</button>
                              <Pagination page={campaignAllocPage} total={campaignAllocations.length} limit={drillPageSize} onPage={setCampaignAllocPage} />
                              <button type="button" className="btn-ghost btn-sm" disabled={campaignAllocPage * drillPageSize >= campaignAllocations.length} onClick={() => setCampaignAllocPage((value) => value + 1)}>Next</button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {!loadingMain && !mainError && !showEmptyState && mode === 'deal' && deals.length ? (
                  <>
                    <div style={insightTokens.tableWrap}>
                      <table style={insightTokens.table}>
                        <thead>
                          <tr>
                            <th style={insightTokens.th}>Deal</th>
                            <th style={insightTokens.th}>Lead</th>
                            <th style={insightTokens.th}>Amount</th>
                            <th style={insightTokens.th}>Attributed</th>
                            <th style={insightTokens.th}>Unattributed</th>
                            <th style={insightTokens.th}>Campaigns</th>
                            <th style={insightTokens.th}>Closed at</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deals.map((item) => (
                            <tr
                              key={item.deal_id}
                              style={{ ...insightTokens.row, cursor: 'pointer', background: selectedDealId === item.deal_id ? '#f3f7fb' : undefined }}
                              onClick={() => { setSelectedDealId(item.deal_id); setSelectedCampaignId(null) }}
                            >
                              <td style={insightTokens.tdStrong}>{item.deal_id}</td>
                              <td style={insightTokens.td}>{item.lead_name || item.lead_email || '—'}</td>
                              <td style={insightTokens.td}>{formatCurrency(item.amount)}</td>
                              <td style={insightTokens.td}>{formatCurrency(item.total_attributed)}</td>
                              <td style={insightTokens.td}>{formatCurrency(item.unattributed)}</td>
                              <td style={insightTokens.td}>{formatNumber(item.campaign_count)}</td>
                              <td style={insightTokens.td}>{formatDate(item.closed_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedDealId ? (
                      <div style={{ marginTop: 16 }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#0B2540' }}>Campaigns for selected deal</h4>
                        {dealAllocLoading ? <div style={insightTokens.mutedText}>Loading deal drill-down...</div> : null}
                        {dealAllocError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{dealAllocError}</div> : null}
                        {!dealAllocLoading && !dealAllocError && dealAllocations.length ? (
                          <>
                            <div style={insightTokens.tableWrap}>
                              <table style={insightTokens.table}>
                                <thead>
                                  <tr>
                                    <th style={insightTokens.th}>Campaign</th>
                                    <th style={insightTokens.th}>Channel</th>
                                    <th style={insightTokens.th}>Revenue share</th>
                                    <th style={insightTokens.th}>% of deal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedDealAllocations.map((row) => {
                                    const base = deals.find((deal) => deal.deal_id === selectedDealId)?.amount
                                    return (
                                      <tr key={`${row.campaign_id}-${row.revenue_share}`} style={insightTokens.row}>
                                        <td style={insightTokens.tdStrong}>{row.campaign_name || row.campaign_id}</td>
                                        <td style={insightTokens.td}>{row.channel || 'other'}</td>
                                        <td style={insightTokens.td}>{formatCurrency(row.revenue_share)}</td>
                                        <td style={insightTokens.td}>{base ? `${((row.revenue_share / base) * 100).toFixed(1)}%` : '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-ghost btn-sm" disabled={dealAllocPage <= 1} onClick={() => setDealAllocPage((value) => Math.max(1, value - 1))}>Prev</button>
                              <Pagination page={dealAllocPage} total={dealAllocations.length} limit={drillPageSize} onPage={setDealAllocPage} />
                              <button type="button" className="btn-ghost btn-sm" disabled={dealAllocPage * drillPageSize >= dealAllocations.length} onClick={() => setDealAllocPage((value) => value + 1)}>Next</button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {!loadingMain && !mainError && !showEmptyState ? (
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={insightTokens.mutedText}>Showing page {page} with {total} rows in the current scope.</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button type="button" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
                      <Pagination page={page} total={total} limit={limit} onPage={setPage} />
                      <button type="button" className="btn-ghost btn-sm" disabled={page * limit >= total} onClick={() => setPage((value) => value + 1)}>Next</button>
                    </div>
                  </div>
                ) : null}
              </InsightPanel>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel eyebrow="Visible mix" title={mode === 'campaign' ? 'Revenue concentration by campaign' : 'Attributed versus unattributed value'} soft>
              {mode === 'campaign' ? (
                <BarChart data={campaignChart} height={220} valueFormatter={(value) => formatCurrency(value)} />
              ) : (
                <PieChart data={allocationPie} size={170} />
              )}
            </InsightPanel>

            <InsightPanel eyebrow="Channel split" title="Current allocation mix" soft>
              <PieChart data={allocationPie} size={170} />
            </InsightPanel>

            <InsightPanel eyebrow="Operating readout" title="How to use this allocation view" soft>
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Read concentration first" body={mode === 'campaign' ? 'Campaign view shows where attributed revenue is clustering. Strong skew usually means a small number of campaigns are carrying most of the credited outcome.' : 'Deal view shows how much value is being credited versus left unattributed at row level, which is the better way to inspect attribution completeness.'} />
                <InsightNoteCard title="Switch views deliberately" body="Campaign view is stronger for budget conversations. Deal view is stronger when checking whether credit is reasonably distributed across the underlying revenue rows." />
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <InsightMiniStat label="Selected run" value={selectedRunId ? runLabel : '—'} />
                  <InsightMiniStat label="Avg revenue / campaign" value={formatCurrency(avgSharePerCampaign)} />
                </div>
              </div>
            </InsightPanel>
          </div>
        </section>
      </main>
    </Layout>
  )
}
