/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Frontend
 * File: overview.ts
 * Purpose: Supports the o ve rv ie w flow for this module.
 * Notes: Documentation header added for maintainability.
 */

export type PrioritizationRow = {
  leadId: string
  fullName?: string
  company?: string
  intentScore?: number
  intentSegment?: string
  daysSinceLastAction?: number | null
  eventsLast30d?: number
  lastEventDate?: string | null
  lastEventType?: string | null
  spikeCount?: number
  dropCount?: number
}

export type Module6Lead = {
  _id: string
  lead_id: string
  company?: string | null
  source?: string | null
  owner?: string | null
  lead_score?: number | null
  intent_score?: number | null
  segment?: string | null
  is_archived?: boolean
}

export type StageRecord = {
  _id: string
  lead_id: string
  stage_name: string
  entered_at: string
  exited_at?: string | null
  stage_status?: 'active' | 'completed' | 'dropped'
  next_stage?: string | null
  exit_reason?: string | null
  is_archived?: boolean
}

export type DashboardData = {
  prioritizedRows: PrioritizationRow[]
  prioritizedTotal: number
  module6Leads: Module6Lead[]
  stageRecords: StageRecord[]
}

export type SummaryCard = {
  label: string
  value: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
  note: string
}

export type PipelineStagePreview = {
  name: string
  count: number
  share: number
  isEarly: boolean
  isLate: boolean
}

export type Watchout = {
  title: string
  body: string
  stat: string
  tone: 'amber' | 'blue' | 'teal'
}

