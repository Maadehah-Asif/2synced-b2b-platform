export { default } from './Module9WhatIfBusinessPage'
/*
import type React from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import {
  CHANNEL_OPTIONS,
  HOUR_BUCKET_OPTIONS,
  WEEKDAY_OPTIONS,
  formatCompactNumber,
  formatCurrency,
  formatRoi,
  useModule9Simulator,
} from './useModule9Simulator'

export default function Module9WhatIfSimulatorPage() {
  const {
    message,
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
    resultTone,
    confidenceLabel,
    businessRecommendation,
    businessChangeSummary,
    workspaceId,
  } = useModule9Simulator()

    setLoadingDatasets(true)
    setDatasetError(null)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/merged?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setDatasets([])
        setDatasetError(json?.error || 'Campaign Intelligence could not load merged datasets right now.')
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
      setDatasetError('Campaign Intelligence could not reach the merged dataset service right now.')
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
      setBaselineError('Campaign Intelligence could not reach the simulator baseline service.')
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

  const resultTone = toneForDelta(simulationResult?.prediction?.delta_roi)

  const changedInputs = useMemo(() => {
    if (!selectedBaseline) return []
    const changes = [
      {
        label: 'Spend',
        changed: String(selectedBaseline.spend ?? '') !== scenario.spend,
        text: `${formatCurrency(selectedBaseline.spend)} -> ${formatCurrency(parseScenarioNumber(scenario.spend))}`,
      },
      {
        label: 'Channel',
        changed: (selectedBaseline.channel || '') !== scenario.channel,
        text: `${selectedBaseline.channel || '--'} -> ${scenario.channel || '--'}`,
      },
      {
        label: 'Timing',
        changed: (selectedBaseline.launch_weekday || '') !== scenario.launch_weekday || (selectedBaseline.launch_hour_bucket || '') !== scenario.launch_hour_bucket,
        text: `${selectedBaseline.launch_weekday || '--'} / ${selectedBaseline.launch_hour_bucket || '--'} -> ${scenario.launch_weekday || '--'} / ${scenario.launch_hour_bucket || '--'}`,
      },
      {
        label: 'Touches',
        changed: String(selectedBaseline.touches_per_user ?? '') !== scenario.touches_per_user,
        text: `${formatCompactNumber(selectedBaseline.touches_per_user)} -> ${formatCompactNumber(parseScenarioNumber(scenario.touches_per_user))}`,
      },
    ]
    return changes
  }, [scenario, selectedBaseline])

  async function handleRunSimulation() {
    if (!workspaceId || !selectedMergedId || !selectedBaseline || validationMessage) {
      if (validationMessage) setSimulationError(validationMessage)
      return
    }

    setRunningSimulation(true)
    setSimulationError(null)
    setMessage({ type: 'info', text: 'Running the ROI scenario projection...' })

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
      setSimulationError('Campaign Intelligence could not reach the simulator service right now.')
      setMessage({ type: 'error', text: 'Campaign Intelligence could not reach the simulator service right now.' })
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

  function goToImport() {
    if (workspaceId) window.location.hash = `#/workspace/${workspaceId}/m09/import`
    else window.location.hash = '#/workspaces'
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m09" label="Back" />
          <h2 style={{ marginTop: 16 }}>Campaign Intelligence & What-If Simulation</h2>
        </div>

        <section style={heroStyle}>
          <div style={{ padding: 28 }}>
            <div style={heroPillRowStyle}>
              <HeroPill label="Campaign Intelligence" />
              <HeroPill label="Uses trained ROI model" />
              <HeroPill label="Scenario-based projection" />
            </div>
            <h1 style={heroTitleStyle}>What-If ROI Simulator</h1>
            <div style={heroTextStyle}>
              Compare baseline campaign performance with scenario changes before making optimization decisions.
            </div>
          </div>
        </section>

        {message && <MessageBanner message={message} />}

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={pillStyle}>Merged Dataset</div>
              <h3 style={sectionTitleStyle}>Choose a normalized campaign dataset</h3>
            </div>
            <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void loadDatasets()}>
              Refresh
            </button>
          </div>

          {loadingDatasets ? (
            <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
              <SkeletonBlock height={72} />
              <SkeletonBlock height={72} />
            </div>
          ) : datasetError ? (
            <StatusCard tone="error" title="Dataset loading problem">
              {datasetError}
            </StatusCard>
          ) : datasets.length === 0 ? (
            <EmptyState
              title="No merged campaign datasets yet"
              text="Create a merged campaign dataset first in Campaign Data Import before using the simulator."
              actionLabel="Go to Campaign Data Import"
              onAction={goToImport}
            />
          ) : (
            <>
              <div style={{ marginTop: 18 }}>
                <label style={fieldLabelStyle}>Merged dataset</label>
                <select value={selectedMergedId} onChange={(event) => setSelectedMergedId(event.target.value)} style={selectStyle}>
                  {datasets.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDataset && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <MetricTile label="Rows before" value={String(selectedDataset.rowCountBeforeMerge || 0)} />
                  <MetricTile label="Rows after" value={String(selectedDataset.rowCountAfterMerge || 0)} />
                  <MetricTile label="Duplicates merged" value={String(selectedDataset.duplicateCount || 0)} />
                  <MetricTile label="Created" value={selectedDataset.createdAt ? new Date(selectedDataset.createdAt).toLocaleDateString() : '--'} />
                </div>
              )}
            </>
          )}
        </section>

        {selectedDataset && (
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={pillStyle}>Baseline Selector</div>
                <h3 style={sectionTitleStyle}>Select a baseline campaign row</h3>
              </div>
              <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void loadBaselines()}>
                Refresh
              </button>
            </div>

            <div style={baselineToolbarStyle}>
              <div style={toolbarInputWrapStyle}>
                <label style={fieldLabelStyle}>Search</label>
                <input
                  value={baselineQuery}
                  onChange={(event) => {
                    setPage(1)
                    setBaselineQuery(event.target.value)
                  }}
                  placeholder="Search campaign name or id"
                  style={inputStyle}
                />
              </div>
              <div style={toolbarSelectWrapStyle}>
                <label style={fieldLabelStyle}>Channel</label>
                <select
                  value={baselineChannel}
                  onChange={(event) => {
                    setPage(1)
                    setBaselineChannel(event.target.value)
                  }}
                  style={selectStyle}
                >
                  <option value="">All channels</option>
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingBaselines ? (
              <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                <SkeletonBlock height={66} />
                <SkeletonBlock height={66} />
                <SkeletonBlock height={66} />
              </div>
            ) : baselineError ? (
              <div style={{ marginTop: 18 }}>
                <StatusCard tone="error" title="Baseline loading problem">
                  {baselineError}
                </StatusCard>
              </div>
            ) : !baselineResponse || baselineResponse.items.length === 0 ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState
                  title="No baseline rows found"
                  text={baselineQuery || baselineChannel ? 'Try clearing the current search or channel filter to load more baseline campaign rows.' : 'This merged dataset does not have simulator-ready baseline rows yet.'}
                />
              </div>
            ) : (
              <>
                <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr>
                        <th style={tableHeadStyle}>Campaign</th>
                        <th style={tableHeadStyle}>Channel</th>
                        <th style={tableHeadStyle}>Spend</th>
                        <th style={tableHeadStyle}>Touches</th>
                        <th style={tableHeadStyle}>Weekday</th>
                        <th style={tableHeadStyle}>Hour Bucket</th>
                        <th style={tableHeadStyle}>ROI</th>
                        <th style={tableHeadStyle}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baselineResponse.items.map((item) => {
                        const selected = selectedBaseline?.rowId === item.rowId
                        return (
                          <tr key={item.rowId} style={selected ? selectedRowStyle : undefined}>
                            <td style={selected ? selectedStrongCellStyle : strongCellStyle}>
                              <div>{item.campaign_name || item.campaign_id || 'Untitled campaign'}</div>
                              <div style={subtleCellTextStyle}>{item.campaign_id || 'No campaign id'}</div>
                            </td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{item.channel || '--'}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{formatCurrency(item.spend)}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{formatCompactNumber(item.touches_per_user)}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{item.launch_weekday || '--'}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{item.launch_hour_bucket || '--'}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>{formatRoi(item.roi)}</td>
                            <td style={selected ? selectedCellStyle : tableCellStyle}>
                              <button className={selected ? 'btn-primary' : 'btn-ghost'} style={selected ? smallPrimaryButtonStyle : smallGhostButtonStyle} onClick={() => selectBaseline(item)}>
                                {selected ? 'Selected' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={paginationStyle}>
                  <div style={paginationInfoStyle}>
                    Showing page {baselineResponse.page} of {totalPages} · {baselineResponse.total} baseline rows
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" style={smallGhostButtonStyle} disabled={baselineResponse.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                      Previous
                    </button>
                    <button className="btn-ghost" style={smallGhostButtonStyle} disabled={baselineResponse.page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {selectedBaseline && (
          <section style={twoColumnSectionStyle}>
            <div style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={pillStyle}>Selected Baseline</div>
                  <h3 style={sectionTitleStyle}>You are simulating from this campaign row</h3>
                </div>
                <IconBadge tone="info" icon="target" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <MetricTile label="Campaign" value={selectedBaseline.campaign_name || selectedBaseline.campaign_id || 'Untitled'} />
                <MetricTile label="Channel" value={selectedBaseline.channel || '--'} />
                <MetricTile label="Baseline spend" value={formatCurrency(selectedBaseline.spend)} />
                <MetricTile label="Touches" value={formatCompactNumber(selectedBaseline.touches_per_user)} />
                <MetricTile label="Timing" value={`${selectedBaseline.launch_weekday || '--'} / ${selectedBaseline.launch_hour_bucket || '--'}`} />
                <MetricTile label="Baseline ROI" value={formatRoi(selectedBaseline.roi)} />
              </div>
            </div>

            <div style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={pillStyle}>Scenario Inputs</div>
                  <h3 style={sectionTitleStyle}>Adjust the what-if inputs</h3>
                </div>
                <IconBadge tone="info" icon="spark" />
              </div>

              <div style={formGridStyle}>
                <FieldBlock label="Spend">
                  <input type="number" value={scenario.spend} onChange={(event) => setScenario((current) => ({ ...current, spend: event.target.value }))} style={inputStyle} min="0" step="100" />
                </FieldBlock>
                <FieldBlock label="Channel">
                  <select value={scenario.channel} onChange={(event) => setScenario((current) => ({ ...current, channel: event.target.value }))} style={selectStyle}>
                    <option value="">Select channel</option>
                    {CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
                <FieldBlock label="Launch weekday">
                  <select value={scenario.launch_weekday} onChange={(event) => setScenario((current) => ({ ...current, launch_weekday: event.target.value }))} style={selectStyle}>
                    <option value="">Select weekday</option>
                    {WEEKDAY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
                <FieldBlock label="Launch hour bucket">
                  <select value={scenario.launch_hour_bucket} onChange={(event) => setScenario((current) => ({ ...current, launch_hour_bucket: event.target.value }))} style={selectStyle}>
                    <option value="">Select hour bucket</option>
                    {HOUR_BUCKET_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
                <FieldBlock label="Touches per user">
                  <input type="number" value={scenario.touches_per_user} onChange={(event) => setScenario((current) => ({ ...current, touches_per_user: event.target.value }))} style={inputStyle} min="0" step="1" />
                </FieldBlock>
              </div>

              {validationMessage && (
                <div style={{ marginTop: 14 }}>
                  <StatusCard tone="warning" title="Check the scenario inputs">
                    {validationMessage}
                  </StatusCard>
                </div>
              )}

              {simulationError && (
                <div style={{ marginTop: 14 }}>
                  <StatusCard tone="error" title="Simulation issue">
                    {simulationError}
                  </StatusCard>
                </div>
              )}

              <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-ghost" style={buttonGhostStyle} onClick={() => setScenario(buildScenarioFromBaseline(selectedBaseline))}>
                  Reset to Baseline
                </button>
                <button className="btn-primary" style={buttonPrimaryStyle} disabled={!!validationMessage || runningSimulation} onClick={() => void handleRunSimulation()}>
                  {runningSimulation ? 'Running Simulation...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </section>
        )}

        {simulationResult && (
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={pillStyle}>Results</div>
                <h3 style={sectionTitleStyle}>Scenario projection summary</h3>
              </div>
              <IconBadge tone={resultTone} icon={resultTone === 'positive' ? 'up' : resultTone === 'negative' ? 'down' : 'flat'} />
            </div>

            <div style={resultsGridStyle}>
              <ResultMetricCard label="Baseline ROI" value={formatRoi(simulationResult.baseline?.roi)} tone="neutral" icon="target" />
              <ResultMetricCard label="Projected ROI" value={formatRoi(simulationResult.prediction?.predicted_roi)} tone={resultTone} icon="spark" />
              <ResultMetricCard label="Delta ROI" value={formatRoi(simulationResult.prediction?.delta_roi)} tone={resultTone} icon={resultTone === 'positive' ? 'up' : resultTone === 'negative' ? 'down' : 'flat'} />
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Scenario interpretation</div>
                <InterpretationCard tone={resultTone} />
              </div>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Mini ROI comparison</div>
                <MiniComparisonBar baseline={simulationResult.baseline?.roi ?? null} projected={simulationResult.prediction?.predicted_roi ?? null} />
              </div>
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Changed inputs summary</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {changedInputs.map((item) => (
                    <ChangeRow key={item.label} label={item.label} changed={item.changed} text={item.text} />
                  ))}
                </div>
              </div>

              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>How this projection was generated</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <TrustLine label="Model" value={simulationResult.model?.model_type || '--'} />
                  <TrustLine label="MAE" value={formatCompactNumber(simulationResult.model?.mae)} />
                  <TrustLine label="RMSE" value={formatCompactNumber(simulationResult.model?.rmse)} />
                  <TrustLine label="R²" value={formatCompactNumber(simulationResult.model?.r2)} />
                  <div style={trustExplanationStyle}>{simulationResult.explanation || 'Projection generated from the selected campaign baseline with scenario overrides applied.'}</div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </Layout>
  )
}

function HeroPill({ label }: { label: string }) {
  return <span style={heroPillStyle}>{label}</span>
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricTileStyle}>
      <div style={metricTileLabelStyle}>{label}</div>
      <div style={metricTileValueStyle}>{value}</div>
    </div>
  )
}

function StatusCard({ title, tone, children }: { title: string; tone: 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const palette = tone === 'success'
    ? { bg: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.18)', color: '#0F766E' }
    : tone === 'warning'
      ? { bg: 'rgba(180,120,32,0.10)', border: '1px solid rgba(180,120,32,0.18)', color: '#9A6700' }
      : { bg: 'rgba(190,24,93,0.10)', border: '1px solid rgba(190,24,93,0.18)', color: '#9D174D' }

  return (
    <div style={{ borderRadius: 18, padding: 16, background: palette.bg, border: palette.border, boxShadow: '0 10px 24px rgba(13,30,60,0.06)' }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: palette.color }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: palette.color }}>{children}</div>
    </div>
  )
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyPillStyle}>Empty State</div>
      <h3 style={{ margin: '14px 0 8px', fontSize: 24, color: '#0B2540' }}>{title}</h3>
      <div style={{ maxWidth: 760, fontSize: 14, lineHeight: 1.75, color: '#415274' }}>{text}</div>
      {actionLabel && onAction && (
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" style={buttonPrimaryStyle} onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function InterpretationCard({ tone }: { tone: 'positive' | 'neutral' | 'negative' }) {
  const config = tone === 'positive'
    ? { title: 'Likely improvement', text: 'The projected scenario points to a higher ROI than the selected baseline, so this change looks directionally favorable.', color: '#0F766E', bg: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.18)', icon: 'up' as const }
    : tone === 'negative'
      ? { title: 'Likely decline', text: 'The projected scenario falls below the baseline ROI, so this combination looks less favorable than the current campaign row.', color: '#B42318', bg: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.16)', icon: 'down' as const }
      : { title: 'Neutral impact', text: 'The projected result is close to the current baseline, so the scenario looks broadly flat rather than clearly better or worse.', color: '#9A6700', bg: 'rgba(180,120,32,0.08)', border: '1px solid rgba(180,120,32,0.16)', icon: 'flat' as const }

  return (
    <div style={{ borderRadius: 18, padding: 18, background: config.bg, border: config.border, boxShadow: '0 10px 24px rgba(13,30,60,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconBadge tone={tone} icon={config.icon} />
        <div style={{ fontSize: 16, fontWeight: 900, color: config.color }}>{config.title}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: config.color }}>{config.text}</div>
    </div>
  )
}

function MiniComparisonBar({ baseline, projected }: { baseline: number | null; projected: number | null }) {
  const max = Math.max(Math.abs(baseline ?? 0), Math.abs(projected ?? 0), 0.1)
  const baselineWidth = `${Math.max(8, (Math.abs(baseline ?? 0) / max) * 100)}%`
  const projectedWidth = `${Math.max(8, (Math.abs(projected ?? 0) / max) * 100)}%`

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <MiniBarRow label="Baseline ROI" value={formatRoi(baseline)} width={baselineWidth} fill="linear-gradient(90deg, #7B8CA9 0%, #9FB1C6 100%)" />
      <MiniBarRow label="Projected ROI" value={formatRoi(projected)} width={projectedWidth} fill="linear-gradient(90deg, #0f766e 0%, #2c9e88 100%)" />
    </div>
  )
}

function MiniBarRow({ label, value, width, fill }: { label: string; value: string; width: string; fill: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0B2540' }}>{label}</div>
        <div style={{ fontSize: 13, color: '#415274' }}>{value}</div>
      </div>
      <div style={miniBarTrackStyle}>
        <div style={{ width, height: '100%', borderRadius: 999, background: fill }} />
      </div>
    </div>
  )
}

function ChangeRow({ label, changed, text }: { label: string; changed: boolean; text: string }) {
  return (
    <div style={{ ...changeRowStyle, borderColor: changed ? 'rgba(15,66,88,0.14)' : 'rgba(15,66,88,0.08)', background: changed ? 'rgba(244,248,252,0.98)' : 'rgba(249,251,253,0.9)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: '#415274', lineHeight: 1.6 }}>{text}</div>
      </div>
      <span style={changed ? changedBadgeStyle : sameBadgeStyle}>{changed ? 'Changed' : 'Same'}</span>
    </div>
  )
}

function TrustLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={trustLineStyle}>
      <div style={trustLabelStyle}>{label}</div>
      <div style={trustValueStyle}>{value}</div>
    </div>
  )
}

function MessageBanner({ message }: { message: NonNullable<BannerMessage> }) {
  const palette = message.type === 'error'
    ? { bg: 'rgba(190,24,93,0.10)', border: '1px solid rgba(190,24,93,0.18)', color: '#9D174D' }
    : message.type === 'success'
      ? { bg: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.18)', color: '#0F766E' }
      : { bg: 'rgba(36,83,166,0.10)', border: '1px solid rgba(36,83,166,0.18)', color: '#2453A6' }

  return (
    <section style={{ marginTop: 18, borderRadius: 16, padding: 14, fontSize: 13, lineHeight: 1.7, background: palette.bg, border: palette.border, color: palette.color }}>
      {message.text}
    </section>
  )
}

type IconName = 'spark' | 'target' | 'up' | 'down' | 'flat'

function ResultMetricCard({ label, value, tone, icon }: { label: string; value: string; tone: 'positive' | 'neutral' | 'negative'; icon: IconName }) {
  const palette = tone === 'positive'
    ? { bg: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.16)', color: '#0F766E' }
    : tone === 'negative'
      ? { bg: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.16)', color: '#B42318' }
      : { bg: 'rgba(119,132,155,0.10)', border: '1px solid rgba(119,132,155,0.16)', color: '#44556F' }

  return (
    <div style={{ borderRadius: 20, padding: 18, background: palette.bg, border: palette.border, boxShadow: '0 10px 24px rgba(13,30,60,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: palette.color }}>{label}</div>
        <IconBadge tone={tone} icon={icon} />
      </div>
      <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.05, fontWeight: 900, color: palette.color }}>{value}</div>
    </div>
  )
}

function IconBadge({ tone, icon }: { tone: 'positive' | 'neutral' | 'negative' | 'info'; icon: IconName }) {
  const palette = tone === 'positive'
    ? { bg: 'rgba(15,118,110,0.14)', color: '#0F766E' }
    : tone === 'negative'
      ? { bg: 'rgba(180,35,24,0.14)', color: '#B42318' }
      : tone === 'info'
        ? { bg: 'rgba(36,83,166,0.12)', color: '#2453A6' }
        : { bg: 'rgba(119,132,155,0.14)', color: '#44556F' }

  return (
    <span style={{ ...iconBadgeStyle, background: palette.bg, color: palette.color }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {icon === 'spark' && <path d="M8 1.5 9.6 5.2 13.5 6.8 9.6 8.4 8 12.2 6.4 8.4 2.5 6.8 6.4 5.2 8 1.5Z" fill="currentColor" />}
        {icon === 'target' && <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2.2" fill="currentColor" /></>}
        {icon === 'up' && <path d="M8 2.5 13 8H9.7v5.5H6.3V8H3L8 2.5Z" fill="currentColor" />}
        {icon === 'down' && <path d="M8 13.5 3 8h3.3V2.5h3.4V8H13L8 13.5Z" fill="currentColor" />}
        {icon === 'flat' && <rect x="3" y="7.1" width="10" height="1.8" rx="0.9" fill="currentColor" />}
      </svg>
    </span>
  )
}

const heroStyle: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
  background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
  color: '#fff',
}
const heroPillRowStyle: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const heroPillStyle: React.CSSProperties = { display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }
const heroTitleStyle: React.CSSProperties = { margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }
const heroTextStyle: React.CSSProperties = { maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }

const panelStyle: React.CSSProperties = { marginTop: 18, borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.06)' }
const subPanelStyle: React.CSSProperties = { borderRadius: 18, padding: 18, background: 'rgba(252,253,255,0.96)', border: '1px solid rgba(15,66,88,0.08)' }
const twoColumnSectionStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }
const resultsGridStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }
const sectionHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }
const pillStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const sectionTitleStyle: React.CSSProperties = { margin: '12px 0 0', fontSize: 24, color: '#0B2540' }
const subSectionTitleStyle: React.CSSProperties = { marginBottom: 14, fontSize: 16, fontWeight: 900, color: '#0B2540' }

const buttonPrimaryStyle: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', fontWeight: 800 }
const buttonGhostStyle: React.CSSProperties = { borderRadius: 12, padding: '9px 12px', fontWeight: 800 }
const smallGhostButtonStyle: React.CSSProperties = { borderRadius: 10, padding: '8px 10px', fontWeight: 800, fontSize: 12, background: 'rgba(244,248,252,0.96)' }
const smallPrimaryButtonStyle: React.CSSProperties = { borderRadius: 10, padding: '8px 10px', fontWeight: 800, fontSize: 12 }

const fieldLabelStyle: React.CSSProperties = { display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }
const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 14, border: '1px solid rgba(15,66,88,0.16)', padding: '11px 12px', fontSize: 14, color: '#0B2540', background: '#fff' }
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' }
const metricTileStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: 14,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(244,248,252,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 10px 24px rgba(13,30,60,0.06)'
}
const metricTileLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }
const metricTileValueStyle: React.CSSProperties = { marginTop: 7, fontSize: 20, fontWeight: 900, color: '#0B2540', lineHeight: 1 }

const baselineToolbarStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(260px, 1.4fr) minmax(220px, 0.8fr)', gap: 14 }
const toolbarInputWrapStyle: React.CSSProperties = { minWidth: 0 }
const toolbarSelectWrapStyle: React.CSSProperties = { minWidth: 0 }
const tableHeadStyle: React.CSSProperties = { textAlign: 'left', fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', background: 'rgba(244,248,252,0.95)' }
const tableCellStyle: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', fontSize: 13, color: '#415274', verticalAlign: 'top' }
const strongCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#0B2540', fontWeight: 800 }
const subtleCellTextStyle: React.CSSProperties = { marginTop: 4, fontSize: 12, color: '#5B6C8B', fontWeight: 500 }
const selectedRowStyle: React.CSSProperties = { background: 'rgba(36,83,166,0.06)' }
const selectedCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const selectedStrongCellStyle: React.CSSProperties = { ...strongCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const paginationStyle: React.CSSProperties = { marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
const paginationInfoStyle: React.CSSProperties = { fontSize: 13, color: '#5B6C8B' }
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18 }

const emptyStateStyle: React.CSSProperties = { borderRadius: 20, padding: 24, background: 'linear-gradient(180deg, rgba(247,250,253,0.98), rgba(255,255,255,1))', border: '1px dashed rgba(15,66,88,0.18)' }
const emptyPillStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const miniBarTrackStyle: React.CSSProperties = { width: '100%', height: 10, borderRadius: 999, background: 'rgba(219,227,235,0.8)', overflow: 'hidden' }
const changeRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16, border: '1px solid rgba(15,66,88,0.08)' }
const changedBadgeStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(36,83,166,0.10)', color: '#2453A6', fontSize: 12, fontWeight: 800 }
const sameBadgeStyle: React.CSSProperties = { ...changedBadgeStyle, background: 'rgba(119,132,155,0.12)', color: '#5B6C8B' }
const trustLineStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(15,66,88,0.08)' }
const trustLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#5B6C8B' }
const trustValueStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#0B2540' }
const trustExplanationStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.7, color: '#415274', paddingTop: 4 }
const iconBadgeStyle: React.CSSProperties = { width: 34, height: 34, borderRadius: 12, display: 'inline-grid', placeItems: 'center', flexShrink: 0 }

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ height, borderRadius: 18, background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))', border: '1px solid rgba(15,66,88,0.06)' }} />
}
*/
