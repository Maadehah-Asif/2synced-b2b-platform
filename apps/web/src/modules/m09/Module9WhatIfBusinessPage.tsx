/**
 * Module: Campaign Performance Optimization (m09)
 * Layer: Frontend
 * File: Module9WhatIfBusinessPage.tsx
 * Purpose: Supports the M od ul e9 Wh at If Bu si ne ss Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

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

export default function Module9WhatIfBusinessPage() {
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

  function goToImport() {
    if (workspaceId) window.location.hash = `#/workspace/${workspaceId}/m09/import`
    else window.location.hash = '#/workspaces'
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m09" label="Back" />
          <h2 style={{ marginTop: 16 }}>Campaign Performance Optimization</h2>
        </div>

        <section style={heroStyle}>
          <div style={{ padding: 28 }}>
            <div style={heroPillRowStyle}>
              <HeroPill label="Campaign Intelligence" />
              <HeroPill label="Decision-friendly" />
              <HeroPill label="Scenario planning" />
            </div>
            <h1 style={heroTitleStyle}>What-If ROI Simulator</h1>
            <div style={heroTextStyle}>
              Test campaign changes and see whether they improve outcomes before making the next move.
            </div>
          </div>
        </section>

        {message && <MessageBanner message={message} />}

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={pillStyle}>Dataset</div>
              <h3 style={sectionTitleStyle}>Choose a campaign dataset</h3>
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
            <StateCard tone="error" title="Dataset loading problem">{datasetError}</StateCard>
          ) : datasets.length === 0 ? (
            <EmptyState title="No merged campaign datasets yet" text="Create a merged campaign dataset first in Campaign Data Import before using the simulator." actionLabel="Go to Campaign Data Import" onAction={goToImport} />
          ) : (
            <>
              <div style={{ marginTop: 18 }}>
                <label style={fieldLabelStyle}>Merged dataset</label>
                <select value={selectedMergedId} onChange={(event) => setSelectedMergedId(event.target.value)} style={selectStyle}>
                  {datasets.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
                </select>
              </div>
              {selectedDataset && (
                <div style={metricGridStyle}>
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
                <div style={pillStyle}>Baseline</div>
                <h3 style={sectionTitleStyle}>Choose the campaign you want to compare against</h3>
              </div>
              <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void loadBaselines()}>
                Refresh
              </button>
            </div>

            <div style={baselineToolbarStyle}>
              <FieldBlock label="Search campaigns">
                <input
                  value={baselineQuery}
                  onChange={(event) => {
                    setPage(1)
                    setBaselineQuery(event.target.value)
                  }}
                  placeholder="Search campaign name or id"
                  style={inputStyle}
                />
              </FieldBlock>
              <FieldBlock label="Channel">
                <select
                  value={baselineChannel}
                  onChange={(event) => {
                    setPage(1)
                    setBaselineChannel(event.target.value)
                  }}
                  style={selectStyle}
                >
                  <option value="">All channels</option>
                  {CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </FieldBlock>
            </div>

            {loadingBaselines ? (
              <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                <SkeletonBlock height={66} />
                <SkeletonBlock height={66} />
                <SkeletonBlock height={66} />
              </div>
            ) : baselineError ? (
              <div style={{ marginTop: 18 }}><StateCard tone="error" title="Baseline loading problem">{baselineError}</StateCard></div>
            ) : !baselineResponse || baselineResponse.items.length === 0 ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState title="No campaign baselines found" text={baselineQuery || baselineChannel ? 'Try clearing the current search or channel filter to load more campaign options.' : 'This merged dataset does not have simulator-ready campaign rows yet.'} />
              </div>
            ) : (
              <>
                <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr>
                        <th style={tableHeadStyle}>Campaign</th>
                        <th style={tableHeadStyle}>Channel</th>
                        <th style={tableHeadStyle}>Budget</th>
                        <th style={tableHeadStyle}>Contact Pressure</th>
                        <th style={tableHeadStyle}>Launch Day</th>
                        <th style={tableHeadStyle}>Time Slot</th>
                        <th style={tableHeadStyle}>Baseline ROI</th>
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
                                {selected ? 'Selected' : 'Select Baseline'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={paginationStyle}>
                  <div style={paginationInfoStyle}>Showing page {page} of {totalPages} · {baselineResponse.total} campaign rows</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" style={smallGhostButtonStyle} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                    <button className="btn-ghost" style={smallGhostButtonStyle} disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
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
                  <div style={pillStyle}>Campaign Summary</div>
                  <h3 style={sectionTitleStyle}>Current baseline snapshot</h3>
                </div>
                <StateBadge tone="neutral" label="Baseline ready" />
              </div>
              <div style={metricGridStyle}>
                <MetricTile label="Campaign" value={selectedBaseline.campaign_name || selectedBaseline.campaign_id || 'Untitled'} />
                <MetricTile label="Channel" value={selectedBaseline.channel || '--'} />
                <MetricTile label="Current spend" value={formatCurrency(selectedBaseline.spend)} />
                <MetricTile label="Contact pressure" value={`${formatCompactNumber(selectedBaseline.touches_per_user)} touches`} />
                <MetricTile label="Timing" value={`${selectedBaseline.launch_weekday || '--'} / ${selectedBaseline.launch_hour_bucket || '--'}`} />
                <MetricTile label="Current ROI" value={formatRoi(selectedBaseline.roi)} />
              </div>
            </div>

            <div style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={pillStyle}>Scenario</div>
                  <h3 style={sectionTitleStyle}>Adjust the campaign plan</h3>
                </div>
                <StateBadge tone="neutral" label="What-if inputs" />
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
                <FieldBlock label="Weekday">
                  <select value={scenario.launch_weekday} onChange={(event) => setScenario((current) => ({ ...current, launch_weekday: event.target.value }))} style={selectStyle}>
                    <option value="">Select weekday</option>
                    {WEEKDAY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
                <FieldBlock label="Hour bucket">
                  <select value={scenario.launch_hour_bucket} onChange={(event) => setScenario((current) => ({ ...current, launch_hour_bucket: event.target.value }))} style={selectStyle}>
                    <option value="">Select hour bucket</option>
                    {HOUR_BUCKET_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
                <FieldBlock label="Touches per user">
                  <input type="number" value={scenario.touches_per_user} onChange={(event) => setScenario((current) => ({ ...current, touches_per_user: event.target.value }))} style={inputStyle} min="0" step="1" />
                </FieldBlock>
              </div>

              {validationMessage && <div style={{ marginTop: 14 }}><StateCard tone="warning" title="Check the scenario inputs">{validationMessage}</StateCard></div>}
              {simulationError && <div style={{ marginTop: 14 }}><StateCard tone="error" title="Simulation issue">{simulationError}</StateCard></div>}

              <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-ghost" style={buttonGhostStyle} onClick={resetScenario}>Reset to Baseline</button>
                <button className="btn-primary" style={buttonPrimaryStyle} disabled={!!validationMessage || runningSimulation} onClick={() => void runSimulation()}>
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
                <div style={pillStyle}>Outcome</div>
                <h3 style={sectionTitleStyle}>Scenario decision summary</h3>
              </div>
              <StateBadge tone={resultTone} label={confidenceLabel} />
            </div>

            <HeadlineOutcomeCard tone={resultTone} />

            <div style={resultsGridStyle}>
              <ResultMetricCard label="Current ROI" value={formatRoi(simulationResult.baseline?.roi)} tone="neutral" />
              <ResultMetricCard label="Projected ROI" value={formatRoi(simulationResult.prediction?.predicted_roi)} tone={resultTone} />
              <ResultMetricCard label="Change" value={formatRoi(simulationResult.prediction?.delta_roi)} tone={resultTone} />
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Visual comparison</div>
                <MiniComparisonBar baseline={simulationResult.baseline?.roi ?? null} projected={simulationResult.prediction?.predicted_roi ?? null} />
              </div>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Business recommendation</div>
                <RecommendationCard tone={resultTone} text={businessRecommendation} />
              </div>
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>What changed</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {businessChangeSummary.map((item) => <ChangeSummaryRow key={item} text={item} />)}
                </div>
              </div>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Decision readout</div>
                <DecisionList tone={resultTone} />
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
  return <div><label style={fieldLabelStyle}>{label}</label>{children}</div>
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return <div style={metricTileStyle}><div style={metricTileLabelStyle}>{label}</div><div style={metricTileValueStyle}>{value}</div></div>
}

function ResultMetricCard({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'neutral' | 'negative' }) {
  const palette = tone === 'positive'
    ? { bg: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.16)', color: '#0F766E' }
    : tone === 'negative'
      ? { bg: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.16)', color: '#B42318' }
      : { bg: 'rgba(119,132,155,0.10)', border: '1px solid rgba(119,132,155,0.16)', color: '#44556F' }
  return (
    <div style={{ borderRadius: 20, padding: 18, background: palette.bg, border: palette.border }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: palette.color }}>{label}</div>
      <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.05, fontWeight: 900, color: palette.color }}>{value}</div>
    </div>
  )
}

function HeadlineOutcomeCard({ tone }: { tone: 'positive' | 'neutral' | 'negative' }) {
  const config = tone === 'positive'
    ? { title: 'Likely improvement', text: 'This scenario looks stronger than the current baseline and may be worth testing next.', color: '#0F766E', bg: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.18)', icon: '↑' }
    : tone === 'negative'
      ? { title: 'Likely decline', text: 'This scenario looks weaker than the current baseline and may not be the best next move.', color: '#B42318', bg: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.16)', icon: '↓' }
      : { title: 'Minimal change', text: 'This scenario looks broadly similar to the current baseline, so impact may be limited.', color: '#9A6700', bg: 'rgba(180,120,32,0.08)', border: '1px solid rgba(180,120,32,0.16)', icon: '–' }
  return (
    <div style={{ marginTop: 18, borderRadius: 20, padding: 20, background: config.bg, border: config.border, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: config.color }}>{config.title}</div>
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: config.color, maxWidth: 720 }}>{config.text}</div>
      </div>
      <div style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.36)', fontSize: 28, fontWeight: 900, color: config.color }}>{config.icon}</div>
    </div>
  )
}

function MiniComparisonBar({ baseline, projected }: { baseline: number | null; projected: number | null }) {
  const max = Math.max(Math.abs(baseline ?? 0), Math.abs(projected ?? 0), 0.1)
  const baselineWidth = `${Math.max(8, (Math.abs(baseline ?? 0) / max) * 100)}%`
  const projectedWidth = `${Math.max(8, (Math.abs(projected ?? 0) / max) * 100)}%`
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <MiniBarRow label="Current ROI" value={formatRoi(baseline)} width={baselineWidth} fill="linear-gradient(90deg, #7B8CA9 0%, #9FB1C6 100%)" />
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
      <div style={miniBarTrackStyle}><div style={{ width, height: '100%', borderRadius: 999, background: fill }} /></div>
    </div>
  )
}

function RecommendationCard({ tone, text }: { tone: 'positive' | 'neutral' | 'negative'; text: string }) {
  const palette = tone === 'positive'
    ? { bg: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.16)', color: '#0F766E', label: 'Recommended next read' }
    : tone === 'negative'
      ? { bg: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.16)', color: '#B42318', label: 'Caution signal' }
      : { bg: 'rgba(180,120,32,0.08)', border: '1px solid rgba(180,120,32,0.16)', color: '#9A6700', label: 'Measured readout' }
  return (
    <div style={{ borderRadius: 18, padding: 18, background: palette.bg, border: palette.border }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: palette.color }}>{palette.label}</div>
      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: palette.color }}>{text}</div>
    </div>
  )
}

function ChangeSummaryRow({ text }: { text: string }) {
  return <div style={{ borderRadius: 16, padding: 14, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(249,251,253,0.9)', fontSize: 13, lineHeight: 1.65, color: '#415274' }}>{text}</div>
}

function DecisionList({ tone }: { tone: 'positive' | 'neutral' | 'negative' }) {
  const items = tone === 'positive'
    ? ['ROI is trending above the current baseline.', 'The scenario looks worth testing in a live campaign plan.', 'Use Dev Tools if you need the technical confidence details.']
    : tone === 'negative'
      ? ['ROI is trending below the current baseline.', 'This change may weaken performance if applied broadly.', 'Review the scenario carefully before prioritizing it.']
      : ['The scenario is close to the current baseline.', 'Impact may be limited without a bigger adjustment.', 'Treat this as a small iteration rather than a major shift.']
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: tone === 'positive' ? '#0F766E' : tone === 'negative' ? '#B42318' : '#9A6700', marginTop: 7, flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#415274' }}>{item}</div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyPillStyle}>Empty State</div>
      <h3 style={{ margin: '14px 0 8px', fontSize: 24, color: '#0B2540' }}>{title}</h3>
      <div style={{ maxWidth: 760, fontSize: 14, lineHeight: 1.75, color: '#415274' }}>{text}</div>
      {actionLabel && onAction && <div style={{ marginTop: 16 }}><button className="btn-primary" style={buttonPrimaryStyle} onClick={onAction}>{actionLabel}</button></div>}
    </div>
  )
}

function StateCard({ title, tone, children }: { title: string; tone: 'warning' | 'error'; children: React.ReactNode }) {
  const palette = tone === 'warning'
    ? { bg: 'rgba(180,120,32,0.10)', border: '1px solid rgba(180,120,32,0.18)', color: '#9A6700' }
    : { bg: 'rgba(190,24,93,0.10)', border: '1px solid rgba(190,24,93,0.18)', color: '#9D174D' }
  return <div style={{ borderRadius: 18, padding: 16, background: palette.bg, border: palette.border, color: palette.color }}><div style={{ fontSize: 15, fontWeight: 900 }}>{title}</div><div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>{children}</div></div>
}

function StateBadge({ tone, label }: { tone: 'positive' | 'neutral' | 'negative'; label: string }) {
  const palette = tone === 'positive'
    ? { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' }
    : tone === 'negative'
      ? { bg: 'rgba(180,35,24,0.12)', color: '#B42318' }
      : { bg: 'rgba(119,132,155,0.12)', color: '#44556F' }
  return <span style={{ display: 'inline-flex', padding: '7px 11px', borderRadius: 999, background: palette.bg, color: palette.color, fontSize: 12, fontWeight: 800 }}>{label}</span>
}

function MessageBanner({ message }: { message: { type: 'info' | 'error' | 'success'; text: string } }) {
  const palette = message.type === 'error'
    ? { bg: 'rgba(190,24,93,0.10)', border: '1px solid rgba(190,24,93,0.18)', color: '#9D174D' }
    : message.type === 'success'
      ? { bg: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.18)', color: '#0F766E' }
      : { bg: 'rgba(36,83,166,0.10)', border: '1px solid rgba(36,83,166,0.18)', color: '#2453A6' }
  return <section style={{ marginTop: 18, borderRadius: 16, padding: 14, fontSize: 13, lineHeight: 1.7, background: palette.bg, border: palette.border, color: palette.color }}>{message.text}</section>
}

const heroStyle: React.CSSProperties = { marginTop: 18, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 20px 46px rgba(13,30,60,0.08)', background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)', color: '#fff' }
const heroPillRowStyle: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const heroPillStyle: React.CSSProperties = { display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }
const heroTitleStyle: React.CSSProperties = { margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }
const heroTextStyle: React.CSSProperties = { maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }
const panelStyle: React.CSSProperties = { marginTop: 18, borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.06)' }
const subPanelStyle: React.CSSProperties = { borderRadius: 18, padding: 18, background: 'rgba(252,253,255,0.96)', border: '1px solid rgba(15,66,88,0.08)' }
const twoColumnSectionStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }
const resultsGridStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }
const metricGridStyle: React.CSSProperties = { marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }
const baselineToolbarStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(260px, 1.4fr) minmax(220px, 0.8fr)', gap: 14 }
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18 }
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
const tableHeadStyle: React.CSSProperties = { textAlign: 'left', fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', background: 'rgba(244,248,252,0.95)' }
const tableCellStyle: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', fontSize: 13, color: '#415274', verticalAlign: 'top' }
const strongCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#0B2540', fontWeight: 800 }
const subtleCellTextStyle: React.CSSProperties = { marginTop: 4, fontSize: 12, color: '#5B6C8B', fontWeight: 500 }
const selectedRowStyle: React.CSSProperties = { background: 'rgba(36,83,166,0.06)' }
const selectedCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const selectedStrongCellStyle: React.CSSProperties = { ...strongCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const paginationStyle: React.CSSProperties = { marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
const paginationInfoStyle: React.CSSProperties = { fontSize: 13, color: '#5B6C8B' }
const emptyStateStyle: React.CSSProperties = { borderRadius: 20, padding: 24, background: 'linear-gradient(180deg, rgba(247,250,253,0.98), rgba(255,255,255,1))', border: '1px dashed rgba(15,66,88,0.18)' }
const emptyPillStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const miniBarTrackStyle: React.CSSProperties = { width: '100%', height: 10, borderRadius: 999, background: 'rgba(219,227,235,0.8)', overflow: 'hidden' }

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ height, borderRadius: 18, background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))', border: '1px solid rgba(15,66,88,0.06)' }} />
}
