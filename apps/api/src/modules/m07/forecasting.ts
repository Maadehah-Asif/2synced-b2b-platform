import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

type FunnelForecastRow = {
  month: string;
  source: string;
  stage: string;
  leads_entered: number;
  progressed: number;
  dropped: number;
  avg_days_in_stage: number;
  fatigued_leads: number;
};

export type M07ForecastRequest = {
  source?: string;
  stage?: string;
  horizonMonths: number;
};

function datasetPath() {
  return path.join(process.cwd(), 'src', 'modules', 'm07', 'data', 'funnel_forecast_dataset.csv');
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function loadRows(): FunnelForecastRow[] {
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
    source: String(row.source || ''),
    stage: String(row.stage || ''),
    leads_entered: toNumber(row.leads_entered),
    progressed: toNumber(row.progressed),
    dropped: toNumber(row.dropped),
    avg_days_in_stage: toNumber(row.avg_days_in_stage),
    fatigued_leads: toNumber(row.fatigued_leads),
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

function naiveForecast(values: number[], horizon: number) {
  const last = values[values.length - 1] ?? 0;
  return Array.from({ length: horizon }, () => last);
}

function movingAverageForecast(values: number[], horizon: number, window = 3) {
  const working = [...values];
  const output: number[] = [];
  for (let step = 0; step < horizon; step += 1) {
    const recent = working.slice(Math.max(0, working.length - window));
    const avg = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
    output.push(avg);
    working.push(avg);
  }
  return output;
}

function exponentialSmoothingForecast(values: number[], horizon: number, alpha = 0.45) {
  if (!values.length) return Array.from({ length: horizon }, () => 0);
  let level = values[0] ?? 0;
  for (let index = 1; index < values.length; index += 1) {
    level = alpha * values[index]! + (1 - alpha) * level;
  }
  return Array.from({ length: horizon }, () => level);
}

function linearRegressionForecast(values: number[], horizon: number) {
  const trendSlope = slope(values);
  const last = values[values.length - 1] ?? 0;
  return Array.from({ length: horizon }, (_, index) => last + trendSlope * (index + 1));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]) {
  const avg = mean(values);
  if (!values.length || Math.abs(avg) < 1e-9) return null;
  return stdDev(values) / Math.abs(avg);
}

function linearR2(values: number[]) {
  if (values.length < 2) return null;
  const x = values.map((_, index) => index);
  const xMean = mean(x);
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += (x[index]! - xMean) * (values[index]! - yMean);
    denominator += (x[index]! - xMean) ** 2;
  }
  if (denominator === 0) return 1;
  const fitSlope = numerator / denominator;
  const intercept = yMean - fitSlope * xMean;
  const fitted = x.map((value) => intercept + fitSlope * value);
  const totalVar = values.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  if (totalVar <= 1e-9) return 1;
  const residualVar = values.reduce((sum, value, index) => sum + (value - fitted[index]!) ** 2, 0);
  return 1 - residualVar / totalVar;
}

function autoSelectMethod(values: number[]) {
  let baseMethod: 'naive' | 'moving_average' | 'exponential_smoothing' | 'linear_regression';
  if (values.length < 5) baseMethod = 'naive';
  else if (values.length < 9) baseMethod = 'moving_average';
  else if (values.length < 16) baseMethod = 'exponential_smoothing';
  else baseMethod = 'linear_regression';

  if (values.length >= 3) {
    const lastThreeCv = coefficientOfVariation(values.slice(-3));
    if (lastThreeCv !== null && lastThreeCv < 0.05) {
      return { method: 'naive' as const, reason: 'flat recent history' };
    }
  }

  if (values.length >= 4) {
    const previousValues = values.slice(0, -1);
    const previousStd = stdDev(previousValues);
    const previousMean = mean(previousValues);
    const latestValue = values[values.length - 1] ?? 0;
    if (previousStd > 1e-9 && Math.abs(latestValue - previousMean) > 2 * previousStd) {
      return { method: 'moving_average' as const, reason: 'latest point behaves like an outlier' };
    }
  }

  const overallCv = coefficientOfVariation(values);
  if (overallCv !== null && overallCv > 0.4) {
    return { method: 'exponential_smoothing' as const, reason: 'overall history is volatile' };
  }

  if (baseMethod === 'linear_regression') {
    const r2 = linearR2(values);
    if (r2 !== null && r2 < 0.4) {
      return { method: 'exponential_smoothing' as const, reason: 'trend fit is weak' };
    }
  }

  return { method: baseMethod, reason: 'history length threshold' };
}

function forecastSeries(
  values: number[],
  horizon: number,
  method: 'naive' | 'moving_average' | 'exponential_smoothing' | 'linear_regression',
) {
  switch (method) {
    case 'naive':
      return naiveForecast(values, horizon);
    case 'moving_average':
      return movingAverageForecast(values, horizon);
    case 'exponential_smoothing':
      return exponentialSmoothingForecast(values, horizon);
    case 'linear_regression':
    default:
      return linearRegressionForecast(values, horizon);
  }
}

