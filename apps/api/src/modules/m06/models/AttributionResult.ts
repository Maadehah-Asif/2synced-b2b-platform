import mongoose, { Schema, Types, Model } from 'mongoose';

export interface AttributionResultDoc {
  _id: Types.ObjectId;
  run_id: Types.ObjectId | string;
  project_id: Types.ObjectId | string;
  deal_id: Types.ObjectId | string;
  campaign_id: Types.ObjectId | string;
  revenue_share: number; // portion of deal revenue assigned to this campaign
  createdAt: Date;
  updatedAt: Date;
}

const AttributionResultSchema = new Schema<AttributionResultDoc>(
  {
    run_id: { type: Schema.Types.ObjectId, ref: 'AttributionRun', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    deal_id: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    campaign_id: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    revenue_share: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

AttributionResultSchema.index({ run_id: 1, campaign_id: 1 });

export const AttributionResult: Model<AttributionResultDoc> = (mongoose.models.AttributionResult as Model<AttributionResultDoc>) || mongoose.model<AttributionResultDoc>('AttributionResult', AttributionResultSchema);
