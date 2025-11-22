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
  },
  { timestamps: true }
);

export const AttributionRun: Model<AttributionRunDoc> = (mongoose.models.AttributionRun as Model<AttributionRunDoc>) || mongoose.model<AttributionRunDoc>('AttributionRun', AttributionRunSchema);
