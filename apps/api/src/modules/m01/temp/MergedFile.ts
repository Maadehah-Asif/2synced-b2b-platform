/**
 * Module: Lead Quality & Scoring (m01)
 * Layer: Backend
 * File: MergedFile.ts
 * Purpose: Supports the M er ge dF il e flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const MergedFileSchema = new Schema({
  name: { type: String, required: false },
  fileId: { type: Schema.Types.ObjectId, required: true }, // GridFS file id in bucket m01_merged
  filename: { type: String, required: true },
  contentType: { type: String, default: 'text/csv' },
  length: { type: Number },
  workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  uploadIds: [{ type: Schema.Types.ObjectId, ref: 'UploadFile' }],
  uploadNames: [{ type: String }],
  mapping: { type: Schema.Types.Mixed },
  matchingColumns: { type: Schema.Types.Mixed },
  targetKey: { type: String },
  schemaVersion: { type: String },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export default model("MergedFile", MergedFileSchema);
