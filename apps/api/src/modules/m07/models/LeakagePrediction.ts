import mongoose, { Schema } from 'mongoose';

export interface LeakagePredictionDoc {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  leakageProbability: number;
  riskBucket: 'LOW' | 'MEDIUM' | 'HIGH';
  currentStage?: string | null;
  timeInStageDays?: number | null;
  lastTouchAt?: Date | null;
  modelVersion?: string | null;
  predictedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeakagePredictionSchema = new Schema<LeakagePredictionDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    leakageProbability: { type: Number, required: true },
    riskBucket: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true, index: true },
    currentStage: { type: String },
    timeInStageDays: { type: Number },
    lastTouchAt: { type: Date },
    modelVersion: { type: String },
    predictedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

export const LeakagePrediction = (mongoose.models.LeakagePrediction as mongoose.Model<LeakagePredictionDoc>)
  || mongoose.model<LeakagePredictionDoc>('LeakagePrediction', LeakagePredictionSchema);

export default LeakagePrediction;
