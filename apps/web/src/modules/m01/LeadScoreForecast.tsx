import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { ForecastGroupedBarChart, ForecastLineChart } from '../../components/ForecastCharts'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function LeadScoreForecast() {
  const [sources, setSources] = useState<string[]>([])
  const [segments, setSegments] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [owners, setOwners] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [segment, setSegment] = useState('')
  const [industry, setIndustry] = useState('')
  const [owner, setOwner] = useState('')
  const [horizonMonths, setHorizonMonths] = useState(3)
  const [datasetPath, setDatasetPath] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/m01/forecast/options`).then((r) => r.json()).then((j) => {
      if (!j?.ok) return
      setSources(Array.isArray(j.sources) ? j.sources : [])
      setSegments(Array.isArray(j.segments) ? j.segments : [])
      setIndustries(Array.isArray(j.industries) ? j.industries : [])
      setOwners(Array.isArray(j.owners) ? j.owners : [])
      setDatasetPath(typeof j.datasetPath === 'string' ? j.datasetPath : '')
    }).catch(() => {})
  }, [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API_BASE}/m01/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source || undefined, segment: segment || undefined, industry: industry || undefined, owner: owner || undefined, horizonMonths }),
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

  const scoreTrendSeries = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Historical Avg Score',
        color: '#0B4F6C',
        values: [
          ...(result.history || []).map((row: any) => Number(row.avgLeadScore || 0)),
          ...(result.forecast || []).map(() => Number.NaN),
        ],
      },
      {
        label: 'Projected Avg Score',
        color: '#4C956C',
        values: [
          ...(result.history || []).map(() => Number.NaN),
          ...(result.forecast || []).map((row: any) => Number(row.projectedAvgLeadScore || 0)),
        ],
      },
    ]
  }, [result])

  const mixLabels = useMemo(() => {
    if (!result?.history?.length || !result?.forecast?.length) return []
    return ['Low', 'Medium', 'High']
  }, [result])

  const mixSeries = useMemo(() => {
    if (!result?.history?.length || !result?.forecast?.length) return []
    const latestHistory = result.history[result.history.length - 1]
    const latestForecast = result.forecast[result.forecast.length - 1]
    return [
      {
        label: `Current ${latestHistory.month}`,
        color: '#4F6D9A',
        values: [Number(latestHistory.lowRate || 0), Number(latestHistory.mediumRate || 0), Number(latestHistory.highRate || 0)],
      },
      {
        label: `Forecast ${latestForecast.month}`,
        color: '#4C956C',
        values: [Number(latestForecast.projectedLowRate || 0), Number(latestForecast.projectedMediumRate || 0), Number(latestForecast.projectedHighRate || 0)],
      },
    ]
  }, [result])

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <ModuleBackButton toSuffix="/m01" label="Module 1 Home" />

        <InsightHero eyebrow="Lead Quality Forecast" title="Lead Quality Forecast" subtitle="Project score movement and class-mix changes before weak intake starts reducing downstream scoring confidence and lead readiness." />

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Scenario setup" title="Choose the forecast scope">
            <div style={gridWide}>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">All sources</option>
                {sources.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="">All segments</option>
                {segments.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">All industries</option>
                {industries.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">All owners</option>
                {owners.map((item) => <option key={item}>{item}</option>)}
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
              <InsightNoteCard title="Score stability" body="Use this forecast when you need to know whether average lead quality is holding, improving, or drifting before those records are consumed elsewhere." />
              <InsightNoteCard title="Class pressure" body="The mix chart is most useful when LOW share starts climbing or HIGH share stops growing across the selected horizon." />
              <InsightNoteCard title="Best paired with intake review" body="Read this page after checking source quality and merge consistency so forecast decisions stay grounded in the actual intake condition." />
            </div>
          </InsightPanel>
        </section>

        {result ? (
          <>
            <InsightKpiGrid>
              <InsightKpiCard label="Latest Avg Score" value={result.kpis.latestAvgLeadScore} note="Most recent weighted lead-quality score." tone="navy" />
              <InsightKpiCard label="High-Class Share" value={`${result.history?.[result.history.length - 1]?.highRate ?? 0}%`} note="Current share of HIGH-class leads in the latest month." tone="teal" />
              <InsightKpiCard label="Model Confidence" value={`${Math.round((result.history?.[result.history.length - 1]?.avgConfidence ?? 0) * 100)}%`} note="Recent confidence signal in the scored batch." tone="slate" />
              <InsightKpiCard label="Invalid Rate" value={`${result.kpis.latestInvalidRate}%`} note="Observed invalid-record pressure in the current data slice." tone="amber" />
              <InsightKpiCard label="Projected Score" value={result.kpis.projectedAvgLeadScore} note="Expected average quality at the end of the selected horizon." tone="navy" />
            </InsightKpiGrid>

            <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
              <InsightPanel eyebrow="Trend view" title="Lead score movement">
                <ForecastLineChart labels={trendLabels} series={scoreTrendSeries} />
              </InsightPanel>

              <InsightPanel eyebrow="Quality mix" title="Current versus projected class mix" soft>
                <ForecastGroupedBarChart labels={mixLabels} series={mixSeries} suffix="%" />
              </InsightPanel>
            </section>

            <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
              <InsightPanel eyebrow="History" title="Observed score history">
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Avg Score</th><th style={th}>LOW %</th><th style={th}>MEDIUM %</th><th style={th}>HIGH %</th></tr></thead>
                  <tbody>{(result.history || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.avgLeadScore}</td><td style={td}>{row.lowRate}%</td><td style={td}>{row.mediumRate}%</td><td style={td}>{row.highRate}%</td></tr>)}</tbody>
                </table>
              </InsightPanel>

              <InsightPanel eyebrow="Forecast" title="Projected score history" soft>
                <table style={table}>
                  <thead><tr><th style={th}>Month</th><th style={th}>Score</th><th style={th}>LOW %</th><th style={th}>MEDIUM %</th><th style={th}>HIGH %</th></tr></thead>
                  <tbody>{(result.forecast || []).map((row: any) => <tr key={row.month}><td style={td}>{row.month}</td><td style={td}>{row.projectedAvgLeadScore}</td><td style={td}>{row.projectedLowRate}%</td><td style={td}>{row.projectedMediumRate}%</td><td style={td}>{row.projectedHighRate}%</td></tr>)}</tbody>
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

const gridWide: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 16 }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 12 }
const th: React.CSSProperties = { padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: 12, background: '#f5f7fa' }
const td: React.CSSProperties = { padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 12 }
