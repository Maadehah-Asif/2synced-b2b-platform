/**
 * Module: Lead Quality & Scoring (m01)
 * Layer: Backend
 * File: MergeAudit.ts
 * Purpose: Supports the M er ge Au di t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const MergeAuditSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  uploadIds: { type: [Schema.Types.ObjectId], required: true },
  mapping: { type: Schema.Types.Mixed, required: true },
  matchingColumns: { type: Schema.Types.Mixed, required: true },
  joinType: { type: String, default: 'outer' },
  conflictPolicy: { type: String, default: 'last_non_empty' },
  counts: { type: Schema.Types.Mixed, required: false },
  castErrors: { type: [Schema.Types.Mixed], required: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: () => new Date() },
}, { timestamps: false });

export default model('MergeAudit', MergeAuditSchema);
