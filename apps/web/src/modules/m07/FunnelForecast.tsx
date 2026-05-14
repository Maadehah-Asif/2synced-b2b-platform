import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { ForecastGroupedBarChart, ForecastLineChart } from '../../components/ForecastCharts'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type ForecastOptionsResponse = {
  ok?: boolean
  sources?: string[]
  stages?: string[]
  datasetPath?: string
}

type FunnelForecastKpis = {
  latestConversionRate: number
  latestDropRate: number
  latestAvgDaysInStage: number
  projectedConversionRate: number
}

type FunnelHistoryRow = {
  month: string
  leadsEntered: number
  conversionRate: number
  dropRate: number
  avgDaysInStage: number
}

type FunnelForecastRow = {
  month: string
  projectedConversionRate: number
  projectedDropRate: number
  projectedAvgDaysInStage: number
}

type FunnelForecastResult = {
  kpis: FunnelForecastKpis
  history: FunnelHistoryRow[]
  forecast: FunnelForecastRow[]
  forecastMethod?: string
  selectionReason?: string
  explanation: string
}

export default function FunnelForecast() {
  const [sources, setSources] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [stage, setStage] = useState('')
  const [horizonMonths, setHorizonMonths] = useState(3)
  const [datasetPath, setDatasetPath] = useState('')
  const [result, setResult] = useState<FunnelForecastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/m07/forecast/options`)
      .then((response) => response.json())
      .then((json: ForecastOptionsResponse) => {
        if (!json?.ok) return
        setSources(Array.isArray(json.sources) ? json.sources : [])
        setStages(Array.isArray(json.stages) ? json.stages : [])
        setDatasetPath(typeof json.datasetPath === 'string' ? json.datasetPath : '')
      })
      .catch(() => {})
  }, [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/m07/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source || undefined, stage: stage || undefined, horizonMonths }),
      })
      const json = await response.json().catch(() => ({} as { path?: string; error?: string }))
      if (!response.ok) {
        setError(json?.path ? `Dataset missing: ${json.path}` : json?.error || 'Forecast failed.')
        setResult(null)
        return
      }
      setResult(json as FunnelForecastResult)
    } catch {
      setError('Unable to run forecast.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const historyRows = useMemo(() => result?.history || [], [result])
  const forecastRows = useMemo(() => result?.forecast || [], [result])
  const trendLabels = useMemo(() => {
    if (!result) return []
    return [...historyRows.map((row) => row.month), ...forecastRows.map((row) => row.month)]
  }, [forecastRows, historyRows, result])
  const conversionTrendSeries = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Historical Conversion',
        color: '#4C956C',
        values: [...historyRows.map((row) => row.conversionRate), ...forecastRows.map(() => Number.NaN)],
      },
      {
        label: 'Projected Conversion',
        color: '#4F6D9A',
        values: [...historyRows.map(() => Number.NaN), ...forecastRows.map((row) => row.projectedConversionRate)],
      },
      {
        label: 'Projected Drop Rate',
        color: '#C98C3A',
        values: [...historyRows.map(() => Number.NaN), ...forecastRows.map((row) => row.projectedDropRate)],
      },
    ]
  }, [forecastRows, historyRows, result])
  const stagePressureLabels = useMemo(() => (result ? ['Conversion', 'Drop Rate', 'Avg Days'] : []), [result])
  const stagePressureSeries = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Latest',
        color: '#4F6D9A',
        values: [
          result.kpis.latestConversionRate,
          result.kpis.latestDropRate,
          result.kpis.latestAvgDaysInStage,
        ],
      },
      {
        label: 'Projected',
        color: '#4C956C',
        values: [
          forecastRows[forecastRows.length - 1]?.projectedConversionRate ?? result.kpis.projectedConversionRate,
          forecastRows[forecastRows.length - 1]?.projectedDropRate ?? 0,
          forecastRows[forecastRows.length - 1]?.projectedAvgDaysInStage ?? 0,
        ],
      },
    ]
  }, [forecastRows, result])

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m07" />
        </div>

        <InsightHero eyebrow="Funnel Insight Forecast" title="Funnel Forecast" subtitle="Project conversion, drop pressure, and stage delay so funnel owners can anticipate health changes before leakage compounds." />

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Scenario setup" title="Choose the funnel forecast scope">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">All sources</option>
                {sources.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">All stages</option>
                {stages.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={String(horizonMonths)} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="9">9 months</option>
              </select>
              <button className="btn-primary" onClick={run} disabled={loading}>{loading ? 'Generating…' : 'Generate Forecast'}</button>
            </div>
            {datasetPath ? <div style={{ marginTop: 10, fontSize: 12, color: '#5a6786' }}>Dataset path: {datasetPath}</div> : null}
            {error ? <div style={{ marginTop: 10, color: 'crimson', fontSize: 13 }}>{error}</div> : null}
          </InsightPanel>

          <InsightPanel eyebrow="How to use this" title="Decision context" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Use for planning, not maintenance" body="This screen is for estimating where conversion and delay are heading, not for fixing bad records. Input corrections still belong in Data Hub." />
              <InsightNoteCard title="Read drop and delay together" body="A better conversion forecast is only strong if projected drop pressure and stage duration stay controlled at the same time." />
              <InsightNoteCard title="Best paired with leakage and trends" body="Use forecast after reviewing current leakage and trend behavior so the scenario is grounded in the current funnel condition." />
            </div>
          </InsightPanel>
        </section>

        {result ? (
          <>
            <InsightKpiGrid>
              <InsightKpiCard label="Latest Conversion" value={`${result.kpis.latestConversionRate}%`} note="Current conversion rate in the historical series." tone="teal" />
              <InsightKpiCard label="Latest Drop Rate" value={`${result.kpis.latestDropRate}%`} note="Current drop pressure before the forecast window begins." tone="amber" />
              <InsightKpiCard label="Latest Avg Days" value={`${result.kpis.latestAvgDaysInStage}d`} note="Most recent visible delay across the historical view." tone="slate" />
              <InsightKpiCard label="Projected Conversion" value={`${result.kpis.projectedConversionRate}%`} note="Headline conversion outcome at the end of the scenario horizon." tone="navy" />
            </InsightKpiGrid>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Trend view" title="Conversion and pressure trend">
                <ForecastLineChart labels={trendLabels} series={conversionTrendSeries} suffix="%" height={300} />
              </InsightPanel>

              <InsightPanel eyebrow="Latest vs projected" title="Current funnel pressure compared to forecast" soft>
                <ForecastGroupedBarChart labels={stagePressureLabels} series={stagePressureSeries} height={300} />
              </InsightPanel>
            </section>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="History" title="Observed monthly funnel behavior">
                <div style={insightTokens.tableWrap}>
                  <table style={insightTokens.table}>
                    <thead><tr><th style={insightTokens.th}>Month</th><th style={insightTokens.th}>Entered</th><th style={insightTokens.th}>Conversion %</th><th style={insightTokens.th}>Drop %</th><th style={insightTokens.th}>Avg Days</th></tr></thead>
                    <tbody>{historyRows.map((row) => <tr key={row.month} style={insightTokens.row}><td style={insightTokens.tdStrong}>{row.month}</td><td style={insightTokens.td}>{row.leadsEntered}</td><td style={insightTokens.td}>{row.conversionRate}%</td><td style={insightTokens.td}>{row.dropRate}%</td><td style={insightTokens.td}>{row.avgDaysInStage}d</td></tr>)}</tbody>
                  </table>
                </div>
              </InsightPanel>

              <InsightPanel eyebrow="Forecast" title="Projected monthly funnel behavior" soft>
                <div style={insightTokens.tableWrap}>
                  <table style={insightTokens.table}>
                    <thead><tr><th style={insightTokens.th}>Month</th><th style={insightTokens.th}>Projected Conversion %</th><th style={insightTokens.th}>Projected Drop %</th><th style={insightTokens.th}>Projected Avg Days</th></tr></thead>
                    <tbody>{forecastRows.map((row) => <tr key={row.month} style={insightTokens.row}><td style={insightTokens.tdStrong}>{row.month}</td><td style={insightTokens.td}>{row.projectedConversionRate}%</td><td style={insightTokens.td}>{row.projectedDropRate}%</td><td style={insightTokens.td}>{row.projectedAvgDaysInStage}d</td></tr>)}</tbody>
                  </table>
                </div>
              </InsightPanel>
            </section>

            <InsightPanel eyebrow="Forecast interpretation" title="What the projection is saying">
              <div style={{ display: 'grid', gap: 12 }}>
                <InsightNoteCard title="Scenario scope" body={`This projection is using ${source || 'all sources'}, ${stage || 'all stages'}, over a ${horizonMonths}-month horizon.`} />
                <InsightNoteCard title="Forecast method" body={`The model auto-switches from history length first, then applies overrides in this order: flat recent history, latest-point outlier, overall volatility, and weak linear trend fit. Current method: ${formatMethod(result.forecastMethod || '')}.${result.selectionReason ? ` Current reason: ${result.selectionReason}.` : ''}`} />
                <InsightNoteCard title="Projected operating implication" body={result.kpis.projectedConversionRate >= result.kpis.latestConversionRate ? 'The forecast suggests conversion may improve from the current baseline, provided the process keeps drop pressure and delay controlled.' : 'The forecast suggests conversion may weaken relative to the current baseline, so leakage and handoff quality should be reviewed early.'} />
                <InsightNoteCard title="Forecast explanation" body={result.explanation} />
              </div>
            </InsightPanel>
          </>
        ) : (
          <InsightPanel eyebrow="Forecast output" title="Waiting for a scenario run" soft>
            <div style={insightTokens.mutedText}>Choose a source, optional stage focus, and horizon, then generate a forecast to see projected conversion, drop pressure, and delay movement.</div>
          </InsightPanel>
        )}
      </main>
    </Layout>
  )
}

function formatMethod(method: string) {
  if (method === 'moving_average') return 'Moving Average'
  if (method === 'exponential_smoothing') return 'Exponential Smoothing'
  if (method === 'linear_regression') return 'Linear Trend'
  if (method === 'naive') return 'Naive'
  return 'Auto'
}
