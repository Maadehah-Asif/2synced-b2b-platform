import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type CommunicationThreadType =
  | 'lead_issue'
  | 'campaign_issue'
  | 'alignment_concern'
  | 'follow_up'
  | 'blocker'
  | 'general';

export type CommunicationThreadStatus = 'open' | 'in_progress' | 'resolved';
export type CommunicationThreadPriority = 'low' | 'medium' | 'high';

export interface CommunicationParticipant {
  name: string;
  email?: string;
}

export interface CommunicationThreadDocument extends Document {
  workspaceId: Types.ObjectId;
  title: string;
  type: CommunicationThreadType;
  status: CommunicationThreadStatus;
  priority: CommunicationThreadPriority;
  createdBy?: Types.ObjectId | null;
  createdByName: string;
  createdByEmail?: string | null;
  participants: CommunicationParticipant[];
  messageCount: number;
  lastMessageAt?: Date | null;
  lastMessagePreview?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<CommunicationParticipant>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const CommunicationThreadSchema = new Schema<CommunicationThreadDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Workspace',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    type: {
      type: String,
      required: true,
      enum: ['lead_issue', 'campaign_issue', 'alignment_concern', 'follow_up', 'blocker', 'general'],
      default: 'general',
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    createdByEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    participants: {
      type: [ParticipantSchema],
      default: [],
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      maxlength: 280,
      default: null,
    },
  },
  { timestamps: true }
);

CommunicationThreadSchema.index({ workspaceId: 1, updatedAt: -1 });
CommunicationThreadSchema.index({ workspaceId: 1, status: 1, priority: 1, updatedAt: -1 });
CommunicationThreadSchema.index({ workspaceId: 1, type: 1, updatedAt: -1 });
CommunicationThreadSchema.index({ workspaceId: 1, title: 'text', createdByName: 'text', lastMessagePreview: 'text' });

const CommunicationThread =
  (mongoose.models.Module5CommunicationThread as mongoose.Model<CommunicationThreadDocument>) ||
  mongoose.model<CommunicationThreadDocument>('Module5CommunicationThread', CommunicationThreadSchema);

export default CommunicationThread;
