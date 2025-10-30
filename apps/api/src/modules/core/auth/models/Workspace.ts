import mongoose, { Schema, Types, Model } from "mongoose";
import crypto from 'crypto';

export type WorkspaceStatus = "pending" | "active" | "inactive";

function generateShareId() {
  // 8-char hex string (sufficiently short and shareable)
  return crypto.randomBytes(4).toString('hex');
}

export interface WorkspaceDoc {
  _id: Types.ObjectId;
  name: string;
  shareId: string;
  status: WorkspaceStatus;
  ownerUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<WorkspaceDoc>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    shareId: { type: String, required: true, unique: true, default: generateShareId },
    status: { type: String, enum: ["pending", "active", "inactive"], default: "pending" },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Indexes are declared via `unique: true` on the name/shareId fields above.

export const Workspace: Model<WorkspaceDoc> =
  (mongoose.models.Workspace as Model<WorkspaceDoc>) || mongoose.model<WorkspaceDoc>("Workspace", WorkspaceSchema);

