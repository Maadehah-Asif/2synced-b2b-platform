import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import { fetchFromApi, parseApiJson } from '../../utils/api'
import { useWorkspaceId } from '../../utils/workspace'
import BarChart from '../m06/BarChart'
import PieChart from '../m06/PieChart'
import TimelineChart from '../m06/TimelineChart'

type IntentRun = {
  _id: string
  filename?: string
  createdAt?: string
  status?: string
}

type DashboardPoint = { label: string; value: number }
type IntentDashboardResponse = {
  run: { id: string; filename: string; createdAt?: string; status?: string }
  metrics: {
    total: number
    averageLead: number
    averageIntent: number
    highIntentShare: number
    hotQuadrant: number
    horizonHighShare: { shortTerm: number; mediumTerm: number; longTerm: number }
  }
  charts: {
    pie: DashboardPoint[]
    line: DashboardPoint[]
    bars: DashboardPoint[]
    barLabel: string
  }
  highlights: string[]
  topLeads: Array<{ leadId: string; company: string; segment: string; intentScore: number; leadScore: number; category: string }>
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function IntentDashboard() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [runs, setRuns] = useState<IntentRun[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [dashboard, setDashboard] = useState<IntentDashboardResponse | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRuns() {
      if (!workspaceId) return
      setLoadingRuns(true)
      setError(null)
      try {
        const params = new URLSearchParams({ workspace: workspaceId })
        const res = await fetchFromApi(`${API_BASE}/m02/intent-runs?${params.toString()}`, undefined, API_BASE)
        const json = await parseApiJson<{ runs: IntentRun[] }>(res, 'Could not load intent runs')
        const nextRuns = json.runs || []
        setRuns(nextRuns)
        setSelectedId((current) => current || nextRuns[0]?._id || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load intent runs')
      } finally {
        setLoadingRuns(false)
      }
    }
    void loadRuns()
  }, [workspaceId])

  useEffect(() => {
    async function loadDashboard() {
      if (!selectedId) {
        setDashboard(null)
        return
      }
      setLoadingDashboard(true)
      setError(null)
      try {
        const res = await fetchFromApi(`${API_BASE}/m02/dashboard/${selectedId}`, undefined, API_BASE)
        const json = await parseApiJson<IntentDashboardResponse>(res, 'Could not load the intent dashboard')
        setDashboard(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the intent dashboard')
        setDashboard(null)
      } finally {
        setLoadingDashboard(false)
      }
    }
    void loadDashboard()
  }, [selectedId])

  const lineData = useMemo(() => (dashboard?.charts.line || []).map((item) => ({ month: item.label, total: item.value })), [dashboard])
  const pieData = dashboard?.charts.pie || []
  const barData = dashboard?.charts.bars || []

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />
        </div>

        <InsightHero
          eyebrow="Intent Signals Dashboard"
          title="Intent Prioritization Dashboard"
          subtitle="Choose a final intent CSV and compare intent strength, fit alignment, and where the strongest urgent demand is clustering before the sales team acts."
        />

        <InsightPanel eyebrow="Dataset selection" title="Choose the final intent CSV" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{loadingDashboard ? 'Refreshing dashboard...' : `${runs.length} intent runs available`}</div>}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(280px, 420px) 1fr', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#415274', fontWeight: 700 }}>Final intent CSV</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loadingRuns || !runs.length}>
                {!runs.length ? <option value="">No intent runs yet</option> : null}
                {runs.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.filename || 'Intent run'}
                  </option>
                ))}
              </select>
            </label>
            <div style={insightTokens.mutedText}>
              {dashboard?.run?.createdAt
                ? `Selected run: ${dashboard.run.filename}. Generated on ${new Date(dashboard.run.createdAt).toLocaleDateString()}.`
                : 'Select an intent output run to build the dashboard from the actual prioritized rows.'}
            </div>
          </div>
          {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Leads in Run" value={dashboard?.metrics.total ?? 0} note="Total records inside the selected final intent CSV." tone="navy" />
          <InsightKpiCard label="Avg Lead Score" value={Math.round(dashboard?.metrics.averageLead ?? 0)} note="Average fit or lead quality level carried into the intent layer." tone="slate" />
          <InsightKpiCard label="Avg Intent Score" value={Math.round(dashboard?.metrics.averageIntent ?? 0)} note="Average buyer-intent strength across the selected run." tone="teal" />
          <InsightKpiCard label="Hot Quadrant" value={dashboard?.metrics.hotQuadrant ?? 0} note={`${Math.round(dashboard?.metrics.highIntentShare ?? 0)}% of the run is currently high intent.`} tone="amber" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Intent shape" title="Intent-score distribution">
            <div style={{ height: 270 }}>
              <TimelineChart data={lineData} height={250} tone="amber" />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Heat mix" title="Intent category split" soft>
            {pieData.length ? <PieChart data={pieData} size={200} /> : <div style={insightTokens.mutedText}>Intent-category mix will appear here once the selected run contains generated intent scores.</div>}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Where urgency sits" title={dashboard?.charts.barLabel || 'Lead volume by grouping'}>
            {barData.length ? <BarChart data={barData} height={230} valueFormatter={(value) => String(value)} /> : <div style={insightTokens.mutedText}>Grouping patterns appear here when the file includes source, segment, industry, or company columns.</div>}
          </InsightPanel>

          <InsightPanel eyebrow="Horizon readout" title="How the run reads today" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Short-term urgency" body={`${Math.round(dashboard?.metrics.horizonHighShare.shortTerm ?? 0)}% of rows are currently marked high in short-term intent, which is the clearest immediate-action pool.`} />
              <InsightNoteCard title="Medium-term nurture" body={`${Math.round(dashboard?.metrics.horizonHighShare.mediumTerm ?? 0)}% of rows still show medium-window intent strength, which helps the team separate now-leads from next-leads.`} />
              <InsightNoteCard title="Manager summary" body={(dashboard?.highlights || [])[0] || 'The selected intent run does not yet contain enough visible signals to generate a stronger management summary.'} />
            </div>
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Priority notes" title="Key signals from the selected run">
            <div style={{ display: 'grid', gap: 12 }}>
              {(dashboard?.highlights || []).map((item, index) => (
                <InsightNoteCard key={index} title={`Signal ${index + 1}`} body={item} />
              ))}
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Top accounts" title="Highest-intent rows in the selected run" soft>
            <div style={insightTokens.tableWrap}>
              <table style={insightTokens.table}>
                <thead>
                  <tr>
                    <th style={insightTokens.th}>Lead ID</th>
                    <th style={insightTokens.th}>Company</th>
                    <th style={insightTokens.th}>Segment</th>
                    <th style={insightTokens.th}>Lead Score</th>
                    <th style={insightTokens.th}>Intent Score</th>
                    <th style={insightTokens.th}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.topLeads || []).map((row) => (
                    <tr key={`${row.leadId}-${row.company}`} style={insightTokens.row}>
                      <td style={insightTokens.tdStrong}>{row.leadId || '—'}</td>
                      <td style={insightTokens.td}>{row.company || '—'}</td>
                      <td style={insightTokens.td}>{row.segment || '—'}</td>
                      <td style={insightTokens.td}>{Math.round(row.leadScore)}</td>
                      <td style={insightTokens.td}>{Math.round(row.intentScore)}</td>
                      <td style={insightTokens.td}>{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InsightPanel>
        </section>
      </main>
    </Layout>
  )
}
