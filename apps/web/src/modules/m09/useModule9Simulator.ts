/**
 * Module: Campaign Performance Optimization (m09)
 * Layer: Frontend
 * File: useModule9Simulator.ts
 * Purpose: Supports the u se Mo du le9 Si mu la to r flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const CHANNEL_OPTIONS = ['display', 'content_syndication', 'email', 'paid_search', 'linkedin', 'webinar']
export const WEEKDAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
export const HOUR_BUCKET_OPTIONS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00']

export type BannerMessage = { type: 'info' | 'error' | 'success'; text: string } | null

export type MergedDataset = {
  _id: string
  title: string
  filename?: string
  rowCountBeforeMerge?: number
  rowCountAfterMerge?: number
  duplicateCount?: number
  createdAt?: string
}

export type BaselineItem = {
  rowId: string
  campaign_id?: string | null
  campaign_name?: string | null
  channel?: string | null
  launch_weekday?: string | null
  launch_hour_bucket?: string | null
  touches_per_user?: number | null
  spend?: number | null
  roi?: number | null
}

export type BaselineResponse = {
  ok: boolean
  page: number
  pageSize: number
  total: number
  items: BaselineItem[]
}

export type ScenarioState = {
  spend: string
  channel: string
  launch_weekday: string
  launch_hour_bucket: string
  touches_per_user: string
}

export type SimulationResult = {
  baseline?: {
    rowId?: string
    campaign_name?: string
    roi?: number | null
  }
  scenario?: {
    spend?: number | null
    channel?: string | null
    launch_weekday?: string | null
    launch_hour_bucket?: string | null
    touches_per_user?: number | null
  }
  prediction?: {
    predicted_roi?: number | null
    delta_roi?: number | null
  }
  model?: {
    model_type?: string
    mae?: number | null
    rmse?: number | null
    r2?: number | null
  }
  explanation?: string
}

export function getAuthHeaders(extra: Record<string, string> = {}) {
  try {
    const token = localStorage.getItem('token')
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
  } catch {
    return extra
  }
}

export function formatCompactNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  if (Math.abs(value) >= 1000) return value.toLocaleString()
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatRoi(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function parseScenarioNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildScenarioFromBaseline(item: BaselineItem | null): ScenarioState {
  return {
    spend: item?.spend !== null && item?.spend !== undefined ? String(item.spend) : '',
    channel: item?.channel || '',
    launch_weekday: item?.launch_weekday || '',
    launch_hour_bucket: item?.launch_hour_bucket || '',
    touches_per_user: item?.touches_per_user !== null && item?.touches_per_user !== undefined ? String(item.touches_per_user) : '',
  }
}

export function toneForDelta(delta?: number | null): 'positive' | 'neutral' | 'negative' {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return 'neutral'
  if (delta > 0.05) return 'positive'
  if (delta < -0.05) return 'negative'
  return 'neutral'
}

export function getConfidenceLabel(result: SimulationResult | null) {
  const r2 = Number(result?.model?.r2 ?? 0)
  if (r2 >= 0.9) return 'High confidence'
  if (r2 >= 0.75) return 'Medium confidence'
  return 'Exploratory result'
}

export function getRecommendation(result: SimulationResult | null) {
  const delta = Number(result?.prediction?.delta_roi ?? 0)
  if (delta > 0.35) return 'Likely stronger than the current baseline. Consider testing this adjustment.'
  if (delta > 0.05) return 'This looks directionally better. Consider testing the scenario in a controlled way.'
  if (delta < -0.35) return 'This scenario may reduce performance. Treat it as a lower-priority move.'
  if (delta < -0.05) return 'Improvement does not appear likely. The current baseline may remain the safer choice.'
  return 'Improvement appears limited. Treat this as a small adjustment rather than a major shift.'
}

export function getBusinessChangeSummary(selectedBaseline: BaselineItem | null, scenario: ScenarioState) {
  if (!selectedBaseline) return []
  const nextSpend = parseScenarioNumber(scenario.spend)
  const nextTouches = parseScenarioNumber(scenario.touches_per_user)
  const baselineSpend = selectedBaseline.spend ?? null
  const baselineTouches = selectedBaseline.touches_per_user ?? null

  const spendText = baselineSpend !== null && nextSpend !== null
    ? nextSpend > baselineSpend
      ? `Spend increased from ${formatCurrency(baselineSpend)} to ${formatCurrency(nextSpend)}.`
      : nextSpend < baselineSpend
        ? `Spend decreased from ${formatCurrency(baselineSpend)} to ${formatCurrency(nextSpend)}.`
        : `Spend stayed at ${formatCurrency(nextSpend)}.`
    : 'Spend was updated.'

  const channelText = selectedBaseline.channel && scenario.channel
    ? selectedBaseline.channel === scenario.channel
      ? `Channel stayed on ${scenario.channel}.`
      : `Channel changed from ${selectedBaseline.channel} to ${scenario.channel}.`
    : 'Channel was updated.'

  const timingChanged = (selectedBaseline.launch_weekday || '') !== scenario.launch_weekday || (selectedBaseline.launch_hour_bucket || '') !== scenario.launch_hour_bucket
  const timingText = timingChanged
    ? `Launch timing changed to ${scenario.launch_weekday || '--'} / ${scenario.launch_hour_bucket || '--'}.`
    : 'Launch timing stayed the same.'

  const touchesText = baselineTouches !== null && nextTouches !== null
    ? nextTouches > baselineTouches
      ? `Contact pressure increased from ${formatCompactNumber(baselineTouches)} to ${formatCompactNumber(nextTouches)} touches per user.`
      : nextTouches < baselineTouches
        ? `Contact pressure decreased from ${formatCompactNumber(baselineTouches)} to ${formatCompactNumber(nextTouches)} touches per user.`
        : `Contact pressure stayed at ${formatCompactNumber(nextTouches)} touches per user.`
    : 'Contact pressure was updated.'

  return [spendText, channelText, timingText, touchesText]
}

export function useModule9Simulator() {
  const workspaceId = getWorkspaceIdFromHash()
  const [message, setMessage] = useState<BannerMessage>(null)
  const [datasets, setDatasets] = useState<MergedDataset[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(true)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  const [selectedMergedId, setSelectedMergedId] = useState('')

  const [baselineResponse, setBaselineResponse] = useState<BaselineResponse | null>(null)
  const [loadingBaselines, setLoadingBaselines] = useState(false)
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [baselineQuery, setBaselineQuery] = useState('')
  const [baselineChannel, setBaselineChannel] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [selectedBaseline, setSelectedBaseline] = useState<BaselineItem | null>(null)

  const [scenario, setScenario] = useState<ScenarioState>(buildScenarioFromBaseline(null))
  const [runningSimulation, setRunningSimulation] = useState(false)
  const [simulationError, setSimulationError] = useState<string | null>(null)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)

  async function loadDatasets() {
    if (!workspaceId) {
      setLoadingDatasets(false)
      setDatasetError('Workspace context is missing. Open Campaign Performance Optimization from inside a workspace.')
      return
    }
    setLoadingDatasets(true)
    setDatasetError(null)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/merged?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setDatasets([])
        setDatasetError(json?.error || 'Campaign Performance Optimization could not load merged datasets right now.')
        return
      }
      const items = Array.isArray(json.items) ? (json.items as MergedDataset[]) : []
      setDatasets(items)
      setSelectedMergedId((current) => {
        if (current && items.some((item) => item._id === current)) return current
        return items[0]?._id || ''
      })
    } catch {
      setDatasets([])
      setDatasetError('Campaign Performance Optimization could not reach the merged dataset service right now.')
    } finally {
      setLoadingDatasets(false)
    }
  }

  async function loadBaselines() {
    if (!workspaceId || !selectedMergedId) {
      setBaselineResponse(null)
      return
    }
    setLoadingBaselines(true)
    setBaselineError(null)
    try {
      const params = new URLSearchParams({
        workspace: workspaceId,
        mergedId: selectedMergedId,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (baselineQuery.trim()) params.set('q', baselineQuery.trim())
      if (baselineChannel) params.set('channel', baselineChannel)

      const res = await fetch(`${API_URL}/m09/simulator/baselines?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setBaselineResponse(null)
        setBaselineError(json?.error || 'Baseline campaigns could not be loaded.')
        return
      }
      const payload = json as BaselineResponse
      setBaselineResponse(payload)
      setSelectedBaseline((current) => {
        if (!current) return null
        const matched = payload.items.find((item) => item.rowId === current.rowId)
        return matched || null
      })
    } catch {
      setBaselineResponse(null)
      setBaselineError('Campaign Performance Optimization could not reach the simulator baseline service.')
    } finally {
      setLoadingBaselines(false)
    }
  }

  useEffect(() => {
    void loadDatasets()
  }, [workspaceId])

  useEffect(() => {
    setPage(1)
    setSelectedBaseline(null)
    setScenario(buildScenarioFromBaseline(null))
    setSimulationResult(null)
    setSimulationError(null)
  }, [selectedMergedId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBaselines()
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [workspaceId, selectedMergedId, page, pageSize, baselineQuery, baselineChannel])

  const selectedDataset = datasets.find((item) => item._id === selectedMergedId) || null
  const totalPages = useMemo(() => {
    if (!baselineResponse) return 1
    return Math.max(1, Math.ceil(baselineResponse.total / baselineResponse.pageSize))
  }, [baselineResponse])

  const validationMessage = useMemo(() => {
    if (!selectedBaseline) return 'Select a baseline campaign row first.'
    const spend = parseScenarioNumber(scenario.spend)
    const touches = parseScenarioNumber(scenario.touches_per_user)
    if (spend === null || spend <= 0) return 'Spend must be greater than zero.'
    if (!scenario.channel || !scenario.launch_weekday || !scenario.launch_hour_bucket) return 'Channel, weekday, and hour bucket are required.'
    if (touches === null || touches < 0) return 'Touches per user must be zero or greater.'
    return null
  }, [scenario, selectedBaseline])

  async function runSimulation() {
    if (!workspaceId || !selectedMergedId || !selectedBaseline || validationMessage) {
      if (validationMessage) setSimulationError(validationMessage)
      return
    }
    setRunningSimulation(true)
    setSimulationError(null)
    setMessage({ type: 'info', text: 'Running the campaign ROI scenario projection...' })
    try {
      const res = await fetch(`${API_URL}/m09/simulator/run`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          workspace: workspaceId,
          mergedId: selectedMergedId,
          baselineRowId: selectedBaseline.rowId,
          scenario: {
            spend: parseScenarioNumber(scenario.spend),
            channel: scenario.channel,
            launch_weekday: scenario.launch_weekday,
            launch_hour_bucket: scenario.launch_hour_bucket,
            touches_per_user: parseScenarioNumber(scenario.touches_per_user),
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setSimulationResult(null)
        setSimulationError(json?.error || 'Simulation could not be completed.')
        setMessage({ type: 'error', text: json?.error || 'Simulation could not be completed.' })
        return
      }
      setSimulationResult(json as SimulationResult)
      setMessage({ type: 'success', text: 'Scenario projection generated successfully.' })
    } catch {
      setSimulationResult(null)
      setSimulationError('Campaign Performance Optimization could not reach the simulator service right now.')
      setMessage({ type: 'error', text: 'Campaign Performance Optimization could not reach the simulator service right now.' })
    } finally {
      setRunningSimulation(false)
    }
  }

  function selectBaseline(item: BaselineItem) {
    setSelectedBaseline(item)
    setScenario(buildScenarioFromBaseline(item))
    setSimulationResult(null)
    setSimulationError(null)
  }

  function resetScenario() {
    setScenario(buildScenarioFromBaseline(selectedBaseline))
  }

  return {
    workspaceId,
    message,
    setMessage,
    datasets,
    loadingDatasets,
    datasetError,
    selectedMergedId,
    setSelectedMergedId,
    selectedDataset,
    loadDatasets,
    baselineResponse,
    loadingBaselines,
    baselineError,
    baselineQuery,
    setBaselineQuery,
    baselineChannel,
    setBaselineChannel,
    page,
    setPage,
    totalPages,
    selectedBaseline,
    selectBaseline,
    loadBaselines,
    scenario,
    setScenario,
    resetScenario,
    runningSimulation,
    simulationError,
    simulationResult,
    runSimulation,
    validationMessage,
    resultTone: toneForDelta(simulationResult?.prediction?.delta_roi),
    confidenceLabel: getConfidenceLabel(simulationResult),
    businessRecommendation: getRecommendation(simulationResult),
    businessChangeSummary: getBusinessChangeSummary(selectedBaseline, scenario),
  }
}
