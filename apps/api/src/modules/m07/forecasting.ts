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
    datasetPath: datasetPath(),
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
  const conversionSlope = slope(history.map((row) => row.conversionRate).slice(-6));
  const dropSlope = slope(history.map((row) => row.dropRate).slice(-6));
  const daysSlope = slope(history.map((row) => row.avgDaysInStage).slice(-6));
  const fatigueSlope = slope(history.map((row) => row.fatiguedLeads).slice(-6));
  const enteredSlope = slope(history.map((row) => row.leadsEntered).slice(-6));
  const last = history[history.length - 1]!;

  const forecast = Array.from({ length: horizon }, (_, index) => {
    const step = index + 1;
    return {
      month: addMonths(last.month, step),
      projectedConversionRate: Number(Math.max(0, Math.min(100, last.conversionRate + conversionSlope * step)).toFixed(2)),
      projectedDropRate: Number(Math.max(0, Math.min(100, last.dropRate + dropSlope * step)).toFixed(2)),
      projectedAvgDaysInStage: Number(Math.max(0, last.avgDaysInStage + daysSlope * step).toFixed(2)),
      projectedFatiguedLeads: Math.max(0, Math.round(last.fatiguedLeads + fatigueSlope * step)),
      projectedLeadsEntered: Math.max(0, Math.round(last.leadsEntered + enteredSlope * step)),
    };
  });

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
    explanation: `Funnel forecast uses ${history.length} month buckets${input.source ? ` for source=${input.source}` : ''}${input.stage ? ` and stage=${input.stage}` : ''}. Conversion is ${conversionSlope >= 0 ? 'strengthening' : 'softening'}, while drop pressure is ${dropSlope > 0 ? 'rising' : 'stable'}.`,
  };
}
