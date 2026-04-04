import mongoose, { Schema, Types, Model } from 'mongoose';

export type TouchType = 'email_open' | 'ad_click' | 'webinar' | 'email_click' | 'form_submit' | 'other';
export type TouchChannel = 'email' | 'ads' | 'linkedin' | 'webinar' | 'other';
export type TouchStatus = 'active' | 'archived';

export interface CampaignTouchDoc {
  _id: Types.ObjectId;
  project_id?: string | null;
  lead_id: string;
  campaign_id: string;
  channel?: TouchChannel; // can be derived from campaign but stored for fast filtering
  touched_at: Date;
  type: TouchType;
  status: TouchStatus;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignTouchSchema = new Schema<CampaignTouchDoc>(
  {
    project_id: { type: String, index: true, default: null },
    lead_id: { type: String, required: true, index: true },
    campaign_id: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'ads', 'linkedin', 'webinar', 'other'] },
    touched_at: { type: Date, required: true },
    type: { type: String, enum: ['email_open', 'ad_click', 'webinar', 'email_click', 'form_submit', 'other'], required: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'campaigntouches' }
);

CampaignTouchSchema.index({ campaign_id: 1, touched_at: -1 });
CampaignTouchSchema.index({ lead_id: 1, touched_at: -1 });
CampaignTouchSchema.index({ project_id: 1, touched_at: -1 });

export const CampaignTouch: Model<CampaignTouchDoc> = (mongoose.models.CampaignTouch as Model<CampaignTouchDoc>) || mongoose.model<CampaignTouchDoc>('CampaignTouch', CampaignTouchSchema);