function addMonths(label: string, offset: number) {
  const [year, month] = label.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function aggregate(rows: FunnelForecastRow[]) {
  const grouped = new Map<string, { month: string; entered: number; progressed: number; dropped: number; daysSum: number; fatigue: number; count: number }>();
  for (const row of rows) {
    const current = grouped.get(row.month) || {
      month: row.month,
      entered: 0,
      progressed: 0,
      dropped: 0,
      daysSum: 0,
      fatigue: 0,
      count: 0,
    };
    current.entered += row.leads_entered;
    current.progressed += row.progressed;
    current.dropped += row.dropped;
    current.daysSum += row.avg_days_in_stage;
    current.fatigue += row.fatigued_leads;
    current.count += 1;
    grouped.set(row.month, current);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => {
      const conversionRate = row.entered > 0 ? (row.progressed / row.entered) * 100 : 0;
      const dropRate = row.entered > 0 ? (row.dropped / row.entered) * 100 : 0;
      return {
        month: row.month,
        leadsEntered: row.entered,
        conversionRate: Number(conversionRate.toFixed(2)),
        dropRate: Number(dropRate.toFixed(2)),
        avgDaysInStage: Number((row.daysSum / row.count).toFixed(2)),
        fatiguedLeads: row.fatigue,
      };
    });
}

export function getM07ForecastFilters() {
  const rows = loadRows();
  return {
    sources: Array.from(new Set(rows.map((row) => row.source))).sort(),
    stages: Array.from(new Set(rows.map((row) => row.stage))).sort(),
  };
}

export function runM07Forecast(input: M07ForecastRequest) {
  const rows = loadRows().filter((row) => {
    if (input.source && row.source !== input.source) return false;
    if (input.stage && row.stage !== input.stage) return false;
    return true;
  });
  const history = aggregate(rows);
  if (!history.length) {
    return {
      ok: true,
      history: [],
      forecast: [],
      kpis: {
        latestConversionRate: 0,
        latestDropRate: 0,
        latestAvgDaysInStage: 0,
        projectedConversionRate: 0,
      },
      explanation: 'No module 7 forecast rows matched the selected filters.',
    };
  }

  const horizon = Math.max(1, Math.min(12, input.horizonMonths || 3));
  const conversionSeries = history.map((row) => row.conversionRate);
  const { method, reason } = autoSelectMethod(conversionSeries);
  const dropSeries = history.map((row) => row.dropRate);
  const avgDaysSeries = history.map((row) => row.avgDaysInStage);
  const fatigueSeries = history.map((row) => row.fatiguedLeads);
  const enteredSeries = history.map((row) => row.leadsEntered);
  const conversionForecast = forecastSeries(conversionSeries, horizon, method);
  const dropForecast = forecastSeries(dropSeries, horizon, method);
  const daysForecast = forecastSeries(avgDaysSeries, horizon, method);
  const fatigueForecast = forecastSeries(fatigueSeries, horizon, method);
  const enteredForecast = forecastSeries(enteredSeries, horizon, method);
  const last = history[history.length - 1]!;

  const forecast = Array.from({ length: horizon }, (_, index) => {
    return {
      month: addMonths(last.month, index + 1),
      projectedConversionRate: Number(Math.max(0, Math.min(100, conversionForecast[index] ?? 0)).toFixed(2)),
      projectedDropRate: Number(Math.max(0, Math.min(100, dropForecast[index] ?? 0)).toFixed(2)),
      projectedAvgDaysInStage: Number(Math.max(0, daysForecast[index] ?? 0).toFixed(2)),
      projectedFatiguedLeads: Math.max(0, Math.round(fatigueForecast[index] ?? 0)),
      projectedLeadsEntered: Math.max(0, Math.round(enteredForecast[index] ?? 0)),
    };
  });

  const nextConversion = forecast[0]?.projectedConversionRate ?? last.conversionRate;
  const nextDrop = forecast[0]?.projectedDropRate ?? last.dropRate;
  const methodLabel = method === 'moving_average'
    ? 'moving average'
    : method === 'exponential_smoothing'
      ? 'exponential smoothing'
      : method === 'naive'
        ? 'naive'
        : 'linear regression';

  return {
    ok: true,
    history,
    forecast,
    kpis: {
      latestConversionRate: last.conversionRate,
      latestDropRate: last.dropRate,
      latestAvgDaysInStage: last.avgDaysInStage,
      projectedConversionRate: forecast[0]?.projectedConversionRate ?? last.conversionRate,
    },
    explanation: `Funnel forecast uses the ${methodLabel} method on ${history.length} month buckets${input.source ? ` for source=${input.source}` : ''}${input.stage ? ` and stage=${input.stage}` : ''}. Conversion is ${nextConversion >= last.conversionRate ? 'strengthening' : 'softening'}, while drop pressure is ${nextDrop > last.dropRate ? 'rising' : 'stable'}.`,
    forecastMethod: method,
    selectionReason: reason,
  };
}
