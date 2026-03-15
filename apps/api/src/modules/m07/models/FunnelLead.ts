import mongoose, { Schema, Types, Model } from 'mongoose';

export interface FunnelLeadDoc {
  _id: Types.ObjectId;
  workspace_id: string;
  lead_id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  source?: string | null;
  owner?: string | null;
  industry?: string | null;
  region?: string | null;
  lead_score?: number | null;
  intent_score?: number | null;
  email?: string | null;
  job_title?: string | null;
  segment?: string | null;
  created_at?: Date | null;
  updated_at?: Date;
  is_archived?: boolean;
  raw?: Record<string, any> | null;
}

const FunnelLeadSchema = new Schema<FunnelLeadDoc>(
  {
    workspace_id: { type: String, required: true, index: true },
    lead_id: { type: String, required: true },
    full_name: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    company: { type: String, default: null },
    source: { type: String, default: null },
    owner: { type: String, default: null },
    industry: { type: String, default: null },
    region: { type: String, default: null },
    lead_score: { type: Number, default: null },
    intent_score: { type: Number, default: null },
    email: { type: String, default: null },
    job_title: { type: String, default: null },
    segment: { type: String, default: null },
    created_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
    is_archived: { type: Boolean, default: false },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'funnel_leads',
  }
);

FunnelLeadSchema.index({ workspace_id: 1, lead_id: 1 }, { unique: true });
FunnelLeadSchema.index({ workspace_id: 1, created_at: -1 });

export const FunnelLead: Model<FunnelLeadDoc> = (mongoose.models.FunnelLead as Model<FunnelLeadDoc>) || mongoose.model<FunnelLeadDoc>('FunnelLead', FunnelLeadSchema);
