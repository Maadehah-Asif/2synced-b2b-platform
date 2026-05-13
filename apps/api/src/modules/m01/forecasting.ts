import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

type LeadForecastRow = {
  month: string;
  source: string;
  segment: string;
  industry: string;
  owner: string;
  lead_volume: number;
  avg_lead_score: number;
  high_quality_rate: number;
  duplicate_rate: number;
  invalid_rate: number;
  avg_confidence: number;
  low_rate: number;
  medium_rate: number;
  high_rate: number;
};

export type M01ForecastRequest = {
  source?: string;
  segment?: string;
  industry?: string;
  owner?: string;
  horizonMonths: number;
};

function datasetPath() {
  return path.join(process.cwd(), 'src', 'modules', 'm01', 'data', 'lead_quality_forecast_dataset.csv');
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function loadRows(): LeadForecastRow[] {
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
    segment: String(row.segment || ''),
    industry: String(row.industry || ''),
    owner: String(row.owner || ''),
    lead_volume: toNumber(row.lead_volume),
    avg_lead_score: toNumber(row.avg_lead_score),
    high_quality_rate: toNumber(row.high_quality_rate),
    duplicate_rate: toNumber(row.duplicate_rate),
    invalid_rate: toNumber(row.invalid_rate),
    avg_confidence: toNumber(row.avg_confidence),
    low_rate: toNumber(row.low_rate),
    medium_rate: toNumber(row.medium_rate),
    high_rate: toNumber(row.high_rate),
  }));
}

