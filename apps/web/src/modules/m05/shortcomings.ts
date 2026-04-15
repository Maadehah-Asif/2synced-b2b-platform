import { buildPipelineMetrics } from './pipeline'
import type { DashboardData } from './overview'
import type { Module5AnalyticsResponse } from './webEngagement'

export type ShortcomingSeverity = 'Low' | 'Medium' | 'High'

export type ShortcomingGroup =
  | 'Pipeline bottlenecks'
  | 'Engagement weaknesses'
  | 'Campaign/source inefficiencies'

export type ShortcomingIssue = {
  id: string
  group: ShortcomingGroup
  type: string
  title: string
  severity: ShortcomingSeverity
  score: number
  explanation: string
  metric: string
  recommendation: string
  affectedCount: number
}

export type ShortcomingSummaryCard = {
  label: string
  value: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
  note: string
}

export type IssueBoardItem = {
  title: string
  severity: ShortcomingSeverity
  metric: string
  explanation: string
  recommendation: string
  group: ShortcomingGroup
}

export type ShortcomingVisualRow = {
  label: string
  value: number
  share: number
}

export type ShortcomingActionRow = {
  area: ShortcomingGroup
  type: string
  severity: ShortcomingSeverity
  affectedCount: number
  recommendation: string
}

export type ShortcomingAnalysis = {
  features: {
    pipeline: {
      totalStageRows: number
      earlyShare: number
      downstreamShare: number
      recentEntries30d: number
      stagnantStageRows: number
      highIntentQuietCount: number
    }
    engagement: {
      datasetName: string | null
      totalEvents: number
      highIntentEvents: number
      conversionRate: number
      averageEngagementScore: number | null
      topSourceLabel: string | null
      topSourceShare: number
      topCampaignLabel: string | null
      topCampaignShare: number
      topPageCategoryLabel: string | null
      topPageCategoryShare: number
      pricingShare: number
      contentShare: number
    }
  }
  issues: ShortcomingIssue[]
  summaryCards: ShortcomingSummaryCard[]
  issueBoard: IssueBoardItem[]
  issueTypeDistribution: ShortcomingVisualRow[]
  severityDistribution: ShortcomingVisualRow[]
  actionRows: ShortcomingActionRow[]
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function severityFromScore(score: number): ShortcomingSeverity {
  if (score >= 80) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function shareOf(total: number, count: number) {
  if (total <= 0) return 0
  return (count / total) * 100
}

function findDistributionShare(items: Array<{ label: string; share: number }>, keyword: string) {
  const match = items.find((item) => item.label.toLowerCase().includes(keyword))
  return match ? match.share : 0
}

function createIssue(input: Omit<ShortcomingIssue, 'severity'> & { score: number }): ShortcomingIssue {
  return {
    ...input,
    severity: severityFromScore(input.score),
  }
}

function distribute<T extends { label: string; value: number }>(items: T[]): ShortcomingVisualRow[] {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1
  return items
    .filter((item) => item.value > 0)
    .map((item) => ({
      label: item.label,
      value: item.value,
      share: (item.value / total) * 100,
    }))
}

export function analyzeShortcomings(data: DashboardData, webAnalytics: Module5AnalyticsResponse | null): ShortcomingAnalysis {
  const pipeline = buildPipelineMetrics(data)
  const topSource = webAnalytics?.sourceDistribution[0] || null
  const topCampaign = webAnalytics?.campaignPerformance[0] || null

  const features = {
    pipeline: {
      totalStageRows: pipeline.summary.totalStageRows,
      earlyShare: round(pipeline.summary.earlyShare, 1),
      downstreamShare: round(pipeline.summary.downstreamShare, 1),
      recentEntries30d: pipeline.summary.recentEntries30d,
      stagnantStageRows: pipeline.summary.stagnantStageRows,
      highIntentQuietCount: pipeline.summary.highIntentQuietCount,
    },
    engagement: {
      datasetName: webAnalytics?.dataset.name || null,
      totalEvents: webAnalytics?.kpis.totalEvents || 0,
      highIntentEvents: webAnalytics?.kpis.highIntentEvents || 0,
      conversionRate: webAnalytics?.kpis.conversionRate || 0,
      averageEngagementScore: webAnalytics?.kpis.averageEngagementScore ?? null,
      topSourceLabel: topSource?.label || null,
      topSourceShare: round(topSource?.share || 0, 1),
      topCampaignLabel: topCampaign?.label || null,
      topCampaignShare: round(topCampaign?.share || 0, 1),
      topPageCategoryLabel: webAnalytics?.pageCategoryEngagement[0]?.label || null,
      topPageCategoryShare: round(webAnalytics?.pageCategoryEngagement[0]?.share || 0, 1),
      pricingShare: round(findDistributionShare(webAnalytics?.pageCategoryEngagement || [], 'pricing'), 1),
      contentShare: round(findDistributionShare(webAnalytics?.pageCategoryEngagement || [], 'content'), 1),
    },
  }

  const issues: ShortcomingIssue[] = []

  if (features.pipeline.totalStageRows > 0 && features.pipeline.earlyShare >= 52) {
    const score = Math.min(100, 45 + (features.pipeline.earlyShare - 52) * 1.8 + features.pipeline.stagnantStageRows * 3)
    issues.push(createIssue({
      id: 'pipeline-early-bottleneck',
      group: 'Pipeline bottlenecks',
      type: 'Early-stage bottleneck',
      title: 'Too much of the funnel is still concentrated up top',
      score,
      explanation: 'Visible stage activity is weighted toward early stages, which suggests that interest is arriving faster than it is progressing.',
      metric: `${round(features.pipeline.earlyShare)}% early-stage concentration`,
      recommendation: 'Review qualification and handoff criteria for the earliest pipeline steps.',
      affectedCount: Math.round((features.pipeline.totalStageRows * features.pipeline.earlyShare) / 100),
    }))
  }

  if (features.pipeline.totalStageRows > 0 && features.pipeline.downstreamShare <= 22) {
    const score = Math.min(100, 48 + (22 - features.pipeline.downstreamShare) * 2.2)
    issues.push(createIssue({
      id: 'pipeline-downstream-weakness',
      group: 'Pipeline bottlenecks',
      type: 'Weak downstream presence',
      title: 'Later-stage momentum is still light',
      score,
      explanation: 'The visible funnel has limited downstream representation, so progress appears shallow relative to top-of-funnel activity.',
      metric: `${round(features.pipeline.downstreamShare)}% downstream presence`,
      recommendation: 'Focus manager review on what is blocking demo, proposal, or close-stage movement.',
      affectedCount: Math.max(0, Math.round((features.pipeline.totalStageRows * (100 - features.pipeline.downstreamShare)) / 100)),
    }))
  }

  if (features.pipeline.totalStageRows > 0 && features.pipeline.recentEntries30d <= Math.max(2, Math.floor(features.pipeline.totalStageRows * 0.12))) {
    const score = Math.min(100, 52 + Math.max(0, 8 - features.pipeline.recentEntries30d) * 4)
    issues.push(createIssue({
      id: 'pipeline-limited-progression',
      group: 'Pipeline bottlenecks',
      type: 'Limited recent progression',
      title: 'Fresh pipeline movement looks lighter than expected',
      score,
      explanation: 'Recent new entries into the visible funnel are modest for the current volume, which can signal slow movement or weak progression.',
      metric: `${features.pipeline.recentEntries30d} recent entries in 30 days`,
      recommendation: 'Check whether current campaigns and SDR follow-up are converting into real stage entries.',
      affectedCount: Math.max(1, features.pipeline.totalStageRows - features.pipeline.recentEntries30d),
    }))
  }

  if (features.pipeline.stagnantStageRows >= 3) {
    const score = Math.min(100, 50 + features.pipeline.stagnantStageRows * 6)
    issues.push(createIssue({
      id: 'pipeline-stagnation',
      group: 'Pipeline bottlenecks',
      type: 'Possible stage stagnation',
      title: 'Several active stage rows appear to be sitting too long',
      score,
      explanation: 'Open stage rows have been in place long enough to suggest follow-through is slowing down somewhere in the funnel.',
      metric: `${features.pipeline.stagnantStageRows} stagnant active rows`,
      recommendation: 'Review ownership and next-step discipline on older active stage records.',
      affectedCount: features.pipeline.stagnantStageRows,
    }))
  }

  if (features.engagement.totalEvents > 0 && features.engagement.pricingShare >= 12 && features.engagement.conversionRate < 5) {
    const score = Math.min(100, 55 + features.engagement.pricingShare * 1.2 + (5 - features.engagement.conversionRate) * 5)
    issues.push(createIssue({
      id: 'engagement-pricing-conversion-gap',
      group: 'Engagement weaknesses',
      type: 'Pricing interest without conversion',
      title: 'Visitors are reaching pricing-style pages without enough follow-through',
      score,
      explanation: 'Higher-intent page activity is visible, but the conversion rate is still too light for that level of purchase-oriented interest.',
      metric: `${round(features.engagement.pricingShare)}% pricing activity | ${round(features.engagement.conversionRate, 1)}% conversion`,
      recommendation: 'Review pricing page clarity and the visibility of next-step offers.',
      affectedCount: Math.round((features.engagement.totalEvents * features.engagement.pricingShare) / 100),
    }))
  }

  if (features.engagement.totalEvents > 0 && features.engagement.contentShare >= 28 && features.engagement.conversionRate < 4) {
    const score = Math.min(100, 52 + (features.engagement.contentShare - 28) * 1.4 + (4 - features.engagement.conversionRate) * 5)
    issues.push(createIssue({
      id: 'engagement-content-dropoff',
      group: 'Engagement weaknesses',
      type: 'Content-heavy low progression',
      title: 'Content activity is strong, but deeper action is weak',
      score,
      explanation: 'The dataset shows meaningful content or blog engagement, but too little of that interest is turning into stronger action.',
      metric: `${round(features.engagement.contentShare)}% content activity | ${round(features.engagement.conversionRate, 1)}% conversion`,
      recommendation: 'Strengthen calls-to-action and handoff paths from content into higher-intent pages.',
      affectedCount: Math.round((features.engagement.totalEvents * features.engagement.contentShare) / 100),
    }))
  }

  if (features.engagement.highIntentEvents >= 8 && features.engagement.conversionRate < 3.5) {
    const score = Math.min(100, 58 + shareOf(features.engagement.totalEvents, features.engagement.highIntentEvents) * 0.8)
    issues.push(createIssue({
      id: 'engagement-quiet-high-intent',
      group: 'Engagement weaknesses',
      type: 'Quiet high-interest behavior',
      title: 'High-interest activity exists, but action still looks quiet',
      score,
      explanation: 'There is enough high-intent behavior to suggest buying interest, yet conversion-style follow-through is still muted.',
      metric: `${features.engagement.highIntentEvents} high-intent events | ${round(features.engagement.conversionRate, 1)}% conversion`,
      recommendation: 'Tighten follow-up between web behavior and sales outreach on hot accounts.',
      affectedCount: features.engagement.highIntentEvents,
    }))
  }

  if (features.engagement.totalEvents > 0 && features.engagement.topCampaignShare >= 26 && features.engagement.conversionRate < 5) {
    const score = Math.min(100, 50 + (features.engagement.topCampaignShare - 26) * 1.6 + (5 - features.engagement.conversionRate) * 4)
    issues.push(createIssue({
      id: 'campaign-volume-weak-conversion',
      group: 'Campaign/source inefficiencies',
      type: 'Underperforming campaign',
      title: 'A leading campaign is driving activity without enough outcome',
      score,
      explanation: 'One campaign is contributing meaningful volume, but the broader conversion picture still looks weak.',
      metric: `${features.engagement.topCampaignLabel || 'Top campaign'} at ${round(features.engagement.topCampaignShare)}% share`,
      recommendation: 'Review campaign targeting, landing page alignment, and follow-up for the strongest-volume campaign.',
      affectedCount: Math.round((features.engagement.totalEvents * features.engagement.topCampaignShare) / 100),
    }))
  }

  if (features.engagement.totalEvents > 0 && features.engagement.topSourceShare >= 36 && shareOf(features.engagement.totalEvents, features.engagement.highIntentEvents) < 18) {
    const score = Math.min(100, 50 + (features.engagement.topSourceShare - 36) * 1.8)
    issues.push(createIssue({
      id: 'source-quality-risk',
      group: 'Campaign/source inefficiencies',
      type: 'Source quality risk',
      title: 'A major source is driving traffic that looks too shallow',
      score,
      explanation: 'The leading traffic source is contributing a large share of volume, but that volume is not converting into enough high-intent behavior.',
      metric: `${features.engagement.topSourceLabel || 'Top source'} at ${round(features.engagement.topSourceShare)}% share`,
      recommendation: 'Audit source quality and the fit between incoming traffic and the page experience.',
      affectedCount: Math.round((features.engagement.totalEvents * features.engagement.topSourceShare) / 100),
    }))
  }

  if (features.engagement.totalEvents > 0 && features.engagement.topSourceShare >= 56) {
    const score = Math.min(100, 55 + (features.engagement.topSourceShare - 56) * 2)
    issues.push(createIssue({
      id: 'source-overdependence',
      group: 'Campaign/source inefficiencies',
      type: 'Source concentration risk',
      title: 'Website activity is overly dependent on one source',
      score,
      explanation: 'The traffic mix is concentrated enough around one source that channel concentration itself has become a process risk.',
      metric: `${features.engagement.topSourceLabel || 'Top source'} at ${round(features.engagement.topSourceShare)}% share`,
      recommendation: 'Broaden channel mix so demand quality is less exposed to one source.',
      affectedCount: Math.round((features.engagement.totalEvents * features.engagement.topSourceShare) / 100),
    }))
  }

  const sortedIssues = issues.sort((a, b) => b.score - a.score)

  const summaryCards: ShortcomingSummaryCard[] = [
    {
      label: 'Active issues',
      value: String(sortedIssues.length),
      tone: sortedIssues.length > 0 ? 'amber' : 'teal',
      note: sortedIssues.length > 0 ? 'Current rule-based process weaknesses detected' : 'No meaningful issues were triggered by the current rules',
    },
    {
      label: 'High severity',
      value: String(sortedIssues.filter((issue) => issue.severity === 'High').length),
      tone: sortedIssues.some((issue) => issue.severity === 'High') ? 'amber' : 'teal',
      note: 'Issues most likely to deserve immediate manager review',
    },
    {
      label: 'Pipeline risks',
      value: String(sortedIssues.filter((issue) => issue.group === 'Pipeline bottlenecks').length),
      tone: 'navy',
      note: 'Funnel-shape, progression, and stagnation watchouts',
    },
    {
      label: 'Engagement risks',
      value: String(sortedIssues.filter((issue) => issue.group !== 'Pipeline bottlenecks').length),
      tone: 'slate',
      note: 'Traffic, campaign, and conversion-quality watchouts',
    },
    {
      label: 'Quiet hot signals',
      value: String(features.pipeline.highIntentQuietCount),
      tone: features.pipeline.highIntentQuietCount > 0 ? 'amber' : 'teal',
      note: 'High-intent leads that still look too quiet',
    },
    {
      label: 'Dataset coverage',
      value: features.engagement.datasetName ? 'Live' : 'Pipeline only',
      tone: features.engagement.datasetName ? 'teal' : 'slate',
      note: features.engagement.datasetName ? `Using ${features.engagement.datasetName}` : 'No active web engagement dataset selected',
    },
  ]

  const issueBoard: IssueBoardItem[] = sortedIssues.slice(0, 6).map((issue) => ({
    title: issue.title,
    severity: issue.severity,
    metric: issue.metric,
    explanation: issue.explanation,
    recommendation: issue.recommendation,
    group: issue.group,
  }))

  const issueTypeDistribution = distribute(
    ['Pipeline bottlenecks', 'Engagement weaknesses', 'Campaign/source inefficiencies'].map((label) => ({
      label,
      value: sortedIssues.filter((issue) => issue.group === label).length,
    })),
  )

  const severityDistribution = distribute(
    ['High', 'Medium', 'Low'].map((label) => ({
      label,
      value: sortedIssues.filter((issue) => issue.severity === label).length,
    })),
  )

  const actionRows: ShortcomingActionRow[] = sortedIssues.slice(0, 8).map((issue) => ({
    area: issue.group,
    type: issue.type,
    severity: issue.severity,
    affectedCount: issue.affectedCount,
    recommendation: issue.recommendation,
  }))

  return {
    features,
    issues: sortedIssues,
    summaryCards,
    issueBoard,
    issueTypeDistribution,
    severityDistribution,
    actionRows,
  }
}
