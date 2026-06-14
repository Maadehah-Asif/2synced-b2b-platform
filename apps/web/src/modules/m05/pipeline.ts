/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Frontend
 * File: pipeline.ts
 * Purpose: Supports the p ip el in e flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import type { DashboardData, StageRecord } from './overview'

export type PipelineKpi = {
  label: string
  value: string
  note: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type PipelineStageCard = {
  name: string
  count: number
  share: number
  stagnantCount: number
  completedCount: number
  droppedCount: number
  isEarly: boolean
  isLate: boolean
}

export type StageSummaryRow = {
  name: string
  count: number
  shareLabel: string
  signal: string
  attention: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type PipelineWatchout = {
  title: string
  stat: string
  body: string
  tone: 'amber' | 'blue' | 'teal'
}

export type PipelineMetrics = {
  kpis: PipelineKpi[]
  stages: PipelineStageCard[]
  stageTable: StageSummaryRow[]
  watchouts: PipelineWatchout[]
  summary: {
    totalStageRows: number
    activeStageRows: number
    completedStageRows: number
    droppedStageRows: number
    recentEntries30d: number
    stagnantStageRows: number
    earlyShare: number
    downstreamShare: number
    uniqueStageCount: number
    activeLeadCoverage: number
    highIntentQuietCount: number
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

function isStageStagnant(record: StageRecord, now: Date) {
  if (record.stage_status === 'completed' || record.stage_status === 'dropped') return false
  if (!record.entered_at) return true
  const enteredAt = new Date(record.entered_at)
  if (Number.isNaN(enteredAt.getTime())) return true
  return daysBetween(enteredAt, now) >= 21
}

export function buildPipelineMetrics(data: DashboardData): PipelineMetrics {
  const now = new Date()
  const activeLeads = data.module6Leads.filter((lead) => !lead.is_archived)

  let activeStageRows = 0
  let completedStageRows = 0
  let droppedStageRows = 0
  let recentEntries30d = 0
  let stagnantStageRows = 0
  let earlyStageRows = 0
  let downstreamRows = 0

  const stageMap = new Map<string, {
    name: string
    count: number
    stagnantCount: number
    completedCount: number
    droppedCount: number
    isEarly: boolean
    isLate: boolean
  }>()

  for (const record of data.stageRecords) {
    const key = record.stage_name || 'Unspecified'
    const existing = stageMap.get(key) || {
      name: niceStageName(key),
      count: 0,
      stagnantCount: 0,
      completedCount: 0,
      droppedCount: 0,
      isEarly: isEarlyStage(key),
      isLate: isLateStage(key),
    }

    existing.count += 1
    if (record.stage_status === 'completed') {
      completedStageRows += 1
      existing.completedCount += 1
    } else if (record.stage_status === 'dropped') {
      droppedStageRows += 1
      existing.droppedCount += 1
    } else {
      activeStageRows += 1
    }

    const enteredAt = new Date(record.entered_at)
    if (!Number.isNaN(enteredAt.getTime()) && daysBetween(enteredAt, now) <= 30) {
      recentEntries30d += 1
    }

    if (existing.isEarly) earlyStageRows += 1
    if (existing.isLate) downstreamRows += 1

    if (isStageStagnant(record, now)) {
      stagnantStageRows += 1
      existing.stagnantCount += 1
    }

    stageMap.set(key, existing)
  }

  const totalStageRows = data.stageRecords.length
  const stages: PipelineStageCard[] = Array.from(stageMap.values())
    .sort((a, b) => b.count - a.count)
    .map((stage) => ({
      ...stage,
      share: totalStageRows > 0 ? (stage.count / totalStageRows) * 100 : 0,
    }))

  const stageLeadIds = new Set(data.stageRecords.map((record) => record.lead_id))
  const activeLeadCoverage = activeLeads.length > 0
    ? (activeLeads.filter((lead) => stageLeadIds.has(lead.lead_id)).length / activeLeads.length) * 100
    : 0

  const highIntentQuietCount = data.prioritizedRows.filter((row) => {
    const segment = String(row.intentSegment || '').toUpperCase()
    const highIntent = ['HOT', 'BLAZING'].includes(segment) || (row.intentScore || 0) >= 80
    const quiet = typeof row.daysSinceLastAction === 'number'
      ? row.daysSinceLastAction >= 21
      : !row.lastEventDate || daysBetween(new Date(row.lastEventDate), now) >= 21
    return highIntent && quiet
  }).length

  const earlyShare = totalStageRows > 0 ? (earlyStageRows / totalStageRows) * 100 : 0
  const downstreamShare = totalStageRows > 0 ? (downstreamRows / totalStageRows) * 100 : 0

  const kpis: PipelineKpi[] = [
    {
      label: 'Stage rows',
      value: String(totalStageRows),
      note: totalStageRows > 0 ? `${stageMap.size} visible stages are represented` : 'No stage activity is visible yet',
      tone: 'navy',
    },
    {
      label: 'Active stage presence',
      value: String(activeStageRows),
      note: totalStageRows > 0 ? `${formatPercent((activeStageRows / Math.max(1, totalStageRows)) * 100)} of rows are still active` : 'Waiting for stage records',
      tone: 'slate',
    },
    {
      label: 'Early-stage concentration',
      value: formatPercent(earlyShare),
      note: earlyStageRows > 0 ? `${earlyStageRows} rows are clustered near the top of funnel` : 'No early-stage buildup detected',
      tone: earlyShare >= 55 ? 'amber' : 'teal',
    },
    {
      label: 'Downstream presence',
      value: formatPercent(downstreamShare),
      note: downstreamRows > 0 ? `${downstreamRows} later-stage rows are visible` : 'No later-stage movement is visible yet',
      tone: downstreamRows > 0 ? 'teal' : 'amber',
    },
    {
      label: 'Recent entries',
      value: String(recentEntries30d),
      note: recentEntries30d > 0 ? 'Rows entered in the last 30 days' : 'No recent stage entries were found',
      tone: recentEntries30d > 0 ? 'slate' : 'amber',
    },
    {
      label: 'Needs review',
      value: String(stagnantStageRows),
      note: stagnantStageRows > 0 ? `${highIntentQuietCount} high-intent leads also look quiet` : 'No clear stagnation signal is visible',
      tone: stagnantStageRows > 0 ? 'amber' : 'teal',
    },
  ]

  const stageTable: StageSummaryRow[] = stages.slice(0, 8).map((stage) => {
    let signal = 'Balanced stage activity'
    let attention = 'Monitor'
    let tone: StageSummaryRow['tone'] = 'slate'

    if (stage.stagnantCount >= 3) {
      signal = 'Multiple rows have been sitting here for 21+ days'
      attention = 'Review now'
      tone = 'amber'
    } else if (stage.isEarly && stage.share >= 25) {
      signal = 'Heavy top-of-funnel concentration'
      attention = 'Watch buildup'
      tone = 'amber'
    } else if (stage.isLate && stage.count > 0) {
      signal = 'Later-stage progress is visible'
      attention = 'Protect momentum'
      tone = 'teal'
    } else if (stage.completedCount > 0) {
      signal = 'Some records are exiting this stage cleanly'
      attention = 'Healthy flow'
      tone = 'teal'
    }

    return {
      name: stage.name,
      count: stage.count,
      shareLabel: formatPercent(stage.share),
      signal,
      attention,
      tone,
    }
  })

  const watchouts: PipelineWatchout[] = []

  if (earlyShare >= 55) {
    watchouts.push({
      title: 'Top-heavy funnel',
      stat: formatPercent(earlyShare),
      body: 'Most visible pipeline activity is still concentrated in early stages.',
      tone: 'amber',
    })
  }

  if (downstreamShare <= 20 && totalStageRows > 0) {
    watchouts.push({
      title: 'Weak downstream presence',
      stat: formatPercent(downstreamShare),
      body: 'Later-stage pipeline visibility is still limited compared with the full funnel.',
      tone: 'teal',
    })
  }

  if (recentEntries30d <= Math.max(2, Math.floor(totalStageRows * 0.12)) && totalStageRows > 0) {
    watchouts.push({
      title: 'Limited recent progression',
      stat: String(recentEntries30d),
      body: 'Recent new stage entries are light for the current visible funnel size.',
      tone: 'blue',
    })
  }

  if (stagnantStageRows >= 4) {
    watchouts.push({
      title: 'Possible stagnation',
      stat: String(stagnantStageRows),
      body: 'Several active stage rows have been sitting for 21 days or longer.',
      tone: 'amber',
    })
  }

  if (watchouts.length === 0) {
    watchouts.push({
      title: 'No dominant bottleneck',
      stat: 'Stable',
      body: 'The current funnel shape does not show one overwhelming issue.',
      tone: 'teal',
    })
  }

  return {
    kpis,
    stages,
    stageTable,
    watchouts,
    summary: {
      totalStageRows,
      activeStageRows,
      completedStageRows,
      droppedStageRows,
      recentEntries30d,
      stagnantStageRows,
      earlyShare,
      downstreamShare,
      uniqueStageCount: stageMap.size,
      activeLeadCoverage,
      highIntentQuietCount,
    },
  }
}
