/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: Module6Main.tsx
 * Purpose: Supports the M od ul e6 Ma in flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightMiniStat, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import { useWorkspaceId } from '../../utils/workspace'
import { fetchFromApi, parseApiJson } from '../../utils/api'
import './module6.css'
import BarChart from './BarChart'
import PieChart from './PieChart'
import TimelineChart from './TimelineChart'

type RevenueByChannelRow = {
  channel: string
  revenue?: number
  attributedRevenue?: number
  roi?: number
  spend?: number
}

type RevenueOverTimeRow = {
  month?: string
  period?: string
  total?: number
  revenue?: number
  spend?: number
  roi?: number
}

type CampaignSignal = {
  name?: string
  channel?: string
  spend?: number
  revenue?: number
  attributedRevenue?: number
  roi?: number
}

type Module6MainStats = {
  revenueByChannel?: RevenueByChannelRow[]
  revenueOverTime?: RevenueOverTimeRow[]
  totalRevenue?: number
  attributedRevenue?: number
  totalSpend?: number
  campaignCount?: number
  topCampaigns?: CampaignSignal[]
  bottomCampaigns?: CampaignSignal[]
  message?: string
  status?: string
  modelName?: string
}

const MODEL_OPTIONS = [
  { value: 'first-touch', label: 'First-touch' },
  { value: 'last-touch', label: 'Last-touch' },
  { value: 'linear', label: 'Linear' },
]

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Module6Main() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [model, setModel] = useState<string>('linear')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Module6MainStats | null>(null)

  const fetchStats = useCallback(async () => {
    if (!workspaceId) {
      setStats(null)
      setError('Open a workspace to view Revenue Insight.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('projectId', workspaceId)
      if (model) params.set('model', model)
      const res = await fetchFromApi(`${API_BASE}/m06/stats?${params.toString()}`, undefined, API_BASE)
      const json = await parseApiJson<Module6MainStats>(res, 'Could not load Revenue Insight dashboard')
      setStats(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Revenue Insight dashboard')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [model, workspaceId])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const revenueByChannel = useMemo(() => stats?.revenueByChannel || [], [stats])
  const revenueOverTime = useMemo(() => stats?.revenueOverTime || [], [stats])
  const timelineData = useMemo(() => revenueOverTime.map((point) => ({ month: point.month || point.period || 'Unknown', total: Number(point.total ?? point.revenue ?? 0) })), [revenueOverTime])
  const donutData = revenueByChannel.map((row) => ({ label: row.channel, value: Number(row.attributedRevenue ?? row.revenue ?? 0) }))
  const totalRevenue = Number(stats?.totalRevenue || 0)
  const attributedRevenue = Number(stats?.attributedRevenue || 0)
  const totalSpend = Number(stats?.totalSpend || 0)
  const campaignCount = Number(stats?.campaignCount || 0)
  const unattributedRevenue = Math.max(0, totalRevenue - attributedRevenue)
  const attributionCoverage = totalRevenue > 0 ? Math.round((attributedRevenue / totalRevenue) * 100) : 0
  const overallROI = totalSpend > 0 ? Math.round((attributedRevenue / totalSpend) * 100) : 0
  const bestChannel = [...revenueByChannel].sort((a, b) => Number(b.roi || 0) - Number(a.roi || 0))[0] || null
  const highestSpendChannel = [...revenueByChannel].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0] || null
  const strongestMonth = [...revenueOverTime].sort((a, b) => Number(b.revenue ?? b.total ?? 0) - Number(a.revenue ?? a.total ?? 0))[0] || null
  const topCampaigns = (stats?.topCampaigns || []).slice(0, 4)
  const bottomCampaigns = (stats?.bottomCampaigns || []).slice(0, 4)
  const roiTimelineData = useMemo(() => revenueOverTime.map((point) => ({ month: point.month || point.period || 'Unknown', total: Number(point.roi || 0) })), [revenueOverTime])
  const spendByChannelData = useMemo(() => revenueByChannel.map((row) => ({ label: String(row.channel || 'other'), value: Number(row.spend || 0) })), [revenueByChannel])
  const channelPerformanceRows = useMemo(() => {
    return revenueByChannel.map((row) => ({
      channel: row.channel,
      attributedRevenue: Number(row.attributedRevenue ?? row.revenue ?? 0),
      spend: Number(row.spend || 0),
      roi: Number(row.roi || 0),
    }))
  }, [revenueByChannel])

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: '10px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero
          eyebrow="Revenue Insight Dashboard"
          title="Main Revenue Dashboard"
          subtitle="Read revenue movement, attribution coverage, spend efficiency, and channel performance in one executive view before drilling into ROI, attribution, forecasting, or allocation."
        />

        <InsightPanel
          eyebrow="Filters"
          title="Control the dashboard scope"
          soft
          rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{loading ? 'Refreshing dashboard…' : 'The attribution model directly changes the dashboard metrics'}</div>}
        >
          <div className="m06-filter-grid">
            <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Attribution model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
          {!error && stats?.message ? <div style={{ marginTop: 12, color: '#7a5b14' }}>{stats.message}</div> : null}
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} note="All revenue visible inside the selected dashboard window." tone="navy" />
          <InsightKpiCard label="Attributed Revenue" value={formatCurrency(attributedRevenue)} note={`${attributionCoverage}% of revenue is currently tied to campaign evidence.`} tone="teal" />
          <InsightKpiCard label="Spend In Scope" value={formatCurrency(totalSpend)} note={`Commercial return currently reads at ${overallROI}% ROI.`} tone="slate" />
          <InsightKpiCard label="Unattributed Revenue" value={formatCurrency(unattributedRevenue)} note="Revenue still lacking enough touch evidence for clean allocation." tone="amber" />
          <InsightKpiCard label="Campaign Count" value={campaignCount} note="Campaigns currently contributing to this dashboard scope." tone="navy" />
          <InsightKpiCard label="Best Channel" value={bestChannel?.channel || '—'} note={bestChannel ? `${Math.round(Number(bestChannel.roi || 0))}% ROI in the current scope.` : 'No clear ROI leader is visible yet.'} tone="teal" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Revenue flow" title="Revenue timeline">
            <div style={{ height: 250 }}>
              <TimelineChart data={timelineData} valueFormatter={formatCompactCurrency} tone="navy" />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Channel mix" title="Attributed revenue by channel" soft>
            {donutData.length ? (
              <div style={{ display: 'grid', gap: 14, placeItems: 'center' }}>
                <PieChart data={donutData} size={200} />
                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                  {donutData.map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: '#415274' }}>
                      <strong style={{ color: '#0B2540' }}>{item.label}</strong>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={insightTokens.mutedText}>Channel contribution will appear here once attributed revenue exists in the selected scope.</div>
            )}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Efficiency trend" title="ROI by period">
            {roiTimelineData.length ? (
              <div style={{ height: 250 }}>
                <TimelineChart data={roiTimelineData} valueFormatter={(value) => `${Math.round(value)}%`} tone="teal" />
              </div>
            ) : (
              <div style={insightTokens.mutedText}>ROI trend will appear here once attributed periods are available.</div>
            )}
          </InsightPanel>

          <InsightPanel eyebrow="Budget load" title="Spend by channel" soft>
            {spendByChannelData.length ? (
              <BarChart data={spendByChannelData} height={230} valueFormatter={formatCompactCurrency} />
            ) : (
              <div style={insightTokens.mutedText}>Channel spend bars will appear here once campaign spend data is available.</div>
            )}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Executive readout" title="What this dashboard is saying" soft>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <InsightMiniStat label="Strongest month" value={strongestMonth?.period || strongestMonth?.month || '—'} />
                <InsightMiniStat label="Highest spend channel" value={highestSpendChannel?.channel || '—'} />
              </div>
              <InsightNoteCard title="Filter impact" body={`The ${MODEL_OPTIONS.find((item) => item.value === model)?.label || model} model is a live dashboard input, so it is not a cosmetic selector.`} />
              <InsightNoteCard title="Commercial signal" body={bestChannel ? `${bestChannel.channel} is currently the strongest efficiency signal, while ${highestSpendChannel?.channel || 'the leading spend channel'} carries the heaviest budget load and should be checked first if return softens.` : 'Revenue evidence is still too thin to isolate a strong commercial leader.'} />
              <InsightNoteCard title="Attribution confidence" body={attributionCoverage >= 70 ? 'Coverage is strong enough for directional budget decisions, though journey evidence should still support major allocation changes.' : 'Coverage is still incomplete, so treat ROI and budget interpretations as provisional until more journey evidence is available.'} />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Channel performance" title="Unified channel table">
            {channelPerformanceRows.length ? (
              <div style={insightTokens.tableWrap}>
                <table style={insightTokens.table}>
                  <thead>
                    <tr>
                      <th style={insightTokens.th}>Channel</th>
                      <th style={insightTokens.th}>Attributed Revenue</th>
                      <th style={insightTokens.th}>Spend</th>
                      <th style={insightTokens.th}>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerformanceRows.map((row) => (
                      <tr key={row.channel} style={insightTokens.row}>
                        <td style={insightTokens.tdStrong}>{row.channel}</td>
                        <td style={insightTokens.td}>{formatCurrency(row.attributedRevenue)}</td>
                        <td style={insightTokens.td}>{formatCurrency(row.spend)}</td>
                        <td style={insightTokens.td}>{Math.round(row.roi)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={insightTokens.mutedText}>Channel totals will appear here once attributed channel data is available.</div>
            )}
          </InsightPanel>
        </section>

        <section style={{ ...insightTokens.twoCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Campaign leaders" title="Highest ROI campaigns">
            <div style={{ display: 'grid', gap: 10 }}>
              {topCampaigns.length ? topCampaigns.map((item, index) => (
                <div key={`${item.name || 'campaign'}-${index}`} style={{ display: 'grid', gap: 6, borderBottom: '1px solid rgba(15,66,88,0.08)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ color: '#0B2540' }}>{item.name || 'Unnamed campaign'}</strong>
                    <span style={{ color: '#0F766E', fontWeight: 800 }}>{Math.round(Number(item.roi || 0))}%</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#415274' }}>{formatCurrency(Number(item.attributedRevenue ?? item.revenue ?? 0))} attributed revenue on {formatCurrency(Number(item.spend || 0))} spend.</div>
                </div>
              )) : <div style={insightTokens.mutedText}>No top campaign signal is visible yet.</div>}
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Campaign risk" title="Lowest ROI campaigns" soft>
            <div style={{ display: 'grid', gap: 10 }}>
              {bottomCampaigns.length ? bottomCampaigns.map((item, index) => (
                <div key={`${item.name || 'campaign-risk'}-${index}`} style={{ display: 'grid', gap: 6, borderBottom: '1px solid rgba(15,66,88,0.08)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ color: '#0B2540' }}>{item.name || 'Unnamed campaign'}</strong>
                    <span style={{ color: '#B7791F', fontWeight: 800 }}>{Math.round(Number(item.roi || 0))}%</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#415274' }}>{formatCurrency(Number(item.attributedRevenue ?? item.revenue ?? 0))} attributed revenue on {formatCurrency(Number(item.spend || 0))} spend.</div>
                </div>
              )) : <div style={insightTokens.mutedText}>No weak campaign signal is visible yet.</div>}
            </div>
          </InsightPanel>
        </section>
      </main>
    </Layout>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0)
}
