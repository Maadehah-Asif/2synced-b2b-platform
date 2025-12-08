import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type DealHealthBand = "healthy" | "neutral" | "at_risk";
export type DealHealthTrend = "up" | "flat" | "down";

export interface DealHealthSignals {
  hasBudget: boolean;
  hasDecisionMaker: boolean;
  hasTimeline: boolean;
  avgSentiment: number; // -1..1
  lastSentiment: number; // -1..1
  daysSinceLastMessage: number;
  numMessages: number;
  numNegativeMessages: number;
  numPositiveMessages: number;
  competitorMentions: number;
  redFlagDetected: boolean;
}

export interface DealHealthDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  leadId?: Types.ObjectId;
  dealId?: Types.ObjectId;

  score: number; // 0..100
  band: DealHealthBand;
  trend: DealHealthTrend;

  signals: DealHealthSignals;
  summary?: string;

  lastComputedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DealHealthSchema = new Schema<DealHealthDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Workspace",
      index: true,
    },
    threadId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ConversationThread",
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: "Deal",
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    band: {
      type: String,
      required: true,
      enum: ["healthy", "neutral", "at_risk"],
    },
    trend: {
      type: String,
      required: true,
      enum: ["up", "flat", "down"],
      default: "flat",
    },
    signals: {
      hasBudget: { type: Boolean, default: false },
      hasDecisionMaker: { type: Boolean, default: false },
      hasTimeline: { type: Boolean, default: false },
      avgSentiment: { type: Number, default: 0 },
      lastSentiment: { type: Number, default: 0 },
      daysSinceLastMessage: { type: Number, default: 0 },
      numMessages: { type: Number, default: 0 },
      numNegativeMessages: { type: Number, default: 0 },
      numPositiveMessages: { type: Number, default: 0 },
      competitorMentions: { type: Number, default: 0 },
      redFlagDetected: { type: Boolean, default: false },
    },
    summary: {
      type: String,
      trim: true,
    },
    lastComputedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// one latest health per thread is typical query pattern
DealHealthSchema.index({ workspaceId: 1, threadId: 1, lastComputedAt: -1 });
// for dashboards
DealHealthSchema.index({ workspaceId: 1, band: 1 });

const DealHealth = model<DealHealthDocument>("DealHealth", DealHealthSchema);

export default DealHealth;
