import mongoose, { Schema, Types, Model } from 'mongoose';

export type AttributionModelType = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'other';

export interface AttributionRunDoc {
  _id: Types.ObjectId;
  run_id: string; // external id
  project_id: Types.ObjectId | string;
  model_type: AttributionModelType;
  timestamp: Date;
  status: 'success' | 'error' | 'running' | 'pending';
  meta?: Record<string, any> | null;
  // Added summary & window fields for fast loading
  date_from?: Date | null;
  date_to?: Date | null;
  deal_count?: number;
  deals_with_journeys?: number;
  deals_without_journeys?: number;
  total_revenue?: number;
  attributed_revenue?: number;
  unattributed_revenue?: number;
  campaign_count?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttributionRunSchema = new Schema<AttributionRunDoc>(
  {
    run_id: { type: String, required: true, unique: true, index: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    model_type: { type: String, enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'other'], required: true },
    timestamp: { type: Date, required: true },
    status: { type: String, enum: ['success', 'error', 'running', 'pending'], required: true },
    meta: { type: Schema.Types.Mixed },
    date_from: { type: Date },
    date_to: { type: Date },
    deal_count: { type: Number },
    deals_with_journeys: { type: Number },
    deals_without_journeys: { type: Number },
    total_revenue: { type: Number },
    attributed_revenue: { type: Number },
    unattributed_revenue: { type: Number },
    campaign_count: { type: Number },
  },
  { timestamps: true }
);

export const AttributionRun: Model<AttributionRunDoc> = (mongoose.models.AttributionRun as Model<AttributionRunDoc>) || mongoose.model<AttributionRunDoc>('AttributionRun', AttributionRunSchema);
