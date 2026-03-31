import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface CampaignMonth {
  campaign_id: number;
  month: Date;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  fatigue_score: number;
  engagement_index: number;
  avg_touch_frequency: number;
  audience_size: number;
  cost_per_conversion: number;
  cpc: number;
  seasonality_factor: number;
  previous_month_revenue: number;
  previous_month_roi: number;
  viral_spike: number;
  crash_drop: number;
  lag_factor: number;
}

export interface ForecastRequest {
  horizonMonths: number;
  spendMultiplier: number;
}

export interface ForecastPoint {
  month: string; // YYYY-MM
  spend: number;
  revenue: number;
  roi: number;
}

export interface ForecastResult {
  ok: true;
  history: CampaignMonth[];
  baselineROI: number;
  forecast: ForecastPoint[];
  explanation: string;
}

let cachedData: CampaignMonth[] | null = null;

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function loadDatasetOnce(): CampaignMonth[] {
  if (cachedData) return cachedData;

  const csvPath = path.join(
    process.cwd(),
    'apps',
    'ml',
    'm06',
    'full_marketing_forecast_dataset.csv',
  );

  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  cachedData = records.map((row) => {
    const monthStr = row.month ?? '';
    const monthDate = new Date(monthStr || '1970-01-01');

    return {
      campaign_id: toNumber(row.campaign_id),
      month: monthDate,
      channel: String(row.channel || ''),
      spend: toNumber(row.spend),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      conversions: toNumber(row.conversions),
      revenue: toNumber(row.revenue),
      roi: toNumber(row.roi),
      fatigue_score: toNumber(row.fatigue_score),
      engagement_index: toNumber(row.engagement_index),
      avg_touch_frequency: toNumber(row.avg_touch_frequency),
      audience_size: toNumber(row.audience_size),
      cost_per_conversion: toNumber(row.cost_per_conversion),
      cpc: toNumber(row.cpc),
      seasonality_factor: toNumber(row.seasonality_factor),
      previous_month_revenue: toNumber(row.previous_month_revenue),
      previous_month_roi: toNumber(row.previous_month_roi),
      viral_spike: toNumber(row.viral_spike),
      crash_drop: toNumber(row.crash_drop),
      lag_factor: toNumber(row.lag_factor),
    };
  });

  return cachedData;
}

export function runForecast(input: ForecastRequest): ForecastResult {
  const data = loadDatasetOnce();
  const horizon = Math.max(1, Math.min(24, input.horizonMonths));
  const spendMult = input.spendMultiplier || 1;

  // Simple baseline: overall ROI as revenue / spend
  const totalSpend = data.reduce((s, r) => s + r.spend, 0);
  const totalRev = data.reduce((s, r) => s + r.revenue, 0);
  const baselineROI = totalSpend === 0 ? 0 : (totalRev - totalSpend) / (totalSpend || 1) * 100;

  // Use last month in dataset as anchor
  const sorted = [...data].sort((a, b) => a.month.getTime() - b.month.getTime());
  const last = sorted[sorted.length - 1] ?? sorted[0];
  const baseMonth = last?.month ?? new Date('1970-01-01');
  const startYear = baseMonth.getFullYear();
  const startMonth = baseMonth.getMonth(); // 0-based

  const avgMonthlySpend = totalSpend / (sorted.length || 1);
  const avgMonthlyRevenue = totalRev / (sorted.length || 1);

  const forecast: ForecastPoint[] = [];
  for (let k = 1; k <= horizon; k++) {
    const d = new Date(startYear, startMonth + k, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const spend = avgMonthlySpend * spendMult;
    const revenue = avgMonthlyRevenue * spendMult;
    const roi = spend === 0 ? 0 : (revenue - spend) / (spend || 1) * 100;
    forecast.push({ month: label, spend, revenue, roi });
  }

  const explanation = `Forecast based on ${sorted.length} historical campaign-months. ` +
    `Baseline ROI is ${baselineROI.toFixed(1)}%. Scenario multiplies spend by ${spendMult.toFixed(2)} over ${horizon} months.`;

  return {
    ok: true,
    history: sorted,
    baselineROI,
    forecast,
    explanation,
  };
}
