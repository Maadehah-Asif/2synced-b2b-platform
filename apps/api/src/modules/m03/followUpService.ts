import { Types } from "mongoose";
import FollowUpReminder, {
  type FollowUpReminderDocument,
  type FollowUpStatus,
} from "./models/FollowUpReminder.js";
import ConversationThread, {
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import DealHealth, {
  type DealHealthDocument,
} from "./models/DealHealth.js";

export interface ListFollowUpsParams {
  workspaceId: string;
  assigneeId?: string;
  status?: FollowUpStatus | "pending_or_overdue" | "all";
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface FollowUpListItem {
  followUp: FollowUpReminderDocument;
  thread?: ConversationThreadDocument | null;
  latestHealth?: DealHealthDocument | null;
}

export interface ListFollowUpsResult {
  items: FollowUpListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UpdateFollowUpParams {
  workspaceId: string;
  followUpId: string;
  // controller will enforce who is allowed to change what,
  // here we only apply these fields if present
  status?: FollowUpStatus;
  dueAt?: string | Date;
  snoozedUntil?: string | Date | null;
}

/**
 * List follow-ups for a workspace, optionally filtered by assignee / status / overdue.
 * Authorization (who can see which assignee) should be enforced in the controller.
 * Populates thread and health data for each follow-up.
 */
export async function listFollowUps(
  params: ListFollowUpsParams
): Promise<ListFollowUpsResult> {
  const {
    workspaceId,
    assigneeId,
    status,
    overdueOnly = false,
    page = 1,
    pageSize = 20,
    search,
  } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const now = new Date();
  const query: any = {
    workspaceId: wsId,
  };

  if (assigneeId) {
    query.assigneeId = new Types.ObjectId(assigneeId);
  }

  // Handle status filter
  if (status && status !== "all") {
    if (status === "pending_or_overdue") {
      query.status = "pending";
      query.dueAt = { $lte: now };
    } else if ((status as string) === "overdue") {
      query.status = "pending";
      query.dueAt = { $lt: now };
    } else {
      // status is a valid FollowUpStatus (pending, done, or snoozed)
      const validStatus = status as FollowUpStatus;
      if (validStatus === "pending" || validStatus === "done" || validStatus === "snoozed") {
        query.status = validStatus;
      }
    }
  }

  if (overdueOnly) {
    query.status = "pending";
    query.dueAt = { $lt: now };
  }

  const total = await FollowUpReminder.countDocuments(query);

  const followUps = await FollowUpReminder.find(query)
    .sort({ dueAt: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

  // Get thread IDs and health data
  const threadIds = followUps.map((f) => f.threadId);
  
  const [threads, healthDocs] = await Promise.all([
    ConversationThread.find({
      _id: { $in: threadIds },
      workspaceId: wsId,
    }).exec(),
    DealHealth.find({
      threadId: { $in: threadIds },
      workspaceId: wsId,
    })
      .sort({ lastComputedAt: -1 })
      .exec(),
  ]);

  // Create maps for quick lookup
  const threadMap = new Map<string, ConversationThreadDocument>();
  for (const thread of threads) {
    threadMap.set(thread._id.toString(), thread);
  }

  // Group by threadId and take the latest health
  const healthByThread = new Map<string, DealHealthDocument>();
  for (const health of healthDocs) {
    const threadIdStr = health.threadId.toString();
    const existing = healthByThread.get(threadIdStr);
    if (!existing || health.lastComputedAt > existing.lastComputedAt) {
      healthByThread.set(threadIdStr, health);
    }
  }

  // Build items with thread and health data
  const items: FollowUpListItem[] = [];
  for (const followUp of followUps) {
    const threadIdStr = followUp.threadId.toString();
    const thread = threadMap.get(threadIdStr) || null;
    const health = healthByThread.get(threadIdStr) || null;

    // Filter by search if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      const matchesThread = thread?.subject?.toLowerCase().includes(searchLower);
      const matchesReason = followUp.reason?.toLowerCase().includes(searchLower);
      if (!matchesThread && !matchesReason) {
        continue; // Skip this item
      }
    }

    const item: FollowUpListItem = {
      followUp,
    };
    if (thread !== null) {
      item.thread = thread;
    }
    if (health !== null) {
      item.latestHealth = health;
    }
    items.push(item);
  }

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Update a follow-up reminder in a workspace.
 * The controller should ensure the current user is allowed to modify this follow-up
 * (assignee or admin). Here we only enforce workspace scoping.
 */
export async function updateFollowUp(
  params: UpdateFollowUpParams
): Promise<FollowUpReminderDocument | null> {
  const { workspaceId, followUpId, status, dueAt, snoozedUntil } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const fId = new Types.ObjectId(followUpId);

  const followUp = await FollowUpReminder.findOne({
    _id: fId,
    workspaceId: wsId,
  }).exec();

  if (!followUp) {
    return null;
  }

  if (typeof status !== "undefined") {
    followUp.status = status;
  }

  if (typeof dueAt !== "undefined") {
    followUp.dueAt =
      dueAt instanceof Date ? dueAt : new Date(dueAt as string);
  }

  if (typeof snoozedUntil !== "undefined") {
    if (snoozedUntil === null) {
      // remove the property instead of assigning undefined to satisfy
      // exactOptionalPropertyTypes (cast to any to avoid type error)
      delete (followUp as any).snoozedUntil;
    } else {
      followUp.snoozedUntil =
        snoozedUntil instanceof Date
          ? snoozedUntil
          : new Date(snoozedUntil as string);
    }
  }

  await followUp.save();
  return followUp;
}
