import mongoose, { Schema, Types, Model } from 'mongoose';

export interface Module6LeadDoc {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  row_number?: number | null;
  lead_id: string;
  name?: string | null;
  email?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const Module6LeadSchema = new Schema<Module6LeadDoc>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    row_number: { type: Number, default: null },
    lead_id: { type: String, required: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
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
