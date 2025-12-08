import mongoose, { Schema, Types, Model } from 'mongoose';

export interface DealDoc {
  _id: Types.ObjectId;
  deal_id: string; // external/business id
  lead_id: Types.ObjectId | string;
  project_id: Types.ObjectId | string;
  revenue: number;
  closed_won: boolean;
  closed_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema = new Schema<DealDoc>(
  {
    deal_id: { type: String, required: true, unique: true, index: true },
    lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    revenue: { type: Number, required: true, default: 0 },
    closed_won: { type: Boolean, required: true, default: false },
    closed_at: { type: Date },
  },
  { timestamps: true }
);

export const Deal: Model<DealDoc> = (mongoose.models.Deal as Model<DealDoc>) || mongoose.model<DealDoc>('Deal', DealSchema);
