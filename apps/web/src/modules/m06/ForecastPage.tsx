import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { ForecastGroupedBarChart, ForecastLineChart } from '../../components/ForecastCharts'
import { insightTokens } from '../../components/insightChromeTokens'
import { useWorkspaceId } from '../../utils/workspace'
import './module6.css'
import BarChart from './BarChart'
import TimelineChart from './TimelineChart'
import Pagination from './components/Pagination'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type ForecastWindowKey = '1m' | '3m' | '6m'
type ForecastChannel = { id: string; name: string }
type AgentHistoryRow = { month: string; roi: number; ma3?: number; ma6?: number }
type AgentForecastRow = {
  month: string
  baseline_roi: number
  scenario_roi: number
  confidence_low: number
  confidence_high: number
}
type AgentResult = {
  history: AgentHistoryRow[]
  forecast: AgentForecastRow[]
  baselineROI: number
  scenarioROI: number
  confidenceLow: number
  confidenceHigh: number
  trend: string
  volatility: number
  seasonality: number
  forecastMethod: string
  selectionReason?: string
  explanation: string
}

const WINDOW_OPTIONS: { key: ForecastWindowKey; label: string }[] = [
  { key: '1m', label: '1 month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
]

export default function ForecastPage() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [channels, setChannels] = useState<ForecastChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [windowKey, setWindowKey] = useState<ForecastWindowKey>('3m')
  const [multiplier, setMultiplier] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [forecastPage, setForecastPage] = useState(1)
  const forecastPageSize = 6

  useEffect(() => {
    fetch(`${API_BASE}/m06/forecast/options`)
      .then((res) => res.json())
      .then((json: { channels?: string[] }) => {
        const items = Array.isArray(json?.channels)
          ? json.channels.map((channel) => ({ id: channel, name: channel.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) }))
          : []
        setChannels(items)
        if (!selectedChannelId && items[0]) setSelectedChannelId(items[0].id)
      })
      .catch(() => {
        const fallback: ForecastChannel[] = [
          { id: 'email', name: 'Email' },
          { id: 'webinar', name: 'Webinar' },
          { id: 'cold_outreach', name: 'Cold Outreach' },
        ]
        setChannels(fallback)
        if (!selectedChannelId) setSelectedChannelId(fallback[0].id)
      })
  }, [selectedChannelId])

  async function generateForecast() {
    if (!selectedChannelId) {
      setError('Please select a channel to forecast.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/m06/forecast-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_channel: selectedChannelId,
          forecast_window: windowKey,
          spend_multiplier: multiplier,
        }),
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string; result?: Partial<AgentResult> & Record<string, unknown> }))
      if (!res.ok || !json) {
        setError(json && typeof json.error === 'string' ? json.error : 'Forecast request failed.')
        return
      }
      if (!json.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Forecast agent was unable to generate a forecast.')
      }
      const raw = (json.result || {}) as Partial<AgentResult> & Record<string, unknown>
      setResult({
        history: Array.isArray(raw.history) ? raw.history as AgentHistoryRow[] : [],
        forecast: Array.isArray(raw.forecast) ? raw.forecast as AgentForecastRow[] : [],
        baselineROI: typeof raw.baselineROI === 'number' ? raw.baselineROI : typeof raw.baseline_roi === 'number' ? raw.baseline_roi : 0,
        scenarioROI: typeof raw.scenarioROI === 'number' ? raw.scenarioROI : typeof raw.scenario_roi === 'number' ? raw.scenario_roi : 0,
        confidenceLow: typeof raw.confidenceLow === 'number' ? raw.confidenceLow : typeof raw.confidence_low === 'number' ? raw.confidence_low : 0,
        confidenceHigh: typeof raw.confidenceHigh === 'number' ? raw.confidenceHigh : typeof raw.confidence_high === 'number' ? raw.confidence_high : 0,
        trend: typeof raw.trend === 'string' ? raw.trend : 'flat',
        volatility: typeof raw.volatility === 'number' ? raw.volatility : 0,
        seasonality: typeof raw.seasonality === 'number' ? raw.seasonality : 0,
        forecastMethod: typeof raw.forecastMethod === 'string' ? raw.forecastMethod : typeof raw.forecast_method === 'string' ? raw.forecast_method : 'auto',
        selectionReason: typeof raw.selectionReason === 'string' ? raw.selectionReason : typeof raw.selection_reason === 'string' ? raw.selection_reason : undefined,
        explanation: typeof raw.explanation === 'string' ? raw.explanation : 'Forecast results from the forecasting agent.',
      })
      setForecastPage(1)
    } catch {
      setError('Network error while calling the forecast agent.')
    } finally {
      setLoading(false)
    }
  }

  function downloadCSV() {
    if (!result?.forecast.length) return
    const header = ['month', 'baseline_roi', 'scenario_roi', 'confidence_low', 'confidence_high']
    const body = result.forecast.map((row) => [row.month, row.baseline_roi, row.scenario_roi, row.confidence_low, row.confidence_high].join(',')).join('\n')
    const csv = `${header.join(',')}\n${body}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `forecast-${workspaceId || 'workspace'}-${selectedChannelId || 'channel'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const timelineData = useMemo(() => result?.history.map((row) => ({ month: row.month, total: row.roi })) || [], [result])
  const forecastTrendLabels = useMemo(() => result?.forecast.map((row) => row.month) || [], [result])
  const forecastTrendSeries = useMemo(() => {
    if (!result) return []
    return [
      { label: 'Baseline ROI', color: '#4F6D9A', values: result.forecast.map((row) => row.baseline_roi) },
      { label: 'Scenario ROI', color: '#4C956C', values: result.forecast.map((row) => row.scenario_roi) },
      { label: 'Confidence High', color: '#C98C3A', values: result.forecast.map((row) => row.confidence_high) },
    ]
  }, [result])
  const selectedChannel = channels.find((item) => item.id === selectedChannelId)?.name || selectedChannelId || 'No channel'
  const forecastTableRows = useMemo(() => {
    const rows = result?.forecast || []
    const start = (forecastPage - 1) * forecastPageSize
    return rows.slice(start, start + forecastPageSize)
  }, [forecastPage, result])
  const scenarioBars = useMemo(
    () => ({
      labels: ['Baseline', 'Scenario'],
      series: [
        { label: 'ROI', color: '#0f4258', values: result ? [result.baselineROI, result.scenarioROI] : [] },
      ],
    }),
    [result]
  )

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero eyebrow="Revenue Insight Forecast" title="ROI Forecast" subtitle="Test spend scenarios by channel, compare expected ROI shifts, and export projected revenue-performance outputs without changing attribution records." />

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Scenario setup" title="Choose the forecast configuration">
            <div className="m06-filter-grid">
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Channel</span>
                <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>
                  {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Forecast window</span>
                <select value={windowKey} onChange={(e) => setWindowKey(e.target.value as ForecastWindowKey)}>
                  {WINDOW_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Spend multiplier ({multiplier.toFixed(1)}x)</span>
                <input type="range" min={0.5} max={2} step={0.1} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} />
              </label>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={generateForecast} disabled={loading || !selectedChannelId}>{loading ? 'Generating…' : 'Generate Forecast'}</button>
              <button className="btn-ghost" onClick={downloadCSV} disabled={!result?.forecast.length}>Download Forecast CSV</button>
            </div>
            {error ? <div style={{ marginTop: 10, color: 'crimson', fontSize: 13 }}>{error}</div> : null}
          </InsightPanel>

          <InsightPanel eyebrow="Use this page for" title="Decision context" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Scenario comparison" body="Use this view when you want to test whether more or less spend on a channel is likely to improve return before changing budget allocations." />
              <InsightNoteCard title="Read confidence with caution" body="Wide confidence ranges usually mean historical data is volatile or seasonal, so those channels need a more conservative planning assumption." />
              <InsightNoteCard title="Best paired with ROI and allocation" body="Use forecast after reviewing current ROI and attribution coverage, not as a replacement for the present-state commercial read." />
            </div>
          </InsightPanel>
        </section>

        {result ? (
          <>
            <InsightKpiGrid>
              <InsightKpiCard label="Baseline ROI" value={formatPct(result.baselineROI)} note="Expected return without the proposed spend change." tone="navy" />
              <InsightKpiCard label="Scenario ROI" value={formatPct(result.scenarioROI)} note="Projected return once the selected multiplier is applied." tone="teal" />
              <InsightKpiCard label="Trend" value={formatTrend(result.trend)} note="Current direction in the underlying historical signal." tone="slate" />
              <InsightKpiCard label="Confidence Range" value={`${formatPct(result.confidenceLow)} to ${formatPct(result.confidenceHigh)}`} note="Expected uncertainty band around the projection." tone="amber" />
            </InsightKpiGrid>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="History" title="Historical ROI">
                <div style={{ minHeight: 220 }}>
                  <TimelineChart data={timelineData} height={210} />
                </div>
              </InsightPanel>

              <InsightPanel eyebrow="Scenario comparison" title="Baseline versus scenario" soft>
                <div style={{ minHeight: 220 }}>
                  <ForecastGroupedBarChart labels={scenarioBars.labels} series={scenarioBars.series} height={210} suffix="%" />
                </div>
              </InsightPanel>
            </section>

            <InsightPanel eyebrow="Forecast trend" title="Projected monthly ROI movement" soft>
              <div style={{ minHeight: 260 }}>
                <ForecastLineChart labels={forecastTrendLabels} series={forecastTrendSeries} suffix="%" height={250} />
              </div>
            </InsightPanel>

            <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Forecast table" title="Projected monthly outcome">
                <div style={{ marginBottom: 14 }}>
                  <BarChart
                    data={(result.forecast || []).slice(0, 6).map((row) => ({ label: row.month.slice(2), value: row.scenario_roi }))}
                    height={180}
                    valueFormatter={(value) => `${Math.round(value)}%`}
                  />
                </div>
                <div style={insightTokens.tableWrap}>
                  <table style={insightTokens.table}>
                    <thead>
                      <tr>
                        <th style={insightTokens.th}>Month</th>
                        <th style={insightTokens.th}>Baseline ROI</th>
                        <th style={insightTokens.th}>Scenario ROI</th>
                        <th style={insightTokens.th}>Low</th>
                        <th style={insightTokens.th}>High</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastTableRows.map((row) => (
                        <tr key={row.month} style={insightTokens.row}>
                          <td style={insightTokens.tdStrong}>{row.month}</td>
                          <td style={insightTokens.td}>{formatPct(row.baseline_roi)}</td>
                          <td style={insightTokens.td}>{formatPct(row.scenario_roi)}</td>
                          <td style={insightTokens.td}>{formatPct(row.confidence_low)}</td>
                          <td style={insightTokens.td}>{formatPct(row.confidence_high)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={insightTokens.mutedText}>
                    Showing {(forecastPage - 1) * forecastPageSize + 1} to {Math.min(forecastPage * forecastPageSize, result.forecast.length)} of {result.forecast.length} forecast rows.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" className="btn-ghost btn-sm" disabled={forecastPage <= 1} onClick={() => setForecastPage((value) => Math.max(1, value - 1))}>Prev</button>
                    <Pagination page={forecastPage} total={result.forecast.length} limit={forecastPageSize} onPage={setForecastPage} />
                    <button type="button" className="btn-ghost btn-sm" disabled={forecastPage * forecastPageSize >= result.forecast.length} onClick={() => setForecastPage((value) => value + 1)}>Next</button>
                  </div>
                </div>
              </InsightPanel>

              <InsightPanel eyebrow="Forecast interpretation" title="What this scenario is saying" soft>
                <div style={{ display: 'grid', gap: 12 }}>
                  <InsightNoteCard title="Current selection" body={`This scenario is modeling ${selectedChannel} over a ${WINDOW_OPTIONS.find((item) => item.key === windowKey)?.label || windowKey} window at ${multiplier.toFixed(1)}x current spend.`} />
                  <InsightNoteCard title="Forecast method" body={`Auto-selected method: ${formatMethod(result.forecastMethod)}. The switch starts from history length, then overrides in this order when needed: flat recent history, latest-point outlier, overall volatility, and weak linear trend fit.${result.selectionReason ? ` Current reason: ${result.selectionReason}.` : ''}`} />
                  <InsightNoteCard title="Agent explanation" body={result.explanation} />
                  <InsightNoteCard title="Planning guidance" body={result.scenarioROI >= result.baselineROI ? 'The scenario suggests a stronger return profile than baseline, so this channel may justify a controlled budget increase.' : 'The scenario weakens ROI relative to baseline, so this channel should be treated cautiously before increasing spend.'} />
                </div>
              </InsightPanel>
            </section>
          </>
        ) : (
          <InsightPanel eyebrow="Forecast output" title="Waiting for a scenario run" soft>
            <div style={insightTokens.mutedText}>Select a channel and generate a forecast to see projected ROI movement, confidence ranges, and downloadable scenario outputs.</div>
          </InsightPanel>
        )}
      </main>
    </Layout>
  )
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

function formatTrend(trend: string) {
  if (trend === 'upward') return 'Upward'
  if (trend === 'downward') return 'Downward'
  return 'Flat'
}

function formatMethod(method: string) {
  if (method === 'moving_average') return 'Moving Average'
  if (method === 'exponential_smoothing') return 'Exponential Smoothing'
  if (method === 'linear_regression') return 'Linear Trend'
  if (method === 'naive') return 'Naive'
  return method
}
