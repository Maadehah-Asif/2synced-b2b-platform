import mongoose, { Schema, Types, Model } from 'mongoose';

export interface Module6LeadDoc {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  row_number?: number | null;
  lead_id: string;
  name?: string | null;
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
  is_archived?: boolean;
  raw?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

const Module6LeadSchema = new Schema<Module6LeadDoc>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    row_number: { type: Number, default: null },
    lead_id: { type: String, required: true },
    name: { type: String, default: null },
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
    is_archived: { type: Boolean, default: false },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'm06_leads'
  }
);

Module6LeadSchema.index({ project_id: 1, lead_id: 1 }, { unique: true });
Module6LeadSchema.index({ project_id: 1, email: 1 });
Module6LeadSchema.index({ project_id: 1, createdAt: -1 });

export const Module6Lead: Model<Module6LeadDoc> = (mongoose.models.Module6Lead as Model<Module6LeadDoc>) || mongoose.model<Module6LeadDoc>('Module6Lead', Module6LeadSchema);
