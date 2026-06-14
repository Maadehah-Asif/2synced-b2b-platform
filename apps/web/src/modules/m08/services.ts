/**
 * Module: Report Center (m08)
 * Layer: Frontend
 * File: services.ts
 * Purpose: Supports the s er vi ce s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { fetchFromApi, parseApiJson } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ModuleReportMetric = {
  label: string;
  value: string;
  helper: string;
  statusLabel?: string;
  statusTone?: 'healthy' | 'warning' | 'critical' | 'neutral';
};

export type ModuleReportSection = {
  key: string;
  title: string;
  description: string;
  columns: string[];
  rows: Array<Array<string | number>>;
};

export type ModuleReportExport = {
  key: string;
  label: string;
  description: string;
  filename: string;
};

export type ModuleReportPayload = {
  ok: true;
  moduleKey: 'm01' | 'm02' | 'm03' | 'm05' | 'm06' | 'm07' | 'm09';
  title: string;
  subtitle: string;
  generatedAt: string;
  reportStatusLabel?: string;
  reportStatusTone?: 'healthy' | 'warning' | 'critical' | 'neutral';
  reportStatusSummary?: string;
  overviewTitle: string;
  overviewBody: string[];
  recommendations: string[];
  metricCards: ModuleReportMetric[];
  highlights: string[];
  sections: ModuleReportSection[];
  exports: ModuleReportExport[];
};

export async function fetchModuleReport(moduleKey: string, workspaceId: string) {
  const params = new URLSearchParams({ workspaceId });
  const res = await fetchFromApi(`${API_URL}/m08/reports/${encodeURIComponent(moduleKey)}?${params.toString()}`, undefined, API_URL);
  return parseApiJson<ModuleReportPayload>(res, 'Could not load the report.');
}

export async function downloadModuleReportExport(moduleKey: string, workspaceId: string, exportKey: string, filename: string) {
  const params = new URLSearchParams({ workspaceId, export: exportKey });
  const res = await fetchFromApi(`${API_URL}/m08/reports/${encodeURIComponent(moduleKey)}/export?${params.toString()}`, undefined, API_URL);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Could not download the CSV export.');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
