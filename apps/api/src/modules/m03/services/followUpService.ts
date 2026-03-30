/**
 * Follow-up Service
 * 
 * Creates and manages follow-up reminders based on deal health scores.
 */

import { Types } from "mongoose";
import FollowUpReminder, {
  type FollowUpReminderDocument,
} from "../models/FollowUpReminder.js";

/**
 * Upsert follow-ups for a thread based on health score and recency.
 * This function is called after deal health analysis to create follow-up reminders.
 */
export async function upsertFollowUpsForThread(opts: {
  workspaceId: Types.ObjectId;
  threadId: Types.ObjectId;
  assigneeId: Types.ObjectId;
  healthScore: number;
  daysSinceLastMessage: number;
}): Promise<void> {
  const { workspaceId, threadId, assigneeId, healthScore, daysSinceLastMessage } = opts;

  // Delete old pending follow-ups for this thread
  await FollowUpReminder.deleteMany({
    workspaceId,
    threadId,
    assigneeId,
    status: "pending",
  }).exec();

  const followUps: Partial<FollowUpReminderDocument>[] = [];
  const now = new Date();

  // Simple demo logic – enough to populate the table:
  if (healthScore <= 40 && daysSinceLastMessage >= 7) {
    followUps.push({
      workspaceId,
      threadId,
      assigneeId,
      status: "pending",
      dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      reason: "Deal at risk and last contact > 7 days – re-engage the prospect.",
      createdBy: assigneeId,
    });
  } else if (healthScore <= 60 && daysSinceLastMessage >= 14) {
    followUps.push({
      workspaceId,
      threadId,
      assigneeId,
      status: "pending",
      dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      reason: "Deal cooling down – send a check-in message.",
      createdBy: assigneeId,
    });
  } else if (healthScore > 70 && daysSinceLastMessage > 21) {
    followUps.push({
      workspaceId,
      threadId,
      assigneeId,
      status: "pending",
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      reason: "Healthy deal but quiet – light nudge to keep momentum.",
      createdBy: assigneeId,
    });
  }

  if (followUps.length > 0) {
    await FollowUpReminder.insertMany(followUps);
  }
}

