import mongoose, { Schema } from 'mongoose';

export type RunStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface LeakageModelRunDoc {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  modelVersion: string;
  startedAt: Date;
  finishedAt?: Date | null;
  status: RunStatus;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeakageModelRunSchema = new Schema<LeakageModelRunDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    modelVersion: { type: String, required: true },
    startedAt: { type: Date, required: true, default: () => new Date() },
    finishedAt: { type: Date },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], required: true, default: 'PENDING' },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const LeakageModelRun = (mongoose.models.LeakageModelRun as mongoose.Model<LeakageModelRunDoc>)
  || mongoose.model<LeakageModelRunDoc>('LeakageModelRun', LeakageModelRunSchema);

export default LeakageModelRun;
