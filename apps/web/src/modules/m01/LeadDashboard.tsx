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

type LeadsFile = {
  _id: string
  name?: string
  filename?: string
  createdAt?: string
}

type DashboardPoint = { label: string; value: number }
type LeadDashboardResponse = {
  file: { id: string; name: string; filename: string; createdAt?: string }
  metrics: {
    totalLeads: number
    averageConfidence: number
    highShare: number
    averageProbabilities: { low: number; medium: number; high: number }
    labelCounts: Record<string, number>
  }
  charts: {
    line: DashboardPoint[]
    pie: DashboardPoint[]
    bars: DashboardPoint[]
    barLabel: string
    lineLabel: string
  }
  highlights: string[]
  topLeads: Array<{ leadId: string; name: string; company: string; segment: string; label: string; confidence: number }>
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function LeadDashboard() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [files, setFiles] = useState<LeadsFile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [dashboard, setDashboard] = useState<LeadDashboardResponse | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFiles() {
      if (!workspaceId) return
      setLoadingList(true)
      setError(null)
      try {
        const params = new URLSearchParams({ workspace: workspaceId, outputKind: 'm01' })
        const res = await fetchFromApi(`${API_BASE}/m01/leads?${params.toString()}`, undefined, API_BASE)
        const json = await parseApiJson<{ items: LeadsFile[] }>(res, 'Could not load lead outputs')
        const nextFiles = json.items || []
        setFiles(nextFiles)
        setSelectedId((current) => current || nextFiles[0]?._id || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load lead outputs')
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
        const params = new URLSearchParams({ workspace: workspaceId })
        const res = await fetchFromApi(`${API_BASE}/m01/leads/${selectedId}/dashboard?${params.toString()}`, undefined, API_BASE)
        const json = await parseApiJson<LeadDashboardResponse>(res, 'Could not load the lead dashboard')
        setDashboard(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the lead dashboard')
        setDashboard(null)
      } finally {
        setLoadingDashboard(false)
      }
    }
    void loadDashboard()
  }, [workspaceId, selectedId])

  const lineData = useMemo(() => (dashboard?.charts.line || []).map((item) => ({ month: item.label, total: item.value })), [dashboard])
  const barData = dashboard?.charts.bars || []
  const pieData = dashboard?.charts.pie || []

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m01" />
        </div>

        <InsightHero
          eyebrow="Lead Quality Dashboard"
          title="Lead Scoring Dashboard"
          subtitle="Choose a final lead-scored CSV and read the quality mix, confidence shape, and strongest scoring pockets in one visual workspace before handing records downstream."
        />

        <InsightPanel eyebrow="Dataset selection" title="Choose the final scored CSV" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{loadingDashboard ? 'Refreshing dashboard...' : `${files.length} outputs available`}</div>}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(280px, 420px) 1fr', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#415274', fontWeight: 700 }}>Final lead-scored CSV</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loadingList || !files.length}>
                {!files.length ? <option value="">No final outputs yet</option> : null}
                {files.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name || item.filename || 'Lead output'}
                  </option>
                ))}
              </select>
            </label>
            <div style={insightTokens.mutedText}>
              {dashboard?.file?.createdAt
                ? `Selected file: ${dashboard.file.name}. Generated on ${new Date(dashboard.file.createdAt).toLocaleDateString()}.`
                : 'Select a generated lead output to build the dashboard from the actual scored rows.'}
            </div>
          </div>
          {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Leads in File" value={dashboard?.metrics.totalLeads ?? 0} note="Total scored records in the selected final CSV." tone="navy" />
          <InsightKpiCard label="Avg Confidence" value={`${Math.round(dashboard?.metrics.averageConfidence ?? 0)}%`} note="Higher confidence means the quality classification is less ambiguous." tone="teal" />
          <InsightKpiCard label="High-Quality Share" value={`${Math.round(dashboard?.metrics.highShare ?? 0)}%`} note="Share of rows currently labeled as high quality." tone="amber" />
          <InsightKpiCard label="Avg Probability Mix" value={`${Math.round(dashboard?.metrics.averageProbabilities.high ?? 0)}% high`} note={`Low ${Math.round(dashboard?.metrics.averageProbabilities.low ?? 0)}% • Medium ${Math.round(dashboard?.metrics.averageProbabilities.medium ?? 0)}%`} tone="slate" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Confidence shape" title={dashboard?.charts.lineLabel || 'Confidence distribution'}>
            <div style={{ height: 270 }}>
              <TimelineChart data={lineData} height={250} tone="teal" />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Quality mix" title="Predicted label split" soft>
            {pieData.length ? <PieChart data={pieData} size={200} /> : <div style={insightTokens.mutedText}>Quality distribution appears here once the selected file contains scored rows.</div>}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Strongest pocket" title={dashboard?.charts.barLabel || 'Lead volume by grouping'}>
            {barData.length ? <BarChart data={barData} height={230} valueFormatter={(value) => String(value)} /> : <div style={insightTokens.mutedText}>Grouping patterns will appear here when the file includes source, segment, owner, industry, or company columns.</div>}
          </InsightPanel>

          <InsightPanel eyebrow="Management readout" title="What this file is saying" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              {(dashboard?.highlights || []).map((item, index) => (
                <InsightNoteCard key={index} title={`Signal ${index + 1}`} body={item} />
              ))}
            </div>
          </InsightPanel>
        </section>

        <InsightPanel eyebrow="Top scored rows" title="Highest-confidence leads in the selected file">
          <div style={{ ...insightTokens.mutedText, marginBottom: 12 }}>
            These rows are pulled from the actual selected CSV and ranked by model confidence so the team can quickly see which records look strongest.
          </div>
          <div style={insightTokens.tableWrap}>
            <table style={insightTokens.table}>
              <thead>
                <tr>
                  <th style={insightTokens.th}>Lead ID</th>
                  <th style={insightTokens.th}>Name</th>
                  <th style={insightTokens.th}>Company</th>
                  <th style={insightTokens.th}>Segment</th>
                  <th style={insightTokens.th}>Label</th>
                  <th style={insightTokens.th}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.topLeads || []).map((row) => (
                  <tr key={`${row.leadId}-${row.name}`} style={insightTokens.row}>
                    <td style={insightTokens.tdStrong}>{row.leadId || '—'}</td>
                    <td style={insightTokens.td}>{row.name || '—'}</td>
                    <td style={insightTokens.td}>{row.company || '—'}</td>
                    <td style={insightTokens.td}>{row.segment || '—'}</td>
                    <td style={insightTokens.td}>{row.label}</td>
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
