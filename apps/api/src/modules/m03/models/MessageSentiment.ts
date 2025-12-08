import mongoose, { Document, Types } from "mongoose";

const { Schema, model } = mongoose;

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface MessageSentimentDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  messageId: Types.ObjectId;
  label: SentimentLabel;
  score: number; // e.g. -1..1
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
    score: {
      type: Number,
      required: true,
      min: -1,
      max: 1,
    },
  },
  {
    timestamps: true,
  }
);

MessageSentimentSchema.index({ workspaceId: 1, threadId: 1 });
MessageSentimentSchema.index({ workspaceId: 1, label: 1 });

const MessageSentiment = model<MessageSentimentDocument>(
  "MessageSentiment",
  MessageSentimentSchema
);

export default MessageSentiment;
