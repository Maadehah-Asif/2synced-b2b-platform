import mongoose, { Schema } from 'mongoose';

export interface FunnelStageHistoryDoc {
  _id: mongoose.Types.ObjectId;
  lead_id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  from_stage?: string | null;
  to_stage: string;
  timestamp: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const FunnelStageHistorySchema = new Schema<FunnelStageHistoryDoc>(
  {
    lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    from_stage: { type: String, required: false },
    to_stage: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true }
);

export const FunnelStageHistory = (mongoose.models.FunnelStageHistory as mongoose.Model<FunnelStageHistoryDoc>)
  || mongoose.model<FunnelStageHistoryDoc>('FunnelStageHistory', FunnelStageHistorySchema);

export default FunnelStageHistory;
