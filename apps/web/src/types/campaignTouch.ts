export interface CampaignTouch {
  _id?: string;
  id?: string;
  lead_id: number | string;
  campaign_id: number | string;
  campaign_name?: string;
  channel?: string;
  type: string;
  touched_at: string;
  status?: string;
  metadata?: Record<string, any> | null;
}

export interface CampaignTouchImportSummary {
  processed: number;
  inserted: number;
  failed: number;
  duplicates: number;
  failedRows?: Array<{ row: number; error: string }>;
}
