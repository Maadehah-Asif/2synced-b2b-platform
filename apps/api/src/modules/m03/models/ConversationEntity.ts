import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type ConversationEntityType =
  | "budget"
  | "decision_maker"
  | "timeline"
  | "competitor"
  | "other";

export interface ConversationEntityDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  messageId: Types.ObjectId;
  type: ConversationEntityType;
  value: string;
  confidence: number; // 0..1
  sourceSnippet?: string;
  status?: "active" | "obsolete";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plain object shape used when creating entities (no Mongoose methods).
 */
export interface ConversationEntityCreateInput {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  messageId: Types.ObjectId;
  type: ConversationEntityType;
  value: string;
  confidence: number;
  sourceSnippet?: string;
  status?: "active" | "obsolete";
}

const ConversationEntitySchema = new Schema<ConversationEntityDocument>(
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
    messageId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ConversationMessage",
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["budget", "decision_maker", "timeline", "competitor", "other"],
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    sourceSnippet: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "obsolete"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ConversationEntitySchema.index({ workspaceId: 1, threadId: 1, type: 1 });
ConversationEntitySchema.index({ workspaceId: 1, type: 1 });

const ConversationEntity = model<ConversationEntityDocument>(
  "ConversationEntity",
  ConversationEntitySchema
);

export default ConversationEntity;
