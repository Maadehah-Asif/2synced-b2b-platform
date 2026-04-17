import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { InsightHero, InsightKpiCard, InsightKpiGrid, InsightNoteCard, InsightPanel } from '../../components/InsightChrome'
import { insightTokens } from '../../components/insightChromeTokens'
import { useWorkspaceId } from '../../utils/workspace'
import { fetchFromApi, parseApiJson } from '../../utils/api'
import './module6.css'
import PieChart from './PieChart'
import TimelineChart from './TimelineChart'

type RevenueByChannelRow = { channel: string; revenue?: number; attributedRevenue?: number; roi?: number; spend?: number }
type RevenueOverTimeRow = { month?: string; period?: string; total?: number; revenue?: number }
type CampaignSignal = { id?: string; campaign_id?: string; name?: string; attributedRevenue?: number; revenue?: number }
type Module6OverviewStats = {
  revenueByChannel?: RevenueByChannelRow[]
  revenueOverTime?: RevenueOverTimeRow[]
  totalRevenue?: number
  attributedRevenue?: number
  totalSpend?: number
  campaignCount?: number
  topCampaigns?: CampaignSignal[]
  bottomCampaigns?: CampaignSignal[]
  message?: string
}

const CHANNEL_OPTIONS = ['email', 'ads', 'linkedin', 'webinar', 'other']
const MODEL_OPTIONS = ['first-touch', 'last-touch', 'linear']
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Module6OverviewPage() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true })
  const [channels, setChannels] = useState<string[]>(['email', 'ads', 'linkedin', 'webinar'])
  const [model, setModel] = useState<string>('linear')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Module6OverviewStats | null>(null)

  useEffect(() => {
    async function load() {
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
        if (channels.length) params.set('channels', channels.join(','))
        if (model) params.set('model', model)
        const res = await fetchFromApi(`${API_BASE}/m06/stats?${params.toString()}`, undefined, API_BASE)
        const json = await parseApiJson<Module6OverviewStats>(res, 'Could not load Revenue Insight overview')
        setStats(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load Revenue Insight overview')
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId, channels, model])

  const revenueByChannel = useMemo(() => (stats?.revenueByChannel || []).filter((row) => channels.includes(String(row.channel).toLowerCase())), [stats, channels])
  const timelineData = useMemo(() => (stats?.revenueOverTime || []).map((point) => ({ month: point.month || point.period || 'Unknown', total: Number(point.total ?? point.revenue ?? 0) })), [stats])
  const donutData = revenueByChannel.map((row) => ({ label: row.channel, value: Number(row.attributedRevenue ?? row.revenue ?? 0) }))
  const totalRevenue = Number(stats?.totalRevenue || 0)
  const attributedRevenue = Number(stats?.attributedRevenue || 0)
  const totalSpend = Number(stats?.totalSpend || 0)
  const campaignCount = Number(stats?.campaignCount || 0)
  const unattributedRevenue = Math.max(0, totalRevenue - attributedRevenue)
  const attributionCoverage = totalRevenue > 0 ? Math.round((attributedRevenue / totalRevenue) * 100) : 0
  const bestChannel = [...revenueByChannel].sort((a, b) => Number(b.roi || 0) - Number(a.roi || 0))[0] || null
  const highestSpendChannel = [...revenueByChannel].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0] || null
  const topCampaigns = (stats?.topCampaigns || []).slice(0, 5)
  const bottomCampaigns = (stats?.bottomCampaigns || []).slice(0, 5)

  return (
    <Layout>
      <main className="page-root m06-page" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
        </div>

        <InsightHero eyebrow="Revenue Insight Overview" title="Commercial Performance Overview" subtitle="Read revenue movement, attribution coverage, and channel contribution in one calmer management view before moving into ROI, forecast, allocation, or journey analysis." />

        <InsightPanel eyebrow="Filters" title="Control the reporting scope" soft rightMeta={<div style={{ fontSize: 13, color: '#5B6C8B' }}>{loading ? 'Refreshing data…' : 'Refreshes automatically when filters change'}</div>}>
          <div className="m06-filter-grid">
            <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Attribution model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {MODEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Channels</span>
              <select multiple value={channels} onChange={(e) => setChannels(Array.from(e.target.selectedOptions).map((option) => option.value))} style={{ minHeight: 104 }}>
                {CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
          {!error && stats?.message ? <div style={{ marginTop: 12, color: '#6a4b00' }}>{stats.message}</div> : null}
        </InsightPanel>

        <InsightKpiGrid>
          <InsightKpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} note="All revenue currently visible in the selected commercial window." tone="navy" />
          <InsightKpiCard label="Attributed Revenue" value={formatCurrency(attributedRevenue)} note={`${attributionCoverage}% of visible revenue is currently attributed.`} tone="teal" />
          <InsightKpiCard label="Unattributed Revenue" value={formatCurrency(unattributedRevenue)} note="Revenue still lacking enough touch evidence for allocation." tone="amber" />
          <InsightKpiCard label="Campaigns and Spend" value={`${campaignCount} campaigns`} note={`Current spend in scope: ${formatCurrency(totalSpend)}.`} tone="slate" />
        </InsightKpiGrid>

        <section style={{ ...insightTokens.equalCol, marginTop: 18 }}>
          <InsightPanel eyebrow="Revenue flow" title="Revenue timeline">
            <div style={{ height: 260 }}>
              <TimelineChart data={timelineData} />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Channel mix" title="Attributed revenue by channel" soft>
            {donutData.length > 0 ? (
              <div style={{ display: 'grid', placeItems: 'center', gap: 16 }}>
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
          <InsightPanel eyebrow="Commercial readout" title="What the current picture is saying">
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightNoteCard title="Best-returning channel" body={bestChannel ? `${bestChannel.channel} is currently leading on ROI and is the best candidate for selective budget expansion.` : 'No clear leading channel is visible yet because return data is still limited.'} />
              <InsightNoteCard title="Spend concentration" body={highestSpendChannel ? `${highestSpendChannel.channel} is carrying the highest spend load, so it should be checked first when efficiency starts to soften.` : 'No spend concentration signal is visible yet.'} />
              <InsightNoteCard title="Attribution confidence" body={attributionCoverage >= 70 ? 'Attribution coverage is strong enough for commercial interpretation, though journey evidence should still be reviewed before major decisions.' : 'Attribution coverage is still incomplete, so budget and ROI decisions should be taken with caution until more journey evidence is available.'} />
            </div>
          </InsightPanel>

          <InsightPanel eyebrow="Campaign ranking" title="Top and bottom campaign signals" soft>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>Top campaigns</div>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  {topCampaigns.length ? topCampaigns.map((item) => <div key={item.id || item.name || item.campaign_id} style={{ fontSize: 13, color: '#415274' }}><strong style={{ color: '#0B2540' }}>{item.name || item.campaign_id}</strong> • {formatCurrency(item.attributedRevenue || item.revenue || 0)}</div>) : <div style={insightTokens.mutedText}>No top campaigns are visible yet.</div>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>Bottom campaigns</div>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  {bottomCampaigns.length ? bottomCampaigns.map((item) => <div key={item.id || item.name || item.campaign_id} style={{ fontSize: 13, color: '#415274' }}><strong style={{ color: '#0B2540' }}>{item.name || item.campaign_id}</strong> • {formatCurrency(item.attributedRevenue || item.revenue || 0)}</div>) : <div style={insightTokens.mutedText}>No underperforming campaigns are visible yet.</div>}
                </div>
              </div>
            </div>
          </InsightPanel>
        </section>
      </main>
    </Layout>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)
}
