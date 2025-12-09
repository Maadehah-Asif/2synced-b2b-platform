import mongoose, { Schema, Types, Model } from 'mongoose';

export type IntentSegment = 'COLD' | 'WARM' | 'HOT' | 'BLAZING';

export interface M2LeadIntentSummaryDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId | string;
  leadId: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  headline?: string | null;
  company?: string | null;
  companyDomain?: string | null;
  location?: string | null;
  workEmail?: string | null;

  intentScore?: number | null;
  intentSegment?: IntentSegment;
  engagementScoreRecent?: number | null;
  engagementScore?: number | null;
  salesPressureIndex?: number | null;
  isUrgentEscalation?: boolean;
  repPriorityBucket?: number | null;
  escalationRiskScore?: number | null;
  accountActivityIndex?: number | null;
  daysSinceLastAction?: number | null;
  lastActionTaken?: string | null;
  lastActionDate?: Date | null;

  openRate?: number | null;
  clickRate?: number | null;
  unsubscribeRate?: number | null;
  totalEmailsSent?: number | null;
  totalOpenCount?: number | null;
  totalClickCount?: number | null;
  totalReplyCount?: number | null;
  totalActions?: number | null;
  channelCall?: number | null;
  channelEmail?: number | null;
  channelLinkedin?: number | null;

  predictedClass?: string | null;
  predictedLabel?: string | null;
  confidence?: number | null;
  pLow?: number | null;
  pMedium?: number | null;
  pHigh?: number | null;

  raw?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<M2LeadIntentSummaryDoc>(
  {
    workspaceId: { type: Schema.Types.Mixed, required: true, index: true },
    leadId: { type: String, required: true, index: true },
    fullName: String,
    firstName: String,
    lastName: String,
    jobTitle: String,
    headline: String,
    company: String,
    companyDomain: String,
    location: String,
    workEmail: String,

    intentScore: Number,
    intentSegment: { type: String, enum: ['COLD', 'WARM', 'HOT', 'BLAZING'], default: 'COLD' },
    engagementScoreRecent: Number,
    engagementScore: Number,
    salesPressureIndex: Number,
    isUrgentEscalation: { type: Boolean, default: false },
    repPriorityBucket: Number,
    escalationRiskScore: Number,
    accountActivityIndex: Number,
    daysSinceLastAction: Number,
    lastActionTaken: String,
    lastActionDate: Date,

    openRate: Number,
    clickRate: Number,
    unsubscribeRate: Number,
    totalEmailsSent: Number,
    totalOpenCount: Number,
    totalClickCount: Number,
    totalReplyCount: Number,
    totalActions: Number,
    channelCall: Number,
    channelEmail: Number,
    channelLinkedin: Number,

    predictedClass: String,
    predictedLabel: String,
    confidence: Number,
    pLow: Number,
    pMedium: Number,
    pHigh: Number,

    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'm02_lead_intents' }
);

schema.index({ workspaceId: 1, intentScore: -1 });
schema.index({ workspaceId: 1, intentSegment: 1 });

export const M2LeadIntentSummary: Model<M2LeadIntentSummaryDoc> = (mongoose.models.M2LeadIntentSummary as Model<M2LeadIntentSummaryDoc>) || mongoose.model<M2LeadIntentSummaryDoc>('M2LeadIntentSummary', schema);

export default M2LeadIntentSummary;
