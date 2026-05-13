import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { ForecastGroupedBarChart, ForecastLineChart } from '../../components/ForecastCharts'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function IntentForecast() {
  const [segments, setSegments] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [segment, setSegment] = useState('')
  const [industry, setIndustry] = useState('')
  const [horizonMonths, setHorizonMonths] = useState(3)
  const [datasetPath, setDatasetPath] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/m02/forecast/options`).then((r) => r.json()).then((j) => {
      if (!j?.ok) return
      setSegments(Array.isArray(j.segments) ? j.segments : [])
      setIndustries(Array.isArray(j.industries) ? j.industries : [])
      setDatasetPath(typeof j.datasetPath === 'string' ? j.datasetPath : '')
    }).catch(() => {})
  }, [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API_BASE}/m02/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segment || undefined, industry: industry || undefined, horizonMonths }),
      })
      const j = await r.json()
      if (!r.ok) setError(j?.path ? `Dataset missing: ${j.path}` : j?.error || 'Forecast failed.')
      setResult(r.ok ? j : null)
    } catch {
      setError('Unable to run forecast.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const trendLabels = useMemo(() => {
    if (!result) return []
    return [...(result.history || []).map((row: any) => row.month), ...(result.forecast || []).map((row: any) => row.month)]
  }, [result])

  const intentTrendSeries = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Historical Avg Intent',
        color: '#0B4F6C',
        values: [
          ...(result.history || []).map((row: any) => Number(row.avgIntentScore || 0)),
          ...(result.forecast || []).map(() => Number.NaN),
        ],
      },
      {
        label: 'Projected Avg Intent',
        color: '#4C956C',
        values: [
          ...(result.history || []).map(() => Number.NaN),
          ...(result.forecast || []).map((row: any) => Number(row.projectedAvgIntentScore || 0)),
        ],
      },
    ]
  }, [result])

  const heatMixLabels = useMemo(() => {
    if (!result?.history?.length || !result?.forecast?.length) return []
    return ['Warm', 'Hot', 'Blazing']
  }, [result])

  const heatMixSeries = useMemo(() => {
    if (!result?.history?.length || !result?.forecast?.length) return []
    const latestHistory = result.history[result.history.length - 1]
    const latestForecast = result.forecast[result.forecast.length - 1]
    return [
      {
        label: `Current ${latestHistory.month}`,
        color: '#4F6D9A',
        values: [Number(latestHistory.warmRate || 0), Number(latestHistory.hotRate || 0), Number(latestHistory.blazingRate || 0)],
      },
      {
        label: `Forecast ${latestForecast.month}`,
        color: '#4C956C',
        values: [Number(latestForecast.projectedWarmRate || 0), Number(latestForecast.projectedHotRate || 0), Number(latestForecast.projectedBlazingRate || 0)],
      },
    ]
  }, [result])

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <ModuleBackButton toSuffix="/m02" label="Module 2 Home" />

        <InsightHero eyebrow="Intent Forecast" title="Intent Forecast" subtitle="Project intent strength and heat-band movement before prioritization logic starts drifting away from current buyer behaviour." />

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Scenario setup" title="Choose the forecast scope">
            <div style={grid}>
              <select value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="">All segments</option>
                {segments.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">All industries</option>
                {industries.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={String(horizonMonths)} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="9">9 months</option>
              </select>
              <button className="btn-primary" onClick={run} disabled={loading}>{loading ? 'Generating…' : 'Generate Forecast'}</button>
            </div>
            {datasetPath ? <div style={{ marginTop: 10, fontSize: 12, color: '#5a6786' }}>Dataset path: {datasetPath}</div> : null}
            {error ? <div style={{ marginTop: 10, color: 'crimson' }}>{error}</div> : null}
          </InsightPanel>

          <InsightPanel eyebrow="Use this page for" title="Decision context" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Heat movement" body="Use this screen to see whether leads are warming toward action or cooling into weaker priority bands over the selected horizon." />
              <InsightNoteCard title="Blazing share" body="The heat-mix chart is most useful when HOT and BLAZING movement starts flattening after a strong recent period." />
              <InsightNoteCard title="Best paired with prioritization" body="Use the forecast after reading the current prioritization view so the scenario stays grounded in today’s strongest visible intent signals." />
            </div>
          </InsightPanel>
        </section>

        {result ? (
          <>
            <InsightKpiGrid>
              <InsightKpiCard label="Latest Avg Intent" value={result.kpis.latestAvgIntentScore} note="Most recent average intent strength in the historical series." tone="navy" />
              <InsightKpiCard label="Blazing Share" value={`${result.history?.[result.history.length - 1]?.blazingRate ?? 0}%`} note="Current share of the hottest intent band." tone="teal" />
              <InsightKpiCard label="Dormant Leads" value={result.kpis.latestDormantLeads} note="Inactive leads still visible in the latest period." tone="amber" />
              <InsightKpiCard label="Projected Intent" value={result.kpis.projectedAvgIntentScore} note="Expected average intent at the end of the selected horizon." tone="slate" />
            </InsightKpiGrid>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Trend view" title="Intent movement">
                <ForecastLineChart labels={trendLabels} series={intentTrendSeries} />
              </InsightPanel>

              <InsightPanel eyebrow="Heat mix" title="Current versus projected heat mix" soft>
                <ForecastGroupedBarChart labels={heatMixLabels} series={heatMixSeries} suffix="%" />
              </InsightPanel>
            </section>

            <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
              <InsightPanel eyebrow="History" title="Observed intent history">
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Avg Intent</th><th style={th}>COLD %</th><th style={th}>HOT %</th><th style={th}>BLAZING %</th></tr></thead>
                  <tbody>{(result.history || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.avgIntentScore}</td><td style={td}>{row.coldRate}%</td><td style={td}>{row.hotRate}%</td><td style={td}>{row.blazingRate}%</td></tr>)}</tbody>
                </table>
              </InsightPanel>

              <InsightPanel eyebrow="Forecast" title="Projected intent history" soft>
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Avg Intent</th><th style={th}>WARM %</th><th style={th}>HOT %</th><th style={th}>BLAZING %</th></tr></thead>
                  <tbody>{(result.forecast || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.projectedAvgIntentScore}</td><td style={td}>{row.projectedWarmRate}%</td><td style={td}>{row.projectedHotRate}%</td><td style={td}>{row.projectedBlazingRate}%</td></tr>)}</tbody>
                </table>
              </InsightPanel>
            </section>

            <InsightPanel eyebrow="Forecast interpretation" title="What the forecast is saying">
              <div style={{ color: '#415274', lineHeight: 1.8 }}>{result.explanation}</div>
            </InsightPanel>
          </>
        ) : null}
      </main>
    </Layout>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 12 }
const th: React.CSSProperties = { padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: 12, background: '#f5f7fa' }
const td: React.CSSProperties = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 }
