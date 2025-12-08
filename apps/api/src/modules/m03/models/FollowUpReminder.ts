import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type FollowUpStatus = "pending" | "done" | "snoozed";

export interface FollowUpReminderDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  messageId?: Types.ObjectId; // optional: which message triggered this
  assigneeId: Types.ObjectId; // user who should follow up

  dueAt: Date;
  status: FollowUpStatus;

  reason: string; // short explanation
  snoozedUntil?: Date;

  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpReminderSchema = new Schema<FollowUpReminderDocument>(
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
      ref: "ConversationMessage",
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "done", "snoozed"],
      default: "pending",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    snoozedUntil: {
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

// common queries: my pending followups, overdue
FollowUpReminderSchema.index({
  workspaceId: 1,
  assigneeId: 1,
  status: 1,
  dueAt: 1,
});

const FollowUpReminder = model<FollowUpReminderDocument>(
  "FollowUpReminder",
  FollowUpReminderSchema
);

export default FollowUpReminder;
