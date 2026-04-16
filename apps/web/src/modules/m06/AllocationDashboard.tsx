import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
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

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (n: number) => void }) {
  if (!total || total <= limit) return null
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  if (start + windowSize - 1 > totalPages) start = Math.max(1, totalPages - windowSize + 1)
  const pages: number[] = []
  for (let i = 0; i < windowSize && start + i <= totalPages; i += 1) pages.push(start + i)

  return (
    <span className="pagination">
      {start > 1 ? <button type="button" className="page-btn" onClick={() => onPage(1)}>1</button> : null}
      {start > 2 ? <span className="mx-8 muted">...</span> : null}
      {pages.map((item) => (
        <button key={item} type="button" className={`page-btn ${item === page ? 'active' : ''}`} onClick={() => onPage(item)}>
          {item}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages ? (
        <>
          <span className="mx-8 muted">...</span>
          <button type="button" className="page-btn" onClick={() => onPage(totalPages)}>{totalPages}</button>
        </>
      ) : null}
    </span>
  )
}

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
  const [runs, setRuns] = useState<RunOption[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('campaign')
  const [channelFilter, setChannelFilter] = useState('')
  const [minShare, setMinShare] = useState<number | ''>('')
  const [leadSearch, setLeadSearch] = useState('')
  const [closedFrom, setClosedFrom] = useState('')
  const [closedTo, setClosedTo] = useState('')
  const [minDealAmount, setMinDealAmount] = useState<number | ''>('')
  const [maxDealAmount, setMaxDealAmount] = useState<number | ''>('')
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [deals, setDeals] = useState<DealSummary[]>([])
  const [loadingMain, setLoadingMain] = useState(false)
  const [mainError, setMainError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed_won' | 'open'>('all')

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [campaignAllocations, setCampaignAllocations] = useState<CampaignAllocationRow[]>([])
  const [campaignAllocLoading, setCampaignAllocLoading] = useState(false)
  const [campaignAllocError, setCampaignAllocError] = useState<string | null>(null)

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [dealAllocations, setDealAllocations] = useState<DealAllocationRow[]>([])
  const [dealAllocLoading, setDealAllocLoading] = useState(false)
  const [dealAllocError, setDealAllocError] = useState<string | null>(null)

  const hasRuns = runs.length > 0
  const projectId = useWorkspaceId({ redirectToWorkspaces: true })

  useEffect(() => {
    if (!projectId) return
    async function fetchRuns() {
      setRunsLoading(true)
      setRunsError(null)
      try {
        const pid = projectId as string
        const res = await fetch(`${API_URL}/m06/runs?projectId=${encodeURIComponent(pid)}`)
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
        if (!selectedRunId && options.length) setSelectedRunId(options[0].id)
      } catch (err) {
        setRunsError(mapError(err))
      } finally {
        setRunsLoading(false)
      }
    }
    fetchRuns()
  }, [projectId, selectedRunId])

  useEffect(() => {
    if (!projectId || !selectedRunId) return
    setLoadingMain(true)
    setMainError(null)

    const runId = selectedRunId
    const params = new URLSearchParams({ projectId, runId, page: String(page), limit: String(limit) })
    if (channelFilter) params.set('channel', channelFilter)
    if (leadSearch.trim()) params.set('lead', leadSearch.trim())
    if (closedFrom) params.set('closedFrom', closedFrom)
    if (closedTo) params.set('closedTo', closedTo)
    if (statusFilter) params.set('status', statusFilter)
    if (minShare !== '' && !Number.isNaN(minShare)) params.set('minShare', String(minShare))
    if (mode === 'deal') {
      if (minDealAmount !== '' && !Number.isNaN(minDealAmount)) params.set('minDealAmount', String(minDealAmount))
      if (maxDealAmount !== '' && !Number.isNaN(maxDealAmount)) params.set('maxDealAmount', String(maxDealAmount))
    }

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

    fetchData()
    return () => controller.abort()
  }, [projectId, selectedRunId, mode, channelFilter, leadSearch, closedFrom, closedTo, minShare, minDealAmount, maxDealAmount, statusFilter, page, limit])

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
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setCampaignAllocError(mapError(err))
        setCampaignAllocations([])
      } finally {
        setCampaignAllocLoading(false)
      }
    }
    load()
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
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setDealAllocError(mapError(err))
        setDealAllocations([])
      } finally {
        setDealAllocLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [projectId, selectedRunId, selectedDealId, mode])

  const runLabel = useMemo(() => runs.find((run) => run.id === selectedRunId)?.label || 'Select run', [runs, selectedRunId])
  const showEmptyState = !loadingMain && !mainError && selectedRunId && ((mode === 'campaign' && campaigns.length === 0) || (mode === 'deal' && deals.length === 0))
  const visibleCampaignRevenue = campaigns.reduce((sum, item) => sum + item.total_revenue, 0)
  const visibleDealValue = deals.reduce((sum, item) => sum + item.amount, 0)
  const visibleAttributed = deals.reduce((sum, item) => sum + item.total_attributed, 0)
  const avgSharePerCampaign = campaigns.length ? visibleCampaignRevenue / campaigns.length : 0

  const interpretation = mode === 'campaign'
    ? 'Use campaign view to understand where revenue concentration is clustering. Strong skew usually means a few campaigns are carrying most of the credited outcome.'
    : 'Deal view is better for checking whether revenue is being over-concentrated into a small number of campaigns or remaining partially unattributed.'

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
            <InsightPanel eyebrow="Setup" title="Run scope and filters">
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
                      <select className="input" value={selectedRunId || ''} onChange={(e) => setSelectedRunId(e.target.value || null)}>
                        <option value="">Select run...</option>
                        {runs.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
                      </select>
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Channel</span>
                      <input className="input" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} placeholder="Any" />
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Lead search</span>
                      <input className="input" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Name, company, email" />
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Closed from</span>
                      <input className="input" type="date" value={closedFrom} onChange={(e) => setClosedFrom(e.target.value)} />
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Closed to</span>
                      <input className="input" type="date" value={closedTo} onChange={(e) => setClosedTo(e.target.value)} />
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Deal status</span>
                      <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'closed_won' | 'open')}>
                        <option value="all">Any</option>
                        <option value="closed_won">Closed won</option>
                        <option value="open">Open / not won</option>
                      </select>
                    </label>
                    <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>Min revenue share</span>
                      <input className="input" type="number" min={0} value={minShare === '' ? '' : minShare} onChange={(e) => setMinShare(e.target.value ? Number(e.target.value) : '')} />
                    </label>
                    {mode === 'deal' ? (
                      <>
                        <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span>Min deal amount</span>
                          <input className="input" type="number" min={0} value={minDealAmount === '' ? '' : minDealAmount} onChange={(e) => setMinDealAmount(e.target.value ? Number(e.target.value) : '')} />
                        </label>
                        <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span>Max deal amount</span>
                          <input className="input" type="number" min={0} value={maxDealAmount === '' ? '' : maxDealAmount} onChange={(e) => setMaxDealAmount(e.target.value ? Number(e.target.value) : '')} />
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className={`btn-ghost btn-sm ${mode === 'campaign' ? 'active' : ''}`} onClick={() => setMode('campaign')}>View by Campaign</button>
                      <button type="button" className={`btn-ghost btn-sm ${mode === 'deal' ? 'active' : ''}`} onClick={() => setMode('deal')}>View by Deal</button>
                    </div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Rows per page</span>
                      <select className="input" style={{ width: 84 }} value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value) || 25) }}>
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
                                {campaignAllocations.map((row) => (
                                  <tr key={row.deal_id} style={insightTokens.row}>
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
                                {dealAllocations.map((row) => {
                                  const base = deals.find((deal) => deal.deal_id === selectedDealId)?.amount
                                  return (
                                    <tr key={row.campaign_id} style={insightTokens.row}>
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
            <InsightPanel eyebrow="Operating readout" title="How to use this allocation view" soft>
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Read concentration first" body={interpretation} />
                <InsightNoteCard title="Switch views deliberately" body="Campaign view is stronger for budget discussions. Deal view is stronger for diagnosing attribution completeness and credit distribution fairness." />
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
