/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Backend
 * File: CampaignSpend.ts
 * Purpose: Supports the C am pa ig nS pe nd flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Schema, Types, Model } from 'mongoose';

export interface CampaignSpendDoc {
  _id: Types.ObjectId;
  campaign_id: Types.ObjectId | string;
  project_id: Types.ObjectId | string;
  date: Date; // use date or month
  amount: number;
  source?: 'manual' | 'csv' | 'import' | string;
  note?: string | null;
  createdBy?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSpendSchema = new Schema<CampaignSpendDoc>(
  {
    campaign_id: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, default: 0 },
    source: { type: String, default: 'manual' },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

CampaignSpendSchema.index({ campaign_id: 1, date: 1 });

export const CampaignSpend: Model<CampaignSpendDoc> = (mongoose.models.CampaignSpend as Model<CampaignSpendDoc>) || mongoose.model<CampaignSpendDoc>('CampaignSpend', CampaignSpendSchema);
