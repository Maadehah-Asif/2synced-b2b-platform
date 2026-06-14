/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Backend
 * File: Deal.ts
 * Purpose: Supports the D ea l flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Schema, Types, Model } from 'mongoose';

export interface DealDoc {
  _id: Types.ObjectId;
  deal_id: string; // external/business id
  lead_id: string;
  project_id: string;
  revenue: number;
  currency?: string | null;
  closed_won: boolean;
  closed_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema = new Schema<DealDoc>(
  {
    deal_id: { type: String, required: true, index: true },
    lead_id: { type: String, required: true, index: true },
    project_id: { type: String, required: true, index: true },
    revenue: { type: Number, required: true, default: 0 },
    currency: { type: String, default: null },
    closed_won: { type: Boolean, required: true, default: false },
    closed_at: { type: Date },
  },
  { timestamps: true, collection: 'deals' }
);

DealSchema.index({ project_id: 1, deal_id: 1 }, { unique: true });

export const Deal: Model<DealDoc> = (mongoose.models.Deal as Model<DealDoc>) || mongoose.model<DealDoc>('Deal', DealSchema);
