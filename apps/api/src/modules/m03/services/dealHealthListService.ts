/**
 * Deal Health List Service
 * 
 * Provides functions to list deals with their health information for the DealHealthBoard UI.
 */

import { Types } from "mongoose";
import DealHealth, {
  type DealHealthDocument,
} from "../models/DealHealth.js";
import ConversationThread, {
  type ConversationThreadDocument,
} from "../models/ConversationThreads.js";

export interface DealHealthListItem {
  thread: {
    _id: string;
    subject: string;
    channel: "email" | "whatsapp" | "call" | "meeting" | "note" | "other";
    lastMessageAt?: string;
    dealId?: string;
    leadId?: string;
  };
  latestHealth: {
    _id: string;
    score: number;
    band: "healthy" | "steady" | "at_risk";
    trend?: "improving" | "worsening" | "flat";
    reasons?: string[];
  } | null;
}

export interface DealHealthListResult {
  items: DealHealthListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * List deals with health information for a workspace.
 */
export async function listDealHealth(
  workspaceId: string,
  options?: {
    page?: number;
    pageSize?: number;
    band?: "healthy" | "steady" | "at_risk";
    dealId?: string;
    sortBy?: "score" | "lastMessageAt" | "lastAnalyzedAt";
    sortOrder?: "asc" | "desc";
  }
): Promise<DealHealthListResult> {
  const wsId = new Types.ObjectId(workspaceId);
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const skip = (page - 1) * pageSize;

  // Build match query
  const match: any = { workspaceId: wsId };
  if (options?.band) {
    match.band = options.band;
  }
  if (options?.dealId) {
    match.dealId = new Types.ObjectId(options.dealId);
  }

  // Get latest health per thread (using aggregation to get most recent per thread)
  const healthAggregation = await DealHealth.aggregate([
    { $match: match },
    {
      $sort: { lastAnalyzedAt: -1 },
    },
    {
      $group: {
        _id: "$threadId",
        latestHealth: { $first: "$$ROOT" },
      },
    },
  ]).exec();

  const threadIds = healthAggregation.map((h) => h._id);
  const healthMap = new Map<string, DealHealthDocument>();
  for (const item of healthAggregation) {
    healthMap.set(item._id.toString(), item.latestHealth as any);
  }

  // Load threads
  const threads = await ConversationThread.find({
    _id: { $in: threadIds },
    workspaceId: wsId,
  })
    .sort({ lastMessageAt: -1 })
    .exec();

  // Build items
  const items: DealHealthListItem[] = threads.map((thread) => {
    const health = healthMap.get(thread._id.toString());
    const threadData: DealHealthListItem["thread"] = {
      _id: thread._id.toString(),
      subject: thread.subject,
      channel: thread.channel,
    };
    if (thread.lastMessageAt) {
      threadData.lastMessageAt = thread.lastMessageAt.toISOString();
    }
    if (thread.dealId) {
      threadData.dealId = thread.dealId.toString();
    }
    if (thread.leadId) {
      threadData.leadId = thread.leadId.toString();
    }
    return {
      thread: threadData,
      latestHealth: health
        ? {
            _id: health._id.toString(),
            score: health.score,
            band: health.band,
            trend:
              health.trend === "up"
                ? "improving"
                : health.trend === "down"
                ? "worsening"
                : "flat",
            reasons: health.reasons,
          }
        : null,
    };
  });

  // Sort items
  const sortBy = options?.sortBy || "lastMessageAt";
  const sortOrder = options?.sortOrder || "desc";
  items.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortBy === "score") {
      aVal = a.latestHealth?.score || 0;
      bVal = b.latestHealth?.score || 0;
    } else if (sortBy === "lastMessageAt") {
      aVal = a.thread.lastMessageAt
        ? new Date(a.thread.lastMessageAt).getTime()
        : 0;
      bVal = b.thread.lastMessageAt
        ? new Date(b.thread.lastMessageAt).getTime()
        : 0;
    } else {
      // lastAnalyzedAt
      aVal = a.latestHealth?._id ? 1 : 0;
      bVal = b.latestHealth?._id ? 1 : 0;
    }

    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  // Apply pagination
  const paginatedItems = items.slice(skip, skip + pageSize);

  // Count total (for now, use items length; could be optimized with a separate count query)
  const total = items.length;

  return {
    items: paginatedItems,
    page,
    pageSize,
    total,
  };
}

