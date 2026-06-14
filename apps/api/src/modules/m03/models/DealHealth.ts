/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: DealHealth.ts
 * Purpose: Supports the D ea lH ea lt h flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type DealHealthBand = "healthy" | "steady" | "at_risk";
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

export interface DealHealthFeatures {
  avg_sentiment_all: number;
  avg_sentiment_recent: number;
  sentiment_trend: number;
  sentiment_volatility: number;
  pos_ratio_all: number;
  neg_ratio_all: number;
  neg_ratio_recent: number;
  days_since_last_inbound: number;
  total_messages_log: number;
  inbound_to_outbound_ratio_recent: number;
  has_budget: number;
  has_decision_maker: number;
  has_timeline: number;
  has_competitor: number;
  num_unique_prospect_contacts: number;
  num_contacts_active_last_30d: number;
  dm_engagement_score: number;
  ghosting_score: number;
}

export interface DealHealthDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  leadId?: Types.ObjectId;
  dealId?: Types.ObjectId;

  score: number; // 0..100
  probabilityHealthy: number; // 0..1
  band: DealHealthBand;
  trend: DealHealthTrend;

  signals: DealHealthSignals;
  featuresSnapshot: DealHealthFeatures;
  reasons: string[];
  summary?: string;

  lastAnalyzedAt: Date;
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
      enum: ["healthy", "steady", "at_risk"],
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
    probabilityHealthy: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    featuresSnapshot: {
      avg_sentiment_all: { type: Number, required: true },
      avg_sentiment_recent: { type: Number, required: true },
      sentiment_trend: { type: Number, required: true },
      sentiment_volatility: { type: Number, required: true },
      pos_ratio_all: { type: Number, required: true },
      neg_ratio_all: { type: Number, required: true },
      neg_ratio_recent: { type: Number, required: true },
      days_since_last_inbound: { type: Number, required: true },
      total_messages_log: { type: Number, required: true },
      inbound_to_outbound_ratio_recent: { type: Number, required: true },
      has_budget: { type: Number, required: true },
      has_decision_maker: { type: Number, required: true },
      has_timeline: { type: Number, required: true },
      has_competitor: { type: Number, required: true },
      num_unique_prospect_contacts: { type: Number, required: true },
      num_contacts_active_last_30d: { type: Number, required: true },
      dm_engagement_score: { type: Number, required: true },
      ghosting_score: { type: Number, required: true },
    },
    reasons: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
    },
    lastAnalyzedAt: {
      type: Date,
      required: true,
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
// for deal health list endpoint
DealHealthSchema.index({ workspaceId: 1, dealId: 1 });

const DealHealth = model<DealHealthDocument>("DealHealth", DealHealthSchema);

export default DealHealth;
