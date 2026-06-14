/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: ConversationImport.ts
 * Purpose: Supports the C on ve rs at io nI mp or t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type ConversationImportStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed";

export interface ConversationImportSummary {
  totalRows: number;
  createdThreads: number;
  createdMessages: number;
  skippedRows: number;
}

export interface ConversationImportDocument extends Document {
  workspaceId: Types.ObjectId;
  uploadFileId: Types.ObjectId;
  mappingTemplateId?: Types.ObjectId;
  status: ConversationImportStatus;
  summary?: ConversationImportSummary;
  errorMessage?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationImportSchema = new Schema<ConversationImportDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Workspace",
      index: true,
    },
    uploadFileId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "UploadFile",
    },
    mappingTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "MappingTemplate",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "done", "failed"],
      default: "pending",
      required: true,
    },
    summary: {
      totalRows: { type: Number, default: 0 },
      createdThreads: { type: Number, default: 0 },
      createdMessages: { type: Number, default: 0 },
      skippedRows: { type: Number, default: 0 },
    },
    errorMessage: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

ConversationImportSchema.index({ workspaceId: 1, createdAt: -1 });

const ConversationImport = model<ConversationImportDocument>(
  "ConversationImport",
  ConversationImportSchema
);

export default ConversationImport;
