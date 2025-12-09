import mongoose, { Schema } from 'mongoose';

export interface RecommendationDoc {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  recommendationType: 'CALL_NOW' | 'PAUSE_CAMPAIGNS' | 'RETARGET' | 'REDUCE_FREQUENCY' | 'MOVE_TO_NURTURE' | 'NO_ACTION';
  reason?: string | null;
  impactScore?: number | null;
  rulesFired: string[];
  explainableSignals?: any;
  signals?: any;
  leakageProbability?: number | null;
  leakageLevel?: string | null;
  fatigueLevel?: string | null;
  fatigueTouches?: number | null;
  lastCampaignId?: mongoose.Types.ObjectId | null;
  lastCampaignName?: string | null;
  lastTouchTimestamp?: Date | null;
  dealStatus?: string | null;
  dealAmount?: number | null;
  shortExplanation?: string | null;
  currentStage?: string | null;
  recommendedAction?: string | null;
  actionLabel?: string | null;
  dismissNote?: string | null;
  status: 'OPEN' | 'PENDING' | 'DONE' | 'DISMISSED' | 'INSUFFICIENT_DATA';
  completedAt?: Date | null;
  completedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = new Schema<RecommendationDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    recommendationType: {
      type: String,
      enum: ['CALL_NOW', 'PAUSE_CAMPAIGNS', 'RETARGET', 'REDUCE_FREQUENCY', 'MOVE_TO_NURTURE', 'NO_ACTION'],
      required: true,
      index: true,
    },
    reason: { type: String },
    impactScore: { type: Number, default: 0 },
    rulesFired: { type: [String], default: [] },
    explainableSignals: { type: Schema.Types.Mixed },
    signals: { type: Schema.Types.Mixed },
    leakageProbability: { type: Number },
    leakageLevel: { type: String },
    fatigueLevel: { type: String },
    fatigueTouches: { type: Number },
    lastCampaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    lastCampaignName: { type: String },
    lastTouchTimestamp: { type: Date },
    dealStatus: { type: String },
    dealAmount: { type: Number },
    shortExplanation: { type: String },
    currentStage: { type: String },
    recommendedAction: { type: String },
    actionLabel: { type: String },
    dismissNote: { type: String },
    status: { type: String, enum: ['OPEN', 'PENDING', 'DONE', 'DISMISSED', 'INSUFFICIENT_DATA'], default: 'OPEN', index: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Recommendation = (mongoose.models.Recommendation as mongoose.Model<RecommendationDoc>)
  || mongoose.model<RecommendationDoc>('Recommendation', RecommendationSchema);

export default Recommendation;
