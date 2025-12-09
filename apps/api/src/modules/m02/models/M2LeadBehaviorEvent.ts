import mongoose, { Schema, Types, Model } from 'mongoose';
import type { IntentSegment } from './M2LeadIntentSummary.js';

export type BehaviorEventType = 'email_open' | 'email_click' | 'reply' | 'website_visit' | 'linkedin_view' | 'call' | 'demo_request';

export interface M2LeadBehaviorEventDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId | string;
  leadId: string;
  timestamp: Date;
  eventType: BehaviorEventType;
  engagementScore?: number | null;
  recencyDays?: number | null;
  velocity?: number | null;
  spikeFlag?: boolean;
  dropFlag?: boolean;
  intentSegment?: IntentSegment;
  intentScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<M2LeadBehaviorEventDoc>(
  {
    workspaceId: { type: Schema.Types.Mixed, required: true, index: true },
    leadId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true },
    eventType: { type: String, enum: ['email_open', 'email_click', 'reply', 'website_visit', 'linkedin_view', 'call', 'demo_request'], required: true },
    engagementScore: Number,
    recencyDays: Number,
    velocity: Number,
    spikeFlag: { type: Boolean, default: false },
    dropFlag: { type: Boolean, default: false },
    intentSegment: { type: String, enum: ['COLD', 'WARM', 'HOT', 'BLAZING'] },
    intentScore: Number,
  },
  { timestamps: true, collection: 'm02_lead_behaviors' }
);

schema.index({ workspaceId: 1, leadId: 1, timestamp: 1 });

export const M2LeadBehaviorEvent: Model<M2LeadBehaviorEventDoc> = (mongoose.models.M2LeadBehaviorEvent as Model<M2LeadBehaviorEventDoc>) || mongoose.model<M2LeadBehaviorEventDoc>('M2LeadBehaviorEvent', schema);

export default M2LeadBehaviorEvent;
