/**
 * Module: Intent Signals (m02)
 * Layer: Frontend
 * File: IntentDashboard.tsx
 * Purpose: Supports the I nt en tD as hb oa rd flow for this module.
 * Notes: Documentation header added for maintainability.
 */

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

type IntentFile = {
  _id: string
  name?: string
  filename?: string
  createdAt?: string
}

type DashboardPoint = { label: string; value: number }
type IntentDashboardResponse = {
  file: { id: string; name: string; filename: string; createdAt?: string }
  metrics: {
    totalLeads: number
    averageIntent: number
    averageConfidence: number
    highIntentShare: number
    averageProbabilities: { low: number; medium: number; high: number }
    segmentCounts: Record<string, number>
  }
  charts: {
    line: DashboardPoint[]
    pie: DashboardPoint[]
    bars: DashboardPoint[]
    barLabel: string
    lineLabel: string
  }
  highlights: string[]
  topLeads: Array<{ leadId: string; name: string; company: string; segment: string; intentSegment: string; intentScore: number; confidence: number }>
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function IntentDashboard() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [files, setFiles] = useState<IntentFile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [dashboard, setDashboard] = useState<IntentDashboardResponse | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFiles() {
      if (!workspaceId) return
      setLoadingList(true)
      setError(null)
      try {
        // The dashboard is always built from already-generated intent outputs,
        // not raw uploads, so the dropdown is sourced from the dedicated file list.
        const params = new URLSearchParams({ workspace: workspaceId })
        const res = await fetchFromApi(`${API_BASE}/m02/dashboard-files?${params.toString()}`, undefined, API_BASE)
        const json = await parseApiJson<{ items: IntentFile[] }>(res, 'Could not load intent outputs')
        const nextFiles = json.items || []
        setFiles(nextFiles)
        setSelectedId((current) => current || nextFiles[0]?._id || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load intent outputs')
      } finally {
        setLoadingList(false)
      }
    }
    void loadFiles()
  }, [workspaceId])

  useEffect(() => {
    async function loadDashboard() {
      if (!workspaceId || !selectedId) {
        setDashboard(null)
        return
      }
      setLoadingDashboard(true)
      setError(null)
      try {
        // The selected file id becomes the single source of truth for all
        // dashboard metrics, charts, and top-lead highlights.
        const params = new URLSearchParams({ workspace: workspaceId })
        const res = await fetchFromApi(`${API_BASE}/m02/dashboard/${selectedId}?${params.toString()}`, undefined, API_BASE)
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
  }, [workspaceId, selectedId])

  const lineData = useMemo(() => (dashboard?.charts.line || []).map((item) => ({ month: item.label, total: item.value })), [dashboard])
  // Reuse the same visual primitives as the other insight dashboards so M02
  // reads as part of the same reporting system.
  const barData = dashboard?.charts.bars || []
  const pieData = dashboard?.charts.pie || []

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />
        </div>

        <InsightHero
          eyebrow="Intent Signals Dashboard"
          title="Intent Scoring Dashboard"
          subtitle="Choose a final intent-scored CSV and read the intent mix, score shape, and strongest hot-demand pockets in one visual workspace before the team acts."
        />

        <InsightPanel eyebrow="Dataset selection" title="Choose the final scored CSV" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{loadingDashboard ? 'Refreshing dashboard...' : `${files.length} outputs available`}</div>}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(280px, 420px) 1fr', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#415274', fontWeight: 700 }}>Final intent-scored CSV</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loadingList || !files.length}>
                {!files.length ? <option value="">No final outputs yet</option> : null}
                {files.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name || item.filename || 'Intent output'}
                  </option>
                ))}
              </select>
            </label>
            <div style={insightTokens.mutedText}>
              {dashboard?.file?.createdAt
                ? `Selected file: ${dashboard.file.name}. Generated on ${new Date(dashboard.file.createdAt).toLocaleDateString()}.`
                : 'Select a generated intent output to build the dashboard from the actual scored rows.'}
            </div>
          </div>
          {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Leads in File" value={dashboard?.metrics.totalLeads ?? 0} note="Total scored records in the selected final CSV." tone="navy" />
          <InsightKpiCard label="Avg Intent Score" value={Math.round(dashboard?.metrics.averageIntent ?? 0)} note="Average buyer-intent strength across the selected output." tone="teal" />
          <InsightKpiCard label="Avg Confidence" value={`${Math.round(dashboard?.metrics.averageConfidence ?? 0)}%`} note="Higher confidence means the intent classification is less ambiguous." tone="amber" />
          <InsightKpiCard label="Hot and Blazing Share" value={`${Math.round(dashboard?.metrics.highIntentShare ?? 0)}%`} note={`Low ${Math.round(dashboard?.metrics.averageProbabilities.low ?? 0)}% | Medium ${Math.round(dashboard?.metrics.averageProbabilities.medium ?? 0)}%`} tone="slate" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Intent shape" title={dashboard?.charts.lineLabel || 'Intent-score distribution'}>
            <div style={{ height: 270 }}>
              <TimelineChart data={lineData} height={250} tone="amber" />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Intent mix" title="Predicted segment split" soft>
            {pieData.length ? <PieChart data={pieData} size={200} /> : <div style={insightTokens.mutedText}>Intent-segment distribution appears here once the selected file contains scored rows.</div>}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Strongest pocket" title={dashboard?.charts.barLabel || 'Lead volume by grouping'}>
            {barData.length ? <BarChart data={barData} height={230} valueFormatter={(value) => String(value)} /> : <div style={insightTokens.mutedText}>Grouping patterns will appear here when the file includes source, segment, industry, or company columns.</div>}
          </InsightPanel>

          <InsightPanel eyebrow="Management readout" title="What this file is saying" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              {(dashboard?.highlights || []).map((item, index) => (
                <InsightNoteCard key={index} title={`Signal ${index + 1}`} body={item} />
              ))}
            </div>
          </InsightPanel>
        </section>

        <InsightPanel eyebrow="Top scored rows" title="Highest-intent leads in the selected file">
          <div style={{ ...insightTokens.mutedText, marginBottom: 12 }}>
            These rows are pulled from the actual selected CSV and ranked by intent score so the team can quickly see which records look hottest right now.
          </div>
          <div style={insightTokens.tableWrap}>
            <table style={insightTokens.table}>
              <thead>
                <tr>
                  <th style={insightTokens.th}>Lead ID</th>
                  <th style={insightTokens.th}>Name</th>
                  <th style={insightTokens.th}>Company</th>
                  <th style={insightTokens.th}>Segment</th>
                  <th style={insightTokens.th}>Intent Segment</th>
                  <th style={insightTokens.th}>Intent Score</th>
                  <th style={insightTokens.th}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.topLeads || []).map((row) => (
                  <tr key={`${row.leadId}-${row.name}`} style={insightTokens.row}>
                    <td style={insightTokens.tdStrong}>{row.leadId || '-'}</td>
                    <td style={insightTokens.td}>{row.name || '-'}</td>
                    <td style={insightTokens.td}>{row.company || '-'}</td>
                    <td style={insightTokens.td}>{row.segment || '-'}</td>
                    <td style={insightTokens.td}>{row.intentSegment}</td>
                    <td style={insightTokens.td}>{Math.round(row.intentScore)}</td>
                    <td style={insightTokens.td}>{Math.round(row.confidence)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InsightPanel>
      </main>
    </Layout>
  )
}
