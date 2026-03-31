import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useWorkspaceId } from '../../utils/workspace';
import './module6.css';
import BarChart from './BarChart';
import TimelineChart from './TimelineChart';
// Note: Temporarily using fixed channel list to align with agent CSV

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type ForecastWindowKey = '1m' | '3m' | '6m';

interface AgentResult {
  history: Array<{ month: string; roi: number; ma3?: number; ma6?: number }>;
  forecast: Array<{
    month: string;
    baseline_roi: number;
    scenario_roi: number;
    confidence_low: number;
    confidence_high: number;
  }>;
  baselineROI: number;
  scenarioROI: number;
  confidenceLow: number;
  confidenceHigh: number;
  trend: string;
  volatility: number;
  seasonality: number;
  explanation: string;
}

const WINDOW_OPTIONS: { key: ForecastWindowKey; label: string }[] = [
  { key: '1m', label: '1 month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
];

function formatPct(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return `${Math.round(v)}%`;
}

function formatNumber(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return (Math.round(v * 100) / 100).toLocaleString();
}

export default function ForecastPage() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });
  const BASIC_CHANNELS: Array<{ id: string; name: string }> = [
    { id: 'email', name: 'Email' },
    { id: 'ads', name: 'Ads' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'webinar', name: 'Webinar' },
  ];
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(BASIC_CHANNELS[0].id);
  const [windowKey, setWindowKey] = useState<ForecastWindowKey>('3m');
  const [multiplier, setMultiplier] = useState<number>(1.0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);

  // No remote fetch: use fixed basic channels only for now
  useEffect(() => {
    // Ensure a default is set
    if (!selectedCampaignId) setSelectedCampaignId(BASIC_CHANNELS[0].id);
  }, []);

  async function generateForecast() {
    if (!selectedCampaignId) {
      setError('Please select a campaign to forecast.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        campaign_channel: selectedCampaignId,
        forecast_window: windowKey,
        spend_multiplier: multiplier,
      };
      const res = await fetch(`${API_BASE}/m06/forecast-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json) {
        setError(json && json.error ? String(json.error) : 'Forecast request failed.');
        return;
      }
      if (!json.ok) {
        setError(json.error ? String(json.error) : 'Forecast agent was unable to generate a forecast.');
      }
      const r = json.result || {};
      const mapped: AgentResult = {
        history: Array.isArray(r.history) ? r.history : [],
        forecast: Array.isArray(r.forecast) ? r.forecast : [],
        baselineROI: typeof r.baselineROI === 'number' ? r.baselineROI : (typeof r.baseline_roi === 'number' ? r.baseline_roi : 0),
        scenarioROI: typeof r.scenarioROI === 'number' ? r.scenarioROI : (typeof r.scenario_roi === 'number' ? r.scenario_roi : 0),
        confidenceLow: typeof r.confidenceLow === 'number' ? r.confidenceLow : (typeof r.confidence_low === 'number' ? r.confidence_low : 0),
        confidenceHigh: typeof r.confidenceHigh === 'number' ? r.confidenceHigh : (typeof r.confidence_high === 'number' ? r.confidence_high : 0),
        trend: typeof r.trend === 'string' ? r.trend : 'flat',
        volatility: typeof r.volatility === 'number' ? r.volatility : 0,
        seasonality: typeof r.seasonality === 'number' ? r.seasonality : 0,
        explanation: typeof r.explanation === 'string' ? r.explanation : 'Forecast results from Python agent.',
      };
      setResult(mapped);
    } catch (e) {
      setError('Network error while calling forecast agent.');
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!result) return;
    const rows = result.forecast || [];
    if (!rows.length) return;
    const header = ['month', 'baseline_roi', 'scenario_roi', 'confidence_low', 'confidence_high'];
    const body = rows
      .map((r) =>
        [
          r.month,
          String(r.baseline_roi ?? ''),
          String(r.scenario_roi ?? ''),
          String(r.confidence_low ?? ''),
          String(r.confidence_high ?? ''),
        ].join(','),
      )
      .join('\n');
    const csv = header.join(',') + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${workspaceId || 'workspace'}-${selectedCampaignId || 'campaign'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const timelineData = useMemo(() => {
    if (!result || !result.history || result.history.length === 0) return [];
    return result.history.map((h) => ({ month: h.month, total: h.roi }));
  }, [result]);

  const comparisonData = useMemo(() => {
    if (!result) return [];
    return [
      { label: 'Baseline', value: result.baselineROI || 0 },
      { label: 'Scenario', value: result.scenarioROI || 0 },
    ];
  }, [result]);

  const heatmapYears = useMemo(() => {
    if (!result || !result.history || result.history.length === 0) return [] as string[];
    const years = new Set<string>();
    result.history.forEach((h) => {
      const y = (h.month || '').split('-')[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort();
  }, [result]);

  function roiToColor(roi: number | null | undefined) {
    if (roi === null || roi === undefined || Number.isNaN(roi)) return '#f0f4f7';
    const clamped = Math.max(-50, Math.min(150, roi));
    const norm = (clamped + 50) / 200; // 0..1 from -50..150
    const hue = 0 + (120 - 0) * norm; // red->green
    return `hsl(${hue},70%,60%)`;
  }

  function getRoiForYearMonth(year: string, monthIdx: number): number | null {
    if (!result || !result.history) return null;
    const mStr = String(monthIdx + 1).padStart(2, '0');
    const key = `${year}-${mStr}`;
    const row = result.history.find((h) => h.month === key);
    return row ? row.roi : null;
  }

  // Using channel selection only; no campaign lookup for now

  return (
    <Layout>
      <main className="page-root m06-page">
        <div style={{ marginTop: 8 }}>
          <ModuleBackButton toSuffix="/m06" label="Module 6 Home" />
        </div>
        <section className="m06-hero">
          <div className="m06-hero-inner">
            <div className="m06-pill">Forecasts</div>
            <h1>ROI Forecast Explorer</h1>
            <div className="m06-hero-copy">
              Test spend scenarios by channel, compare expected ROI shifts, and export the generated forecast without changing campaign or attribution data.
            </div>
          </div>
        </section>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 2 }}>
            <div className="m06-panel">
              <div className="m06-section-label">Scenario Setup</div>
              <h3 className="m06-panel-title" style={{ marginTop: 12 }}>Forecast ROI by channel</h3>
              <div className="m06-helper" style={{ marginBottom: 14 }}>
                Run scenario-based ROI forecasts for a selected channel using the Python forecasting agent.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666' }}>Channel</div>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    style={{ minWidth: 220 }}
                  >
                    {BASIC_CHANNELS.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666' }}>Forecast window</div>
                  <select
                    value={windowKey}
                    onChange={(e) => setWindowKey(e.target.value as ForecastWindowKey)}
                  >
                    {WINDOW_OPTIONS.map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666' }}>Spend multiplier ({multiplier.toFixed(2)}x)</div>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={multiplier}
                    onChange={(e) => setMultiplier(Number(e.target.value))}
                    style={{ width: 160 }}
                  />
                </div>
                <div>
                  <button
                    className="btn-primary"
                    onClick={generateForecast}
                    disabled={loading || !selectedCampaignId}
                  >
                    {loading ? 'Generating…' : 'Generate Forecast'}
                  </button>
                </div>
              </div>
              {error && (
                <div style={{ marginTop: 8, color: 'crimson', fontSize: 12 }}>{error}</div>
              )}
            </div>

            {!result && !loading && !error && (
              <div className="m06-panel soft" style={{ marginTop: 16 }}>
                <div className="m06-section-label">How To Use</div>
                <h3 className="m06-panel-title" style={{ marginTop: 12 }}>What this screen is for</h3>
                <div className="m06-helper">
                  Start with a channel, choose a short or medium forecast window, then adjust the spend multiplier to see how ROI might shift before making budget decisions.
                </div>
              </div>
            )}

            {result && (
              <>
                {/* KPI cards */}
                <div className="summary-metrics" style={{ marginTop: 16 }}>
                  <div className="summary-card">
                    <h5>Baseline ROI</h5>
                    <div className="value">{formatPct(result.baselineROI)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Scenario ROI</h5>
                    <div className="value">{formatPct(result.scenarioROI)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Trend</h5>
                    <div className="value">
                      {result.trend === 'upward' ? '↑ Upward' : result.trend === 'downward' ? '↓ Downward' : '→ Flat'}
                    </div>
                  </div>
                  <div className="summary-card">
                    <h5>Seasonality</h5>
                    <div className="value">{formatNumber(result.seasonality)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Volatility</h5>
                    <div className="value">{formatNumber(result.volatility)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Confidence Range</h5>
                    <div className="value">
                      {formatPct(result.confidenceLow)} – {formatPct(result.confidenceHigh)}
                    </div>
                  </div>
                </div>

                {/* ROI line / timeline chart */}
                <div className="m06-panel" style={{ marginTop: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Historical ROI</div>
                  <TimelineChart data={timelineData} />
                </div>

                {/* Scenario comparison bar chart */}
                <div className="m06-panel" style={{ marginTop: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Scenario Comparison</div>
                  <BarChart data={comparisonData} height={140} />
                </div>

                {/* Heatmap */}
                <div className="m06-panel soft" style={{ marginTop: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Historical ROI Heatmap</div>
                  {heatmapYears.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#666' }}>No history found for this campaign.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: 4, fontSize: 11, textAlign: 'left' }}>Year</th>
                            {Array.from({ length: 12 }).map((_, idx) => (
                              <th key={idx} style={{ padding: 4, fontSize: 11 }}>{idx + 1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmapYears.map((y) => (
                            <tr key={y}>
                              <td style={{ padding: 4, fontSize: 11 }}>{y}</td>
                              {Array.from({ length: 12 }).map((_, idx) => {
                                const roi = getRoiForYearMonth(y, idx);
                                return (
                                  <td key={idx} style={{ padding: 0 }}>
                                    <div
                                      style={{
                                        width: 26,
                                        height: 22,
                                        background: roiToColor(roi || 0),
                                        borderRadius: 4,
                                        fontSize: 9,
                                        color: '#022',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                      title={roi === null ? 'No data' : `${roi.toFixed(1)}%`}
                                    >
                                      {roi === null ? '' : Math.round(roi)}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Agent explanation and download */}
                <div style={{ marginTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 260 }}>
                    <div className="summary-card">
                      <h5>Agent Explanation</h5>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#2d2f45', whiteSpace: 'pre-wrap' }}>
                        {result.explanation}
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="summary-card">
                      <h5>Downloads</h5>
                      <div style={{ marginTop: 10 }}>
                        <button className="btn-primary" onClick={downloadCSV} disabled={!result.forecast.length}>
                          Download Forecast CSV
                        </button>
                        <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
                          Includes baseline and scenario ROI plus confidence bounds per month.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!loading && !result && !error && (
              <div style={{ marginTop: 18, fontSize: 13, color: '#666' }}>
                Select a channel and click <strong>Generate Forecast</strong> to view projected ROI.
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="summary-card">
              <h5>Selection Context</h5>
              <div style={{ marginTop: 8, fontSize: 13, color: '#2d2f45' }}>
                <div><strong>Channel:</strong> {selectedCampaignId}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }} className="summary-card">
              <h5>Tips</h5>
              <ul style={{ margin: 0, marginTop: 8, paddingLeft: 16, fontSize: 12, color: '#4d4f67' }}>
                <li>Try 3 or 6 month windows to see medium-term patterns.</li>
                <li>Use higher spend multipliers to stress-test ROI sensitivity.</li>
                <li>Watch volatility and seasonality before committing big budget shifts.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