function aggregate(rows: LeadForecastRow[]) {
  const grouped = new Map<string, { month: string; leadVolume: number; scoreSum: number; highRateSum: number; duplicateRateSum: number; invalidRateSum: number; confidenceSum: number; lowClassSum: number; mediumClassSum: number; highClassSum: number; count: number }>();
  for (const row of rows) {
    const existing = grouped.get(row.month) || {
      month: row.month,
      leadVolume: 0,
      scoreSum: 0,
      highRateSum: 0,
      duplicateRateSum: 0,
      invalidRateSum: 0,
      confidenceSum: 0,
      lowClassSum: 0,
      mediumClassSum: 0,
      highClassSum: 0,
      count: 0,
    };
    existing.leadVolume += row.lead_volume;
    existing.scoreSum += row.avg_lead_score;
    existing.highRateSum += row.high_quality_rate;
    existing.duplicateRateSum += row.duplicate_rate;
    existing.invalidRateSum += row.invalid_rate;
    existing.confidenceSum += row.avg_confidence;
    existing.lowClassSum += row.low_rate;
    existing.mediumClassSum += row.medium_rate;
    existing.highClassSum += row.high_rate;
    existing.count += 1;
    grouped.set(row.month, existing);
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      month: row.month,
      leadVolume: row.leadVolume,
      avgLeadScore: Number((row.scoreSum / row.count).toFixed(2)),
      highQualityRate: Number((row.highRateSum / row.count).toFixed(2)),
      duplicateRate: Number((row.duplicateRateSum / row.count).toFixed(2)),
      invalidRate: Number((row.invalidRateSum / row.count).toFixed(2)),
      avgConfidence: Number((row.confidenceSum / row.count).toFixed(3)),
      lowRate: Number((row.lowClassSum / row.count).toFixed(2)),
      mediumRate: Number((row.mediumClassSum / row.count).toFixed(2)),
      highRate: Number((row.highClassSum / row.count).toFixed(2)),
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

export function getM01ForecastFilters() {
  const rows = loadRows();
  return {
    sources: Array.from(new Set(rows.map((row) => row.source))).sort(),
    segments: Array.from(new Set(rows.map((row) => row.segment))).sort(),
    industries: Array.from(new Set(rows.map((row) => row.industry))).sort(),
    owners: Array.from(new Set(rows.map((row) => row.owner))).sort(),
    datasetPath: datasetPath(),
  };
}

export function runM01Forecast(input: M01ForecastRequest) {
  const rows = loadRows().filter((row) => {
    if (input.source && row.source !== input.source) return false;
    if (input.segment && row.segment !== input.segment) return false;
    if (input.industry && row.industry !== input.industry) return false;
    if (input.owner && row.owner !== input.owner) return false;
    return true;
  });
  const history = aggregate(rows);
  if (!history.length) {
    return {
      ok: true,
      history: [],
      forecast: [],
      kpis: {
        latestAvgLeadScore: 0,
        latestHighQualityRate: 0,
        latestInvalidRate: 0,
        latestDuplicateRate: 0,
        projectedAvgLeadScore: 0,
      },
      explanation: 'No module 1 forecast rows matched the selected filters.',
    };
  }

  const horizon = Math.max(1, Math.min(12, input.horizonMonths || 3));
  const scoreSeries = history.map((row) => row.avgLeadScore);
  const highSeries = history.map((row) => row.highQualityRate);
  const invalidSeries = history.map((row) => row.invalidRate);
  const duplicateSeries = history.map((row) => row.duplicateRate);
  const volumeSeries = history.map((row) => row.leadVolume);
  const lowSeries = history.map((row) => row.lowRate);
  const mediumSeries = history.map((row) => row.mediumRate);
  const highClassSeries = history.map((row) => row.highRate);

  const scoreSlope = slope(scoreSeries.slice(-6));
  const highSlope = slope(highSeries.slice(-6));
  const invalidSlope = slope(invalidSeries.slice(-6));
  const duplicateSlope = slope(duplicateSeries.slice(-6));
  const volumeSlope = slope(volumeSeries.slice(-6));
  const lowSlope = slope(lowSeries.slice(-6));
  const mediumSlope = slope(mediumSeries.slice(-6));
  const highClassSlope = slope(highClassSeries.slice(-6));

  const last = history[history.length - 1]!;
  const forecast = Array.from({ length: horizon }, (_, index) => {
    const step = index + 1;
    const projectedLowRate = Number(Math.max(0, Math.min(100, last.lowRate + lowSlope * step)).toFixed(2));
    const projectedMediumRate = Number(Math.max(0, Math.min(100, last.mediumRate + mediumSlope * step)).toFixed(2));
    const projectedHighRate = Number(Math.max(0, Math.min(100, last.highRate + highClassSlope * step)).toFixed(2));
    return {
      month: addMonths(last.month, step),
      projectedAvgLeadScore: Number(Math.max(0, Math.min(100, last.avgLeadScore + scoreSlope * step)).toFixed(2)),
      projectedHighQualityRate: Number(Math.max(0, Math.min(100, last.highQualityRate + highSlope * step)).toFixed(2)),
      projectedInvalidRate: Number(Math.max(0, Math.min(100, last.invalidRate + invalidSlope * step)).toFixed(2)),
      projectedDuplicateRate: Number(Math.max(0, Math.min(100, last.duplicateRate + duplicateSlope * step)).toFixed(2)),
      projectedLeadVolume: Math.max(0, Math.round(last.leadVolume + volumeSlope * step)),
      projectedLowRate,
      projectedMediumRate,
      projectedHighRate,
    };
  });

  const projected = forecast[0] || null;
  const explanation = `Lead quality forecast uses ${history.length} historical month buckets${input.source ? ` for source=${input.source}` : ''}${input.segment ? ` and segment=${input.segment}` : ''}${input.industry ? ` in industry=${input.industry}` : ''}${input.owner ? ` under owner=${input.owner}` : ''}. Recent model score trend is ${scoreSlope >= 0 ? 'improving' : 'softening'}, LOW-class pressure is ${lowSlope > 0 ? 'rising' : 'stable'}, and data hygiene pressure is ${invalidSlope > 0 || duplicateSlope > 0 ? 'rising' : 'stable'}.`;

  return {
    ok: true,
    history,
    forecast,
    kpis: {
      latestAvgLeadScore: last.avgLeadScore,
      latestHighQualityRate: last.highQualityRate,
      latestInvalidRate: last.invalidRate,
      latestDuplicateRate: last.duplicateRate,
      projectedAvgLeadScore: projected ? projected.projectedAvgLeadScore : last.avgLeadScore,
    },
    explanation,
  };
}