export type AlignmentCard = {
  label: string
  value: string
  helper: string
  share?: number
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type AttentionRow = {
  label: string
  company: string
  intentLabel: string
  inactivity: string
  activity: string
  action: string
}

export type OverviewMetrics = {
  summaryCards: SummaryCard[]
  pipelineStages: PipelineStagePreview[]
  watchouts: Watchout[]
  alignmentCards: AlignmentCard[]
  attentionRows: AttentionRow[]
  story: {
    title: string
    body: string
  }
  movement: {
    activeStageRows: number
    completedStageRows: number
    droppedStageRows: number
    recentEntries30d: number
    downstreamRows: number
    earlyStageRows: number
    coveragePct: number
    stalePct: number
  }
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function niceStageName(stage: string) {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isEarlyStage(stage: string) {
  const name = String(stage || '').toLowerCase()
  return name.includes('new')
    || name.includes('lead')
    || name.includes('qualified')
    || name.includes('contact')
    || name.includes('prospect')
    || name.includes('discovery')
}

function isLateStage(stage: string) {
  const name = String(stage || '').toLowerCase()
  return name.includes('demo')
    || name.includes('proposal')
    || name.includes('negotiat')
    || name.includes('opportun')
    || name.includes('close')
    || name.includes('won')
    || name.includes('sale')
}

function intentBucket(row: PrioritizationRow) {
  const segment = String(row.intentSegment || '').toUpperCase()
  if (segment) return segment
  const score = row.intentScore || 0
  if (score >= 80) return 'HOT'
  if (score >= 60) return 'WARM'
  if (score >= 40) return 'MILD'
  return 'COLD'
}

function formatCountShare(count: number, total: number) {
  return total > 0 ? `${count} • ${formatPercent((count / total) * 100)}` : String(count)
}

export function buildOverviewMetrics(data: DashboardData): OverviewMetrics {
  const now = new Date()

  const activeLeads = data.module6Leads.filter((lead) => !lead.is_archived)
  const leadIdsWithPipeline = new Set(data.stageRecords.map((stage) => stage.lead_id))
  const activePipelineLeads = activeLeads.filter((lead) => leadIdsWithPipeline.has(lead.lead_id))

  const hotRows = data.prioritizedRows.filter((row) => ['HOT', 'BLAZING'].includes(String(row.intentSegment || '').toUpperCase()))
  const warmOrBetterRows = data.prioritizedRows.filter((row) => ['WARM', 'HOT', 'BLAZING'].includes(String(row.intentSegment || '').toUpperCase()))

  const staleRows = data.prioritizedRows.filter((row) => {
    if (typeof row.daysSinceLastAction === 'number') return row.daysSinceLastAction >= 30
    if (row.lastEventDate) return daysBetween(new Date(row.lastEventDate), now) >= 30
    return true
  })

  const activeRows = data.prioritizedRows.filter((row) => (row.eventsLast30d || 0) > 0)
  const highIntentRows = data.prioritizedRows.filter((row) => ['HOT', 'BLAZING'].includes(intentBucket(row)))

  const stageCounts = new Map<string, number>()
  let activeStageRows = 0
  let completedStageRows = 0
  let droppedStageRows = 0
  let recentEntries30d = 0
  let downstreamRows = 0
  let earlyStageRows = 0

  for (const record of data.stageRecords) {
    const key = record.stage_name || 'Unspecified'
    stageCounts.set(key, (stageCounts.get(key) || 0) + 1)

    if (record.stage_status === 'completed') completedStageRows += 1
    else if (record.stage_status === 'dropped') droppedStageRows += 1
    else activeStageRows += 1

    const enteredAt = new Date(record.entered_at)
    if (!Number.isNaN(enteredAt.getTime()) && daysBetween(enteredAt, now) <= 30) {
      recentEntries30d += 1
    }

    if (isEarlyStage(record.stage_name)) earlyStageRows += 1
    if (isLateStage(record.stage_name)) downstreamRows += 1
  }

  const totalStageRows = data.stageRecords.length
  const pipelineStages = Array.from(stageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name: niceStageName(name),
      count,
      share: totalStageRows > 0 ? (count / totalStageRows) * 100 : 0,
      isEarly: isEarlyStage(name),
      isLate: isLateStage(name),
    }))

  const summaryCards: SummaryCard[] = [
    {
      label: 'Leads in view',
      value: String(activeLeads.length),
      tone: 'navy',
      note: activeLeads.length > 0
        ? `${activePipelineLeads.length} already appear in funnel tracking`
        : 'No active lead records found yet',
    },
    {
      label: 'High-intent demand',
      value: String(highIntentRows.length),
      tone: 'teal',
      note: highIntentRows.length > 0
        ? `${formatPercent((highIntentRows.length / Math.max(1, data.prioritizedRows.length)) * 100)} of prioritized leads look sales-ready`
        : 'No hot intent signals are available yet',
    },
    {
      label: 'Pipeline presence',
      value: String(activePipelineLeads.length),
      tone: activePipelineLeads.length > 0 ? 'slate' : 'amber',
      note: activeLeads.length > 0
        ? `${formatPercent((activePipelineLeads.length / Math.max(1, activeLeads.length)) * 100)} of active leads are represented in stages`
        : 'Need active leads before pipeline coverage can be measured',
    },
    {
      label: 'Downstream movement',
      value: String(downstreamRows || completedStageRows),
      tone: 'slate',
      note: totalStageRows > 0
        ? `${recentEntries30d} stage entries landed in the last 30 days`
        : 'No stage history is available yet',
    },
    {
      label: 'Attention needed',
      value: String(staleRows.length),
      tone: staleRows.length > 0 ? 'amber' : 'teal',
      note: activeRows.length > 0
        ? `${activeRows.length} prioritized leads still show recent activity`
        : 'Recent activity has not shown up in the prioritization feed yet',
    },
  ]

  const coveragePct = activeLeads.length > 0 ? (activePipelineLeads.length / activeLeads.length) * 100 : 0
  const stalePct = data.prioritizedRows.length > 0 ? (staleRows.length / data.prioritizedRows.length) * 100 : 0
  const completionPct = totalStageRows > 0 ? (completedStageRows / totalStageRows) * 100 : 0
  const alignmentCards: AlignmentCard[] = [
    {
      label: 'Marketing interest',
      value: formatCountShare(data.prioritizedRows.length, Math.max(1, data.prioritizedRows.length)),
      helper: highIntentRows.length > 0
        ? `${highIntentRows.length} leads are already hot enough to deserve fast follow-up`
        : 'Prioritization signals are still light',
      share: 100,
      tone: 'navy',
    },
    {
      label: 'Sales-ready pool',
      value: formatCountShare(warmOrBetterRows.length, data.prioritizedRows.length),
      helper: warmOrBetterRows.length > 0
        ? 'Warm, hot, and blazing leads form the current handoff-ready pool'
        : 'No warm-or-better leads visible yet',
      share: data.prioritizedRows.length > 0 ? (warmOrBetterRows.length / data.prioritizedRows.length) * 100 : 0,
      tone: 'teal',
    },
    {
      label: 'Worked into pipeline',
      value: formatCountShare(activePipelineLeads.length, activeLeads.length),
      helper: activePipelineLeads.length > 0
        ? 'These leads already have stage visibility for sales-side progression'
        : 'Pipeline tracking has not caught up with the visible lead base yet',
      share: activeLeads.length > 0 ? (activePipelineLeads.length / activeLeads.length) * 100 : 0,
      tone: 'slate',
    },
    {
      label: 'Needs review',
      value: formatCountShare(staleRows.length, data.prioritizedRows.length),
      helper: staleRows.length > 0
        ? 'Quiet prioritized leads are the clearest risk to alignment follow-through'
        : 'The visible prioritized pool is not dominated by stale records',
      share: data.prioritizedRows.length > 0 ? (staleRows.length / data.prioritizedRows.length) * 100 : 0,
      tone: 'amber',
    },
  ]

  const watchouts: Watchout[] = []

  if (earlyStageRows > 0 && totalStageRows > 0) {
    const earlyShare = (earlyStageRows / totalStageRows) * 100
    if (earlyShare >= 55) {
      watchouts.push({
        title: 'Early-stage concentration',
        stat: formatPercent(earlyShare),
        body: 'Most visible funnel activity is still sitting in early steps.',
        tone: 'amber',
      })
    }
  }

  if (staleRows.length > 0 && data.prioritizedRows.length > 0 && stalePct >= 35) {
    watchouts.push({
      title: 'Quiet prioritized leads',
      stat: String(staleRows.length),
      body: 'High-interest records are present, but too many look inactive or overdue for follow-up.',
      tone: 'blue',
    })
  }

  if (totalStageRows > 0 && downstreamRows <= Math.max(1, Math.floor(totalStageRows * 0.2))) {
    watchouts.push({
      title: 'Weak downstream movement',
      stat: String(downstreamRows),
      body: 'Later-stage progression exists, but it is still light compared with the overall funnel shape.',
      tone: 'teal',
    })
  }

  if (watchouts.length === 0) {
    watchouts.push({
      title: 'Balanced first read',
      stat: 'Stable',
      body: 'No single issue dominates the visible picture right now.',
      tone: 'teal',
    })
  }

  const attentionRows: AttentionRow[] = [...data.prioritizedRows]
    .sort((a, b) => {
      const aIntent = a.intentScore || 0
      const bIntent = b.intentScore || 0
      const aStale = typeof a.daysSinceLastAction === 'number' ? a.daysSinceLastAction : 999
      const bStale = typeof b.daysSinceLastAction === 'number' ? b.daysSinceLastAction : 999
      return (bIntent - aIntent) || (bStale - aStale)
    })
    .filter((row) => ['WARM', 'HOT', 'BLAZING'].includes(intentBucket(row)) || (row.daysSinceLastAction || 0) >= 21)
    .slice(0, 5)
    .map((row) => ({
      label: row.fullName || 'Unnamed lead',
      company: row.company || 'Unassigned company',
      intentLabel: intentBucket(row),
      inactivity: typeof row.daysSinceLastAction === 'number'
        ? `${row.daysSinceLastAction}d since action`
        : row.lastEventDate
          ? `${daysBetween(new Date(row.lastEventDate), now)}d since event`
          : 'No recent action',
      activity: `${row.eventsLast30d || 0} events / 30d`,
      action: (row.daysSinceLastAction || 999) >= 30
        ? 'Re-engage now'
        : ['HOT', 'BLAZING'].includes(intentBucket(row))
          ? 'Fast follow-up'
          : 'Monitor closely',
    }))

  let storyTitle = 'A light but usable alignment picture is already available.'
  let storyBody = 'Lead readiness, prioritization, and funnel movement are visible enough to support an initial manager review.'

  if (activeLeads.length === 0 && data.prioritizedRows.length === 0 && totalStageRows === 0) {
    storyTitle = 'Module 5 is waiting for its first working signals.'
    storyBody = 'Lead, prioritization, and stage data have not appeared yet, so this overview is acting as a readiness checkpoint rather than a live alignment dashboard.'
  } else if (stalePct >= 35 || completedStageRows === 0) {
    storyTitle = 'The story right now is activity without enough momentum.'
    storyBody = 'There are enough records to monitor alignment, but the latest signals suggest quiet leads, limited downstream progress, or both.'
  } else if (hotRows.length > 0 && activePipelineLeads.length > 0) {
    storyTitle = 'There is enough motion here to guide real alignment decisions.'
    storyBody = 'Intent signals are present, funnel stages are visible, and managers can use this page as a quick shared read before drilling deeper.'
  }

  return {
    summaryCards,
    pipelineStages,
    watchouts,
    alignmentCards,
    attentionRows,
    story: {
      title: storyTitle,
      body: storyBody,
    },
    movement: {
      activeStageRows,
      completedStageRows,
      droppedStageRows,
      recentEntries30d,
      downstreamRows,
      earlyStageRows,
      coveragePct,
      stalePct,
    },
  }
}
