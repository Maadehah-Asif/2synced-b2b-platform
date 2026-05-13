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

export default function Module9WhatIfDevToolsPage() {
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
  } = useModule9Simulator()

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m09" label="Back" />
          <h2 style={{ marginTop: 16 }}>Module 9</h2>
        </div>

        <section style={heroStyle}>
          <div style={{ padding: 28 }}>
            <div style={heroPillRowStyle}>
              <HeroPill label="Module 9" />
              <HeroPill label="Technical validation" />
              <HeroPill label="Scenario inspection" />
            </div>
            <h1 style={heroTitleStyle}>What-If Dev Tools</h1>
            <div style={heroTextStyle}>
              Inspect model confidence, metrics, and technical scenario details for validation and tuning.
            </div>
          </div>
        </section>

        {message && <MessageBanner message={message} />}

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={pillStyle}>Scenario Setup</div>
              <h3 style={sectionTitleStyle}>Reuse the simulator flow for technical inspection</h3>
            </div>
            <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void loadDatasets()}>
              Refresh datasets
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
            <StateCard tone="warning" title="No merged datasets available">Create a merged Module 9 dataset first, then return here to inspect technical simulator details.</StateCard>
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
                  <MetricTile label="Duplicates" value={String(selectedDataset.duplicateCount || 0)} />
                  <MetricTile label="Created" value={selectedDataset.createdAt ? new Date(selectedDataset.createdAt).toLocaleDateString() : '--'} />
                </div>
              )}

              <div style={baselineToolbarStyle}>
                <FieldBlock label="Search baseline">
                  <input value={baselineQuery} onChange={(event) => { setPage(1); setBaselineQuery(event.target.value) }} placeholder="Search campaign name or id" style={inputStyle} />
                </FieldBlock>
                <FieldBlock label="Channel">
                  <select value={baselineChannel} onChange={(event) => { setPage(1); setBaselineChannel(event.target.value) }} style={selectStyle}>
                    <option value="">All channels</option>
                    {CHANNEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FieldBlock>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void loadBaselines()}>
                  Refresh baselines
                </button>
              </div>

              {loadingBaselines ? (
                <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                  <SkeletonBlock height={66} />
                  <SkeletonBlock height={66} />
                </div>
              ) : baselineError ? (
                <div style={{ marginTop: 18 }}><StateCard tone="error" title="Baseline loading problem">{baselineError}</StateCard></div>
              ) : baselineResponse && baselineResponse.items.length > 0 ? (
                <>
                  <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                      <thead>
                        <tr>
                          <th style={tableHeadStyle}>Campaign</th>
                          <th style={tableHeadStyle}>Channel</th>
                          <th style={tableHeadStyle}>Spend</th>
                          <th style={tableHeadStyle}>Touches</th>
                          <th style={tableHeadStyle}>ROI</th>
                          <th style={tableHeadStyle}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baselineResponse.items.map((item) => {
                          const selected = selectedBaseline?.rowId === item.rowId
                          return (
                            <tr key={item.rowId} style={selected ? selectedRowStyle : undefined}>
                              <td style={selected ? selectedStrongCellStyle : strongCellStyle}>{item.campaign_name || item.campaign_id || 'Untitled campaign'}</td>
                              <td style={selected ? selectedCellStyle : tableCellStyle}>{item.channel || '--'}</td>
                              <td style={selected ? selectedCellStyle : tableCellStyle}>{formatCurrency(item.spend)}</td>
                              <td style={selected ? selectedCellStyle : tableCellStyle}>{formatCompactNumber(item.touches_per_user)}</td>
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
                    <div style={paginationInfoStyle}>Showing page {page} of {totalPages}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" style={smallGhostButtonStyle} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                      <button className="btn-ghost" style={smallGhostButtonStyle} disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>

        {selectedBaseline && (
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={pillStyle}>Scenario Inputs</div>
                <h3 style={sectionTitleStyle}>Run a technical scenario check</h3>
              </div>
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
                {runningSimulation ? 'Running Simulation...' : 'Run Technical Simulation'}
              </button>
            </div>
          </section>
        )}

        {simulationResult && (
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={pillStyle}>Technical Output</div>
                <h3 style={sectionTitleStyle}>Model and response inspection</h3>
              </div>
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Model metrics</div>
                <MetricList
                  items={[
                    ['Model type', simulationResult.model?.model_type || '--'],
                    ['MAE', formatCompactNumber(simulationResult.model?.mae)],
                    ['RMSE', formatCompactNumber(simulationResult.model?.rmse)],
                    ['R²', formatCompactNumber(simulationResult.model?.r2)],
                  ]}
                />
              </div>

              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Backend explanation</div>
                <div style={inspectorBoxStyle}>{simulationResult.explanation || 'No backend explanation returned.'}</div>
              </div>
            </div>

            <div style={twoColumnSectionStyle}>
              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Scenario response inspector</div>
                <MetricList
                  items={[
                    ['Baseline campaign', simulationResult.baseline?.campaign_name || '--'],
                    ['Baseline ROI', formatRoi(simulationResult.baseline?.roi)],
                    ['Projected ROI', formatRoi(simulationResult.prediction?.predicted_roi)],
                    ['Raw delta', formatRoi(simulationResult.prediction?.delta_roi)],
                  ]}
                />
              </div>

              <div style={subPanelStyle}>
                <div style={subSectionTitleStyle}>Request payload</div>
                <div style={inspectorGridStyle}>
                  <InspectorRow label="Spend" value={scenario.spend || '--'} />
                  <InspectorRow label="Channel" value={scenario.channel || '--'} />
                  <InspectorRow label="Weekday" value={scenario.launch_weekday || '--'} />
                  <InspectorRow label="Hour bucket" value={scenario.launch_hour_bucket || '--'} />
                  <InspectorRow label="Touches per user" value={scenario.touches_per_user || '--'} />
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
  return <div><label style={fieldLabelStyle}>{label}</label>{children}</div>
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return <div style={metricTileStyle}><div style={metricTileLabelStyle}>{label}</div><div style={metricTileValueStyle}>{value}</div></div>
}

function MetricList({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map(([label, value]) => (
        <div key={label} style={metricListRowStyle}>
          <div style={metricListLabelStyle}>{label}</div>
          <div style={metricListValueStyle}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return <div style={metricListRowStyle}><div style={metricListLabelStyle}>{label}</div><div style={metricListValueStyle}>{value}</div></div>
}

function StateCard({ title, tone, children }: { title: string; tone: 'warning' | 'error'; children: React.ReactNode }) {
  const palette = tone === 'warning'
    ? { bg: 'rgba(180,120,32,0.10)', border: '1px solid rgba(180,120,32,0.18)', color: '#9A6700' }
    : { bg: 'rgba(190,24,93,0.10)', border: '1px solid rgba(190,24,93,0.18)', color: '#9D174D' }
  return <div style={{ borderRadius: 18, padding: 16, background: palette.bg, border: palette.border, color: palette.color }}><div style={{ fontSize: 15, fontWeight: 900 }}>{title}</div><div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>{children}</div></div>
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
const metricListRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(15,66,88,0.08)' }
const metricListLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#5B6C8B' }
const metricListValueStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#0B2540' }
const inspectorBoxStyle: React.CSSProperties = { borderRadius: 16, padding: 14, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(249,251,253,0.9)', fontSize: 13, lineHeight: 1.75, color: '#415274' }
const inspectorGridStyle: React.CSSProperties = { display: 'grid', gap: 10 }
const tableHeadStyle: React.CSSProperties = { textAlign: 'left', fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', background: 'rgba(244,248,252,0.95)' }
const tableCellStyle: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', fontSize: 13, color: '#415274', verticalAlign: 'top' }
const strongCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#0B2540', fontWeight: 800 }
const selectedRowStyle: React.CSSProperties = { background: 'rgba(36,83,166,0.06)' }
const selectedCellStyle: React.CSSProperties = { ...tableCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const selectedStrongCellStyle: React.CSSProperties = { ...strongCellStyle, color: '#1C4075', background: 'rgba(36,83,166,0.03)' }
const paginationStyle: React.CSSProperties = { marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
const paginationInfoStyle: React.CSSProperties = { fontSize: 13, color: '#5B6C8B' }

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ height, borderRadius: 18, background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))', border: '1px solid rgba(15,66,88,0.06)' }} />
}
