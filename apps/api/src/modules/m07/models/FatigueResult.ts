import mongoose, { Schema } from 'mongoose';

export interface FatigueResultDoc {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  touchCount: number;
  fatigueLevel: 'OK' | 'WARM' | 'TIRED' | 'BURNT_OUT';
  windowDays: number;
  lastTouchAt?: Date | null;
  campaignId?: mongoose.Types.ObjectId | null;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FatigueResultSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    touchCount: { type: Number, required: true },
    fatigueLevel: { type: String, enum: ['OK', 'WARM', 'TIRED', 'BURNT_OUT'], required: true },
    windowDays: { type: Number, required: true },
    lastTouchAt: { type: Date },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const FatigueResult = (mongoose.models.FatigueResult as mongoose.Model<FatigueResultDoc>) || mongoose.model<FatigueResultDoc>('FatigueResult', FatigueResultSchema);

export default FatigueResult;
