import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type SyncStatus = "queued" | "success" | "failed";

export interface ConversationSyncLogDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  dealId?: Types.ObjectId;

  payload: any; // what we attempted to send to CRM

  status: SyncStatus;
  errorMessage?: string;
  syncedAt?: Date;

  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSyncLogSchema = new Schema<ConversationSyncLogDocument>(
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
    dealId: {
      type: Schema.Types.ObjectId,
      ref: "Deal",
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "success", "failed"],
      required: true,
      default: "queued",
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    syncedAt: {
      type: Date,
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

ConversationSyncLogSchema.index({
  workspaceId: 1,
  dealId: 1,
  status: 1,
  createdAt: -1,
});

const ConversationSyncLog = model<ConversationSyncLogDocument>(
  "ConversationSyncLog",
  ConversationSyncLogSchema
);

export default ConversationSyncLog;
