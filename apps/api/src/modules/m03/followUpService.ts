import { Types } from "mongoose";
import FollowUpReminder, {
  type FollowUpReminderDocument,
  type FollowUpStatus,
} from "./models/FollowUpReminder.js";

export interface ListFollowUpsParams {
  workspaceId: string;
  assigneeId?: string;
  status?: FollowUpStatus;
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListFollowUpsResult {
  items: FollowUpReminderDocument[];
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
  } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const query: any = {
    workspaceId: wsId,
  };

  if (assigneeId) {
    query.assigneeId = new Types.ObjectId(assigneeId);
  }

  if (status) {
    query.status = status;
  }

  if (overdueOnly) {
    query.status = "pending";
    query.dueAt = { $lt: new Date() };
  }

  const total = await FollowUpReminder.countDocuments(query);

  const items = await FollowUpReminder.find(query)
    .sort({ dueAt: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .exec();

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
