/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: MessageSentiment.ts
 * Purpose: Supports the M es sa ge Se nt im en t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface MessageSentimentDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  messageId: Types.ObjectId;
  direction?: "inbound" | "outbound";
  label: SentimentLabel;
  score: number; // e.g. -1..1
  tokensAnalyzed?: number;
  meta?: {
    matchedPositive?: string[];
    matchedNegative?: string[];
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MessageSentimentSchema = new Schema<MessageSentimentDocument>(
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
    label: {
      type: String,
      required: true,
      enum: ["positive", "neutral", "negative"],
    },
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
    },
    score: {
      type: Number,
      required: true,
      min: -1,
      max: 1,
    },
    tokensAnalyzed: {
      type: Number,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

MessageSentimentSchema.index({ workspaceId: 1, threadId: 1 });
MessageSentimentSchema.index({ workspaceId: 1, messageId: 1 });
MessageSentimentSchema.index({ workspaceId: 1, label: 1 });

const MessageSentiment = model<MessageSentimentDocument>(
  "MessageSentiment",
  MessageSentimentSchema
);

export default MessageSentiment;
