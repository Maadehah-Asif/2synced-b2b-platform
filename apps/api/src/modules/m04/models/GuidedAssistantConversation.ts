import mongoose, { Schema, Types, Model } from "mongoose";

export type GuidedAssistantSender = "user" | "assistant" | "admin";
export type GuidedAssistantMessageKind = "faq_question" | "faq_answer" | "custom_question" | "admin_reply";

export interface GuidedAssistantMessageDoc {
  _id: Types.ObjectId;
  sender: GuidedAssistantSender;
  kind: GuidedAssistantMessageKind;
  text: string;
  faqId?: string | null;
  createdAt: Date;
}

export interface GuidedAssistantConversationDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  pageKey: string;
  hasPendingAdminReply: boolean;
  needsAdminForward: boolean;
  messages: Types.DocumentArray<GuidedAssistantMessageDoc>;
  createdAt: Date;
  updatedAt: Date;
}

const GuidedAssistantMessageSchema = new Schema<GuidedAssistantMessageDoc>(
  {
    sender: { type: String, enum: ["user", "assistant", "admin"], required: true },
    kind: { type: String, enum: ["faq_question", "faq_answer", "custom_question", "admin_reply"], required: true },
    text: { type: String, required: true, trim: true },
    faqId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true, id: false }
);

const GuidedAssistantConversationSchema = new Schema<GuidedAssistantConversationDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pageKey: { type: String, required: true, trim: true, index: true },
    hasPendingAdminReply: { type: Boolean, default: false, index: true },
    needsAdminForward: { type: Boolean, default: false, index: true },
    messages: { type: [GuidedAssistantMessageSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "m04_guided_assistant_conversations",
  }
);

GuidedAssistantConversationSchema.index({ workspaceId: 1, userId: 1, pageKey: 1 }, { unique: true });

export const GuidedAssistantConversation: Model<GuidedAssistantConversationDoc> =
  (mongoose.models.GuidedAssistantConversation as Model<GuidedAssistantConversationDoc>) ||
  mongoose.model<GuidedAssistantConversationDoc>("GuidedAssistantConversation", GuidedAssistantConversationSchema);

export default GuidedAssistantConversation;
