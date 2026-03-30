import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type ConversationChannel =
  | "email"
  | "whatsapp"
  | "call"
  | "meeting"
  | "note"
  | "other";

export type ConversationParticipantRole = "prospect" | "rep" | "other";

export type ConversationSource = "upload" | "connector" | "manual";

export interface ConversationParticipant {
  role: ConversationParticipantRole;
  name: string;
  email?: string;
  phone?: string;
}

export interface ConversationThreadDocument extends Document {
  workspaceId: Types.ObjectId;
  companyId: Types.ObjectId;
  leadId?: Types.ObjectId;
  dealId?: Types.ObjectId;
  channel: ConversationChannel;
  subject: string;
  externalThreadId?: string;
  participants: ConversationParticipant[];
  firstMessageAt?: Date;
  lastMessageAt?: Date;
  messageCount: number;
  source: ConversationSource;
  sourceFileId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationThreadSchema = new Schema<ConversationThreadDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Workspace",
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: false, // Temporarily optional for backwards compatibility with existing data
      ref: "Company",
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
    channel: {
      type: String,
      required: true,
      enum: ["email", "whatsapp", "call", "meeting", "note", "other"],
    },
    subject: {
      type: String,
      required: true,
    },
    externalThreadId: {
      type: String,
    },
    participants: [
      {
        role: {
          type: String,
          enum: ["prospect", "rep", "other"],
          required: true,
        },
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
      },
    ],
    firstMessageAt: {
      type: Date,
    },
    lastMessageAt: {
      type: Date,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      required: true,
      enum: ["upload", "connector", "manual"],
    },
    sourceFileId: {
      type: Schema.Types.ObjectId,
      ref: "UploadFile",
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

ConversationThreadSchema.index({ workspaceId: 1, lastMessageAt: -1 });
ConversationThreadSchema.index({ workspaceId: 1, companyId: 1 });
ConversationThreadSchema.index({ workspaceId: 1, leadId: 1 });
ConversationThreadSchema.index({ workspaceId: 1, dealId: 1 });

const ConversationThread = model<ConversationThreadDocument>(
  "ConversationThread",
  ConversationThreadSchema
);

export default ConversationThread;