export interface KPILeakage {
  totalScoredLeads: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  mostRiskyStage?: string | null;
  lastRun?: { id: string; modelVersion: string; status: string; startedAt: string; finishedAt?: string | null } | null;
}

export interface RiskBucket { bucket: 'LOW' | 'MEDIUM' | 'HIGH'; count: number }

export interface HighRiskLeadRow {
  leadId: string;
  leadName: string | null;
  company: string | null;
  currentStage: string | null;
  leakageProbability: number;
  timeInStageDays?: number | null;
  lastTouchAt?: string | null;
  ownerName?: string | null;
  status?: 'NEW' | 'REVIEWED';
}

export interface StageRiskRow {
  stage: string;
  avgLeakageProbability: number;
  highRiskCount: number;
  totalLeads: number;
}

export interface ModelConfidence {
  modelVersion?: string | null;
  auc?: number | null;
  accuracy?: number | null;
  totalSamples?: number | null;
  topFeatures?: Array<{ feature: string; importance: number }> | null;
}

export interface LeakageDashboard {
  kpis: KPILeakage;
  riskDistribution: { buckets: RiskBucket[] };
  highRiskLeads: HighRiskLeadRow[];
  stageRiskSummary: StageRiskRow[];
  modelConfidence: ModelConfidence | null;
}
