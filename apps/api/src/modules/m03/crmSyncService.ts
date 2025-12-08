import { Types } from "mongoose";
import ConversationThread from "./models/ConversationThreads.js";
import DealHealth from "./models/DealHealth.js";
import ConversationSyncLog, {
  type ConversationSyncLogDocument,
  type SyncStatus,
} from "./models/ConversationSyncLog.js";

export interface LogConversationSyncParams {
  workspaceId: string;
  threadId: string;
  dealId?: string;
  payload: any; // body we are sending to external CRM
  createdBy: string;
}

export interface LogConversationSyncResult {
  syncLog: ConversationSyncLogDocument;
}

/**
 * Create a ConversationSyncLog row when we attempt to sync a conversation
 * / deal health to an external CRM.
 *
 * For now this only records the intent; you can later augment this to
 * actually call the external API and update status accordingly.
 */
export async function logConversationSync(
  params: LogConversationSyncParams
): Promise<LogConversationSyncResult> {
  const { workspaceId, threadId, dealId, payload, createdBy } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const tId = new Types.ObjectId(threadId);
  const userId = new Types.ObjectId(createdBy);
  const dId = dealId ? new Types.ObjectId(dealId) : undefined;

  // Safety: ensure thread belongs to workspace
  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).lean();

  if (!thread) {
    throw new Error("Conversation thread not found in this workspace.");
  }

  // Optional: ensure provided dealId matches thread.dealId if present
  if (dId && thread.dealId && thread.dealId.toString() !== dId.toString()) {
    throw new Error("Deal does not belong to this conversation thread.");
  }

  // Optionally fetch latest deal health for context (not required)
  const latestHealth = await DealHealth.findOne({
    workspaceId: wsId,
    threadId: tId,
  })
    .sort({ lastComputedAt: -1 })
    .lean()
    .exec();

  const enrichedPayload = {
    ...payload,
    meta: {
      threadId: thread._id.toString(),
      workspaceId: wsId.toString(),
      dealId: dId ? dId.toString() : thread.dealId?.toString() ?? null,
      latestHealth: latestHealth
        ? {
            score: latestHealth.score,
            band: latestHealth.band,
            trend: latestHealth.trend,
          }
        : null,
    },
  };

  const syncLog = await ConversationSyncLog.create({
    workspaceId: wsId,
    threadId: tId,
    dealId: dId ?? thread.dealId,
    payload: enrichedPayload,
    status: "queued" as SyncStatus,
    errorMessage: undefined,
    syncedAt: undefined,
    createdBy: userId,
  });

  return { syncLog };
}

/**
 * Optional helper if you later implement actual CRM calls and want to
 * update the log afterwards.
 */
export interface UpdateSyncStatusParams {
  syncLogId: string;
  status: SyncStatus;
  errorMessage?: string;
}

export async function updateSyncStatus(
  params: UpdateSyncStatusParams
): Promise<ConversationSyncLogDocument | null> {
  const { syncLogId, status, errorMessage } = params;

  const id = new Types.ObjectId(syncLogId);

  const syncLog = await ConversationSyncLog.findById(id).exec();
  if (!syncLog) {
    return null;
  }

  syncLog.status = status;
  if (errorMessage !== undefined) {
    syncLog.errorMessage = errorMessage;
  } else {
    syncLog.set({ errorMessage: undefined });
  }
  if (status === "success") {
    syncLog.syncedAt = new Date();
  }

  await syncLog.save();
  return syncLog;
}
