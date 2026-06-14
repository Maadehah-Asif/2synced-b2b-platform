/**
 * Module: Lead Quality & Scoring (m01)
 * Layer: Backend
 * File: LeadsCodeFile.ts
 * Purpose: Supports the L ea ds Co de Fi le flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LeadsCodeFileSchema = new Schema({
  name: { type: String, required: false },
  fileId: { type: Schema.Types.ObjectId, required: true }, // GridFS file id in bucket m01_leads
  filename: { type: String, required: true },
  contentType: { type: String, default: 'text/csv' },
  length: { type: Number },
  workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  mergedId: { type: Schema.Types.ObjectId, ref: "MergedFile", required: true, index: true },
  // Optional artifacts for traceability
  inputFileId: { type: Schema.Types.ObjectId, required: false }, // GridFS id in bucket m01_leads_inputs
  inputFilename: { type: String, required: false },
  outputFileId: { type: Schema.Types.ObjectId, required: false }, // GridFS id in bucket m01_leads_outputs
  outputFilename: { type: String, required: false },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export default model("LeadsCodeFile", LeadsCodeFileSchema);
