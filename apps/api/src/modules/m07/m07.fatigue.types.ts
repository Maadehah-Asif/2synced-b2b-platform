export type FatigueLevel = 'OK' | 'WARM' | 'TIRED' | 'BURNT_OUT';

export interface CampaignFatigueRow {
  campaignId: string;
  campaignName: string | null;
  channel: string | null;
  leadsTouched: number;
  avgTouches: number;
  percentFatigued: number;
  recommendedAction: 'slow_down' | 'pause' | 're_segment' | 'none';
}

export interface FatiguedLeadRow {
  leadId: string;
  leadName: string | null;
  fatigueLevel: 'OK' | 'WARM' | 'TIRED' | 'BURNT_OUT';
  touchCount: number;
  lastTouchAt: string | null;
  lastCampaignName: string | null;
  ownerName: string | null;
}

export interface FatigueSummary {
  ok: number;
  warm: number;
  tired: number;
  burntOut: number;
  mostFatiguingCampaign: string | null;
}

export interface FatigueDashboard {
  summary: FatigueSummary;
  campaignStats: CampaignFatigueRow[];
  fatiguedLeads: FatiguedLeadRow[];
  alerts: { sentAt: string; count: number }[];
}

export interface FatigueRunOptions {
  windowDays: 7 | 14 | 30;
  threshold: number;
  channels?: string[];
}
