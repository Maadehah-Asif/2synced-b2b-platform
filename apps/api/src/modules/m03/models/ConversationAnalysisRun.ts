/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: ConversationAnalysisRun.ts
 * Purpose: Supports the C on ve rs at io nA na ly si sR un flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type AnalysisRunStatus = "pending" | "running" | "succeeded" | "failed";

export interface ConversationAnalysisRunDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;

  startedBy: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date;

  status: AnalysisRunStatus;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ConversationAnalysisRunSchema =
  new Schema<ConversationAnalysisRunDocument>(
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
      startedBy: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
      startedAt: {
        type: Date,
        required: true,
      },
      finishedAt: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["pending", "running", "succeeded", "failed"],
        required: true,
        default: "pending",
        index: true,
      },
      errorMessage: {
        type: String,
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

ConversationAnalysisRunSchema.index({
  workspaceId: 1,
  threadId: 1,
  startedAt: -1,
});

const ConversationAnalysisRun = model<ConversationAnalysisRunDocument>(
  "ConversationAnalysisRun",
  ConversationAnalysisRunSchema
);

export default ConversationAnalysisRun;
