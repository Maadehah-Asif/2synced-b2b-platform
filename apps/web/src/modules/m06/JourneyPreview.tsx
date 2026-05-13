import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import { previewJourneys, getJourney } from './services/journeys'
import { useWorkspaceId } from '../../utils/workspace'

type JourneyPreviewRow = {
  deal_id: string
  deal_external_id?: string
  lead_id?: string
  lead_name?: string
  lead_email?: string
  amount?: number
  closed_at?: string
  status?: string
  touchCount?: number
}

type JourneyTouch = {
  touched_at: string
  campaign_id?: string
  campaignName?: string
  channel?: string
  type?: string
}

type JourneyResponse = {
  deal?: {
    id?: string
    external_id?: string
    amount?: number
    status?: string
  }
  lead?: {
    name?: string
    email?: string
  }
  journey?: JourneyTouch[]
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export default function JourneyPreview() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('closed_won')
  const [channel, setChannel] = useState('')

  const [page, setPage] = useState(1)
  const [limit] = useState(25)

  const [dateError, setDateError] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<JourneyPreviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const [journey, setJourney] = useState<JourneyResponse | null>(null)
  const [journeyError, setJourneyError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const now = new Date()
    const past = new Date()
    past.setDate(past.getDate() - 90)
    setFrom(past.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
  }, [])

  const validate = useCallback(() => {
    setDateError(undefined)
    if (from && to) {
      const a = new Date(from).getTime()
      const b = new Date(to).getTime()
      if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
        setDateError('Start date cannot be after end date.')
        return false
      }
    }
    return true
  }, [from, to])

  const load = useCallback(async (nextPage = page) => {
    if (!workspaceId) {
      setRows([])
      setTotal(0)
      return
    }
    if (!validate()) return

    setLoading(true)
    setError(undefined)
    try {
      const data = await previewJourneys({
        from,
        to,
        status,
        channel,
        page: nextPage,
        limit,
      })
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load journey preview.')
    }
    setLoading(false)
  }, [channel, from, limit, page, status, to, validate, workspaceId])

  useEffect(() => {
    if (from && to) load()
  }, [from, to, status, channel, page, limit, workspaceId, load])

  async function onPickDeal(row: JourneyPreviewRow) {
    setJourney(null)
    setJourneyError(undefined)
    try {
      const data = await getJourney(row.deal_id)
      setJourney(data)
    } catch (e: unknown) {
      setJourneyError(e instanceof Error ? e.message : 'Failed to load journey.')
    }
  }

  function resetFilters() {
    const now = new Date()
    const past = new Date()
    past.setDate(past.getDate() - 90)
    setStatus('closed_won')
    setChannel('')
    setFrom(past.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  const totalValue = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const avgTouches = rows.length ? (rows.reduce((sum, row) => sum + Number(row.touchCount || 0), 0) / rows.length).toFixed(1) : '0.0'
  const noJourneyCount = rows.filter((row) => Number(row.touchCount || 0) === 0).length
  const liveSelectionDuration = journey?.journey?.length
    ? Math.max(
        0,
        Math.round((new Date(journey.journey[journey.journey.length - 1].touched_at).getTime() - new Date(journey.journey[0].touched_at).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0

  const interpretation = useMemo(() => {
    if (!rows.length) return 'No deals are currently visible in the active journey window. Broaden the date range or relax the amount filters.'
    if (noJourneyCount > Math.max(1, Math.floor(rows.length / 4))) {
      return 'A meaningful share of closed deals still has no visible campaign path. Attribution completeness should be improved before relying on journey-level conclusions.'
    }
    if (Number(avgTouches) >= 4) {
      return 'The visible deal set is multi-touch and should support richer attribution reading, especially when comparing first-touch, last-touch, and linear outcomes.'
    }
    return 'Most visible deals have relatively compact paths. This usually indicates short journeys or sparse touch capture rather than deep multi-step nurture.'
  }, [avgTouches, noJourneyCount, rows.length])

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero
          eyebrow="Revenue Insight Journeys"
          title="Journey Preview"
          subtitle="Inspect deal paths in the active revenue window, identify records with weak touch coverage, and open a single deal journey without leaving the analysis workspace."
        />

        <InsightKpiGrid>
          <InsightKpiCard label="Visible Deals" value={rows.length} note="Deals currently matching the active journey filters." tone="navy" />
          <InsightKpiCard label="Visible Value" value={`$${Math.round(totalValue).toLocaleString()}`} note="Combined amount across the visible deal window." tone="teal" />
          <InsightKpiCard label="Avg Touches" value={avgTouches} note="Average campaign touches observed before close." tone="slate" />
          <InsightKpiCard label="No Journey Found" value={noJourneyCount} note="Deals currently visible with zero recorded qualifying touches." tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel
              eyebrow="Filters"
              title="Select the journey slice"
              rightMeta={
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={() => { setPage(1); load(1) }}>Apply</button>
                  <button className="btn-ghost" onClick={resetFilters}>Reset</button>
                </div>
              }
            >
              <div className="m06-filter-grid">
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Closed from</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Closed to</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="closed_won">Closed won</option>
                    <option value="closed_lost">Closed lost</option>
                    <option value="open">Open / other</option>
                  </select>
                </label>
                <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>Channel</span>
                  <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    <option value="">Any channel</option>
                    <option value="email">Email</option>
                    <option value="ads">Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="webinar">Webinar</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              {dateError ? <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{dateError}</div> : null}
            </InsightPanel>

            <InsightPanel eyebrow="Visible deals" title="Journey list" soft>
              {error ? <div style={{ marginBottom: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}
              {loading ? <div style={insightTokens.mutedText}>Loading journey preview...</div> : null}
              {!loading && !rows.length ? <div style={insightTokens.mutedText}>No deals found for the active filter set.</div> : null}
              {!loading && rows.length ? (
                <>
                  <div style={insightTokens.tableWrap}>
                    <table style={insightTokens.table}>
                      <thead>
                        <tr>
                          <th style={insightTokens.th}>Deal</th>
                          <th style={insightTokens.th}>Lead</th>
                          <th style={insightTokens.th}>Amount</th>
                          <th style={insightTokens.th}>Status</th>
                          <th style={insightTokens.th}>Touches</th>
                          <th style={insightTokens.th}>Closed</th>
                          <th style={insightTokens.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.deal_id} style={insightTokens.row}>
                            <td style={insightTokens.tdStrong}>{row.deal_external_id || row.deal_id}</td>
                            <td style={insightTokens.td}>{row.lead_name || row.lead_email || `#${row.lead_id}`}</td>
                            <td style={insightTokens.td}>${Math.round(Number(row.amount || 0)).toLocaleString()}</td>
                            <td style={insightTokens.td}>{row.status || '—'}</td>
                            <td style={insightTokens.td}>{row.touchCount || 0}</td>
                            <td style={insightTokens.td}>{formatDateTime(row.closed_at)}</td>
                            <td style={insightTokens.td}>
                              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => onPickDeal(row)}>
                                View journey
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={insightTokens.mutedText}>Page {page} of {totalPages} with {total} matching deals.</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
                      <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
                    </div>
                  </div>
                </>
              ) : null}
            </InsightPanel>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <InsightPanel eyebrow="Executive readout" title="What this window indicates">
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Journey quality" body={interpretation} />
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr' }}>
                  <InsightMiniStat label="Selected date span" value={from && to ? `${from} to ${to}` : '—'} />
                  <InsightMiniStat label="Active filters" value={`${status || 'All'}${channel ? ` • ${channel}` : ''}`} />
                </div>
              </div>
            </InsightPanel>

            <InsightPanel eyebrow="Selected deal" title={journey?.deal?.external_id || journey?.deal?.id || 'Open a deal journey'} soft>
              {journeyError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{journeyError}</div> : null}
              {!journey && !journeyError ? <div style={insightTokens.mutedText}>Choose any deal from the table to load its path details here.</div> : null}
              {journey ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <InsightMiniStat label="Lead" value={journey.lead?.name || journey.lead?.email || '—'} />
                    <InsightMiniStat label="Status" value={journey.deal?.status || '—'} />
                    <InsightMiniStat label="Amount" value={`$${Math.round(Number(journey.deal?.amount || 0)).toLocaleString()}`} />
                    <InsightMiniStat label="Journey span" value={`${liveSelectionDuration} days`} />
                  </div>

                  {!journey.journey?.length ? (
                    <InsightNoteCard title="No qualifying touches" body="This deal currently has no pre-close campaign path recorded, so it will stay unattributed until touch capture improves." />
                  ) : (
                    <div style={insightTokens.tableWrap}>
                      <table style={insightTokens.table}>
                        <thead>
                          <tr>
                            <th style={insightTokens.th}>Touched at</th>
                            <th style={insightTokens.th}>Campaign</th>
                            <th style={insightTokens.th}>Channel</th>
                            <th style={insightTokens.th}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {journey.journey.map((item, index: number) => (
                            <tr key={`${item.campaign_id}-${index}`} style={insightTokens.row}>
                              <td style={insightTokens.tdStrong}>{formatDateTime(item.touched_at)}</td>
                              <td style={insightTokens.td}>{item.campaignName || item.campaign_id}</td>
                              <td style={insightTokens.td}>{item.channel || 'other'}</td>
                              <td style={insightTokens.td}>{item.type || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </InsightPanel>
          </div>
        </section>
      </main>
    </Layout>
  )
}
