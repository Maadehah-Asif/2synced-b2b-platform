import mongoose from 'mongoose';

const InteractionSchema = new mongoose.Schema(
  {
    workspace_id: { type: mongoose.Types.ObjectId, required: true, index: true },
    lead_id: { type: mongoose.Types.ObjectId, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    interaction_type: { type: String, required: true },
    channel: { type: String },
    campaign_id: { type: mongoose.Types.ObjectId },
    outcome: { type: String },
    engagement_score: { type: Number },
    meta: { type: mongoose.Schema.Types.Mixed },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

InteractionSchema.index({ workspace_id: 1, lead_id: 1, timestamp: 1, interaction_type: 1 }, { unique: false });

export default mongoose.model('FunnelInteraction', InteractionSchema, 'funnel_interactions');
import mongoose, { Schema, Types, Model } from 'mongoose';

export interface InteractionDoc {
  _id: Types.ObjectId;
  workspace_id: string;
  interaction_id?: string | null;
  lead_id: string;
  timestamp: Date;
  interaction_type: string;
  channel?: string | null;
  campaign_id?: string | null;
  outcome?: string | null;
  engagement_score?: number | null;
  notes?: string | null;
  created_at?: Date | null;
  updated_at?: Date;
  is_archived?: boolean;
}

const InteractionSchema = new Schema<InteractionDoc>(
  {
    workspace_id: { type: String, required: true, index: true },
    interaction_id: { type: String, default: null },
    lead_id: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    interaction_type: { type: String, required: true, index: true },
    channel: { type: String, default: null, index: true },
    campaign_id: { type: String, default: null, index: true },
    outcome: { type: String, default: null },
    engagement_score: { type: Number, default: null },
    notes: { type: String, default: null },
    created_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
    is_archived: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'funnel_interactions',
  }
);

InteractionSchema.index({ workspace_id: 1, lead_id: 1, timestamp: 1 });
InteractionSchema.index({ workspace_id: 1, campaign_id: 1 });
InteractionSchema.index({ workspace_id: 1, interaction_type: 1 });
InteractionSchema.index({ workspace_id: 1, channel: 1 });

export const Interaction: Model<InteractionDoc> = (mongoose.models.Interaction as Model<InteractionDoc>) || mongoose.model<InteractionDoc>('Interaction', InteractionSchema);

export default Interaction;
