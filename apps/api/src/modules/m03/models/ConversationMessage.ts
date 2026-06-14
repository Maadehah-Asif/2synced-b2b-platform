/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: ConversationMessage.ts
 * Purpose: Supports the C on ve rs at io nM es sa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type ConversationChannel =
  | "email"
  | "whatsapp"
  | "call"
  | "meeting"
  | "note"
  | "other";

export type ConversationDirection = "inbound" | "outbound";

export type ConversationParticipantRole = "prospect" | "rep" | "other";

export interface ConversationSender {
  name: string;
  email?: string;
  phone?: string;
  role: ConversationParticipantRole;
}

export interface ConversationMessageDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  externalMessageId?: string;
  direction: ConversationDirection;
  sender: ConversationSender;
  sentAt: Date;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  channel: ConversationChannel;
  meta?: {
    campaignId?: Types.ObjectId;
    tags?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMessageSchema = new Schema<ConversationMessageDocument>(
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
    externalMessageId: {
      type: String,
    },
    direction: {
      type: String,
      required: true,
      enum: ["inbound", "outbound"],
    },
    sender: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
      },
      phone: {
        type: String,
      },
      role: {
        type: String,
        enum: ["prospect", "rep", "other"],
        required: true,
      },
    },
    sentAt: {
      type: Date,
      required: true,
    },
    subject: {
      type: String,
    },
    bodyText: {
      type: String,
      required: true,
    },
    bodyHtml: {
      type: String,
    },
    channel: {
      type: String,
      required: true,
      enum: ["email", "whatsapp", "call", "meeting", "note", "other"],
    },
    meta: {
      campaignId: {
        type: Schema.Types.ObjectId,
        ref: "Campaign",
      },
      tags: [
        {
          type: String,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// useful indexes
ConversationMessageSchema.index({
  workspaceId: 1,
  threadId: 1,
  sentAt: 1,
});
ConversationMessageSchema.index({ workspaceId: 1, "sender.email": 1 });
// basic text search
ConversationMessageSchema.index({ subject: "text", bodyText: "text" });

const ConversationMessage = model<ConversationMessageDocument>(
  "ConversationMessage",
  ConversationMessageSchema
);

export default ConversationMessage;
