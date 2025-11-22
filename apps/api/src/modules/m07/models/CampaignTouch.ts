import mongoose, { Schema, Types, Model } from 'mongoose';

export type TouchType = 'email_open' | 'ad_click' | 'webinar' | 'email_click' | 'form_submit' | 'other';

export interface CampaignTouchDoc {
  _id: Types.ObjectId;
  lead_id: Types.ObjectId | string;
  campaign_id: Types.ObjectId | string;
  touched_at: Date;
  type: TouchType;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignTouchSchema = new Schema<CampaignTouchDoc>(
  {
    lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    touched_at: { type: Date, required: true },
    type: { type: String, enum: ['email_open', 'ad_click', 'webinar', 'email_click', 'form_submit', 'other'], required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

CampaignTouchSchema.index({ campaign_id: 1, touched_at: -1 });

export const CampaignTouch: Model<CampaignTouchDoc> = (mongoose.models.CampaignTouch as Model<CampaignTouchDoc>) || mongoose.model<CampaignTouchDoc>('CampaignTouch', CampaignTouchSchema);
