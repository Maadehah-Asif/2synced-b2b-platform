/**
 * Module: Intent Signals (m02)
 * Layer: Backend
 * File: forecasting.ts
 * Purpose: Supports the f or ec as ti ng flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

type IntentForecastRow = {
  month: string;
  segment: string;
  industry: string;
  avg_intent_score: number;
  high_intent_rate: number;
  engaged_leads: number;
  surging_leads: number;
  dormant_leads: number;
  cold_rate: number;
  warm_rate: number;
  hot_rate: number;
  blazing_rate: number;
};

export type M02DatasetForecastRequest = {
  segment?: string;
  industry?: string;
  horizonMonths: number;
};

function datasetPath() {
  return path.join(process.cwd(), 'src', 'modules', 'm02', 'data', 'intent_forecast_dataset.csv');
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function loadRows(): IntentForecastRow[] {
  const csvPath = datasetPath();
  if (!fs.existsSync(csvPath)) {
    throw new Error(`missing_dataset:${csvPath}`);
  }
  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  return records.map((row) => ({
    month: String(row.month || ''),
    segment: String(row.segment || ''),
    industry: String(row.industry || ''),
    avg_intent_score: toNumber(row.avg_intent_score),
    high_intent_rate: toNumber(row.high_intent_rate),
    engaged_leads: toNumber(row.engaged_leads),
    surging_leads: toNumber(row.surging_leads),
    dormant_leads: toNumber(row.dormant_leads),
    cold_rate: toNumber(row.cold_rate),
    warm_rate: toNumber(row.warm_rate),
    hot_rate: toNumber(row.hot_rate),
    blazing_rate: toNumber(row.blazing_rate),
  }));
}

function slope(values: number[]) {
  if (values.length < 2) return 0;
  const x = values.map((_, index) => index);
  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += (x[index]! - xMean) * (values[index]! - yMean);
    denominator += (x[index]! - xMean) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function addMonths(label: string, offset: number) {
  const [year, month] = label.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function aggregate(rows: IntentForecastRow[]) {
  const grouped = new Map<string, { month: string; scoreSum: number; highRateSum: number; engaged: number; surging: number; dormant: number; coldSum: number; warmSum: number; hotSum: number; blazingSum: number; count: number }>();
  for (const row of rows) {
    const current = grouped.get(row.month) || {
      month: row.month,
      scoreSum: 0,
      highRateSum: 0,
      engaged: 0,
      surging: 0,
      dormant: 0,
      coldSum: 0,
      warmSum: 0,
      hotSum: 0,
      blazingSum: 0,
      count: 0,
    };
    current.scoreSum += row.avg_intent_score;
    current.highRateSum += row.high_intent_rate;
    current.engaged += row.engaged_leads;
    current.surging += row.surging_leads;
    current.dormant += row.dormant_leads;
    current.coldSum += row.cold_rate;
    current.warmSum += row.warm_rate;
    current.hotSum += row.hot_rate;
    current.blazingSum += row.blazing_rate;
    current.count += 1;
    grouped.set(row.month, current);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      month: row.month,
      avgIntentScore: Number((row.scoreSum / row.count).toFixed(2)),
      highIntentRate: Number((row.highRateSum / row.count).toFixed(2)),
      engagedLeads: row.engaged,
      surgingLeads: row.surging,
      dormantLeads: row.dormant,
      coldRate: Number((row.coldSum / row.count).toFixed(2)),
      warmRate: Number((row.warmSum / row.count).toFixed(2)),
      hotRate: Number((row.hotSum / row.count).toFixed(2)),
      blazingRate: Number((row.blazingSum / row.count).toFixed(2)),
    }));
}

export function getM02ForecastFilters() {
  const rows = loadRows();
  return {
    segments: Array.from(new Set(rows.map((row) => row.segment))).sort(),
    industries: Array.from(new Set(rows.map((row) => row.industry))).sort(),
    datasetPath: datasetPath(),
  };
}

export function runM02DatasetForecast(input: M02DatasetForecastRequest) {
  const rows = loadRows().filter((row) => {
    if (input.segment && row.segment !== input.segment) return false;
    if (input.industry && row.industry !== input.industry) return false;
    return true;
  });
  const history = aggregate(rows);
  if (!history.length) {
    return {
      ok: true,
      history: [],
      forecast: [],
      kpis: {
        latestAvgIntentScore: 0,
        latestHighIntentRate: 0,
        latestDormantLeads: 0,
        projectedAvgIntentScore: 0,
      },
      explanation: 'No module 2 forecast rows matched the selected filters.',
    };
  }

  const horizon = Math.max(1, Math.min(12, input.horizonMonths || 3));
  const scoreSlope = slope(history.map((row) => row.avgIntentScore).slice(-6));
  const highSlope = slope(history.map((row) => row.highIntentRate).slice(-6));
  const surgingSlope = slope(history.map((row) => row.surgingLeads).slice(-6));
  const dormantSlope = slope(history.map((row) => row.dormantLeads).slice(-6));
  const coldSlope = slope(history.map((row) => row.coldRate).slice(-6));
  const warmSlope = slope(history.map((row) => row.warmRate).slice(-6));
  const hotSlope = slope(history.map((row) => row.hotRate).slice(-6));
  const blazingSlope = slope(history.map((row) => row.blazingRate).slice(-6));
  const last = history[history.length - 1]!;

  const forecast = Array.from({ length: horizon }, (_, index) => {
    const step = index + 1;
    return {
      month: addMonths(last.month, step),
      projectedAvgIntentScore: Number(Math.max(0, Math.min(100, last.avgIntentScore + scoreSlope * step)).toFixed(2)),
      projectedHighIntentRate: Number(Math.max(0, Math.min(100, last.highIntentRate + highSlope * step)).toFixed(2)),
      projectedSurgingLeads: Math.max(0, Math.round(last.surgingLeads + surgingSlope * step)),
      projectedDormantLeads: Math.max(0, Math.round(last.dormantLeads + dormantSlope * step)),
      projectedColdRate: Number(Math.max(0, Math.min(100, last.coldRate + coldSlope * step)).toFixed(2)),
      projectedWarmRate: Number(Math.max(0, Math.min(100, last.warmRate + warmSlope * step)).toFixed(2)),
      projectedHotRate: Number(Math.max(0, Math.min(100, last.hotRate + hotSlope * step)).toFixed(2)),
      projectedBlazingRate: Number(Math.max(0, Math.min(100, last.blazingRate + blazingSlope * step)).toFixed(2)),
    };
  });

  return {
    ok: true,
    history,
    forecast,
    kpis: {
      latestAvgIntentScore: last.avgIntentScore,
      latestHighIntentRate: last.highIntentRate,
      latestDormantLeads: last.dormantLeads,
      projectedAvgIntentScore: forecast[0]?.projectedAvgIntentScore ?? last.avgIntentScore,
    },
    explanation: `Intent forecast uses ${history.length} month buckets${input.segment ? ` for segment=${input.segment}` : ''}${input.industry ? ` and industry=${input.industry}` : ''}. Recent intent pressure is ${scoreSlope >= 0 ? 'rising' : 'cooling'}, BLAZING-share movement is ${blazingSlope > 0 ? 'strengthening' : 'flat-to-soft'}, and dormant lead risk is ${dormantSlope > 0 ? 'increasing' : 'stable'}.`,
  };
}
