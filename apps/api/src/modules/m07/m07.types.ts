export interface KPISet {
  totalActiveLeads: number;
  totalEngagedLeads: number;
  totalDeals: number;
  winRate: number; // 0-1
  avgTimeToCloseDays?: number | null;
}

export interface FunnelStageCount {
  name: string;
  count: number;
}

export interface SankeyNode { id: string; name: string; value?: number }
export interface SankeyLink { source: string; target: string; value: number }

export interface StageMetricRow {
  stage: string;
  avgTimeDays?: number | null;
  conversions?: number;
  velocity?: number | null;
}

export interface FunnelHealthResponse {
  ok: true;
  kpis: KPISet;
  funnelStages: FunnelStageCount[];
  sankeyNodes: SankeyNode[];
  sankeyLinks: SankeyLink[];
  stageMetrics: StageMetricRow[];
  leakageMatrix: number[][]; // square matrix, index corresponds to funnelStages order
  exportUrls?: { csv?: string; pdf?: string };
}
