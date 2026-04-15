import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface CommunicationMessageDocument extends Document {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  authorId?: Types.ObjectId | null;
  authorName: string;
  authorEmail?: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommunicationMessageSchema = new Schema<CommunicationMessageDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Workspace',
      index: true,
    },
    threadId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Module5CommunicationThread',
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    authorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

CommunicationMessageSchema.index({ workspaceId: 1, threadId: 1, createdAt: 1 });

const CommunicationMessage =
  (mongoose.models.Module5CommunicationMessage as mongoose.Model<CommunicationMessageDocument>) ||
  mongoose.model<CommunicationMessageDocument>('Module5CommunicationMessage', CommunicationMessageSchema);

export default CommunicationMessage;
