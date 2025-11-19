import mongoose, { Schema, Types, Model } from "mongoose";

export type MemberRole =
  | "head_manager"
  | "sales_manager"
  | "marketing_manager"
  | "sales_team_member"
  | "marketing_team_member";

export interface WorkspaceMemberDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MemberRole;
  status: "pending" | "active" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<WorkspaceMemberDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["head_manager", "sales_manager", "marketing_manager", "sales_team_member", "marketing_team_member"],
      required: true,
    },
      status: { type: String, enum: ["pending", "active", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMember: Model<WorkspaceMemberDoc> =
  (mongoose.models.WorkspaceMember as Model<WorkspaceMemberDoc>) ||
  mongoose.model<WorkspaceMemberDoc>("WorkspaceMember", WorkspaceMemberSchema);

