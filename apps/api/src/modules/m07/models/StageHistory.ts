/**
 * Module: Funnel Insight (m07)
 * Layer: Backend
 * File: StageHistory.ts
 * Purpose: Supports the S ta ge Hi st or y flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Schema, Types, Model } from 'mongoose';

export interface StageHistoryDoc {
  _id: Types.ObjectId;
  workspace_id: string;
  lead_id: string;
  stage_name: string;
  entered_at: Date;
  exited_at?: Date | null;
  stage_status?: 'active' | 'completed' | 'dropped';
  next_stage?: string | null;
  exit_reason?: string | null;
  notes?: string | null;
  created_at?: Date | null;
  updated_at?: Date;
  is_archived?: boolean;
}

const StageHistorySchema = new Schema<StageHistoryDoc>(
  {
    workspace_id: { type: String, required: true, index: true },
    lead_id: { type: String, required: true, index: true },
    stage_name: { type: String, required: true, index: true },
    entered_at: { type: Date, required: true, index: true },
    exited_at: { type: Date, default: null },
    stage_status: { type: String, enum: ['active','completed','dropped'], default: 'active' },
    next_stage: { type: String, default: null },
    exit_reason: { type: String, default: null },
    notes: { type: String, default: null },
    created_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
    is_archived: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'funnel_stage_history',
  }
);

// uniqueness: workspace + lead + stage + entered_at
StageHistorySchema.index({ workspace_id: 1, lead_id: 1, stage_name: 1, entered_at: 1 }, { unique: false });
StageHistorySchema.index({ workspace_id: 1, stage_name: 1 });

export const StageHistory: Model<StageHistoryDoc> = (mongoose.models.StageHistory as Model<StageHistoryDoc>) || mongoose.model<StageHistoryDoc>('StageHistory', StageHistorySchema);

export default StageHistory;
