import mongoose, { Schema, Types, Model } from 'mongoose';

export type Channel = 'email' | 'ads' | 'linkedin' | 'webinar' | 'other';

export interface CampaignDoc {
  _id: Types.ObjectId;
  campaign_id: string; // external/business id
  project_id: Types.ObjectId | string;
  channel: Channel;
  name: string;
  description?: string | null;
  tags?: string[] | null;
  start_date?: Date | null;
  end_date?: Date | null;
  status: 'active' | 'archived';
  spend: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<CampaignDoc>(
  {
    campaign_id: { type: String, required: true, unique: true, index: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    channel: { type: String, enum: ['email', 'ads', 'linkedin', 'webinar', 'other'], required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    tags: { type: [String], default: [] },
    start_date: { type: Date },
    end_date: { type: Date },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    spend: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const Campaign: Model<CampaignDoc> = (mongoose.models.Campaign as Model<CampaignDoc>) || mongoose.model<CampaignDoc>('Campaign', CampaignSchema);
