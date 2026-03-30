/**
 * Company List Service
 * 
 * Provides aggregated company summaries for the companies view.
 */

import { Types } from "mongoose";
import ConversationThread from "../models/ConversationThreads.js";
import Company, { type CompanyDocument } from "../models/Company.js";
import DealHealth from "../models/DealHealth.js";

export interface M03CompanySummary {
  id: string; // Company._id as string
  name: string; // Company name
  threadCount: number;
  lastMessageAt: Date | null;
  lastHealthScore?: number | null;
}

/**
 * Generate a slug from company name for URL-safe ID.
 * For now, we'll use Company._id directly, but this function can be used if needed.
 */
function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * List all companies with conversation activity in a workspace.
 * Returns aggregated summaries with thread counts, last message dates, and health scores.
 */
export async function listCompaniesWithActivity(
  workspaceId: string
): Promise<M03CompanySummary[]> {
  const wsId = new Types.ObjectId(workspaceId);

  try {
    // Get distinct companyIds from threads that have companyId set
    const companyIds = await ConversationThread.distinct("companyId", {
      workspaceId: wsId,
      companyId: { $exists: true, $ne: null },
    }).exec();

    if (companyIds.length === 0) {
      return [];
    }

    // Aggregate threads by companyId to get counts and lastMessageAt
    const threadAggregation = await ConversationThread.aggregate([
      {
        $match: {
          workspaceId: wsId,
          companyId: { $in: companyIds },
        },
      },
      {
        $group: {
          _id: "$companyId",
          threadCount: { $sum: 1 },
          lastMessageAt: { $max: "$lastMessageAt" },
        },
      },
    ]).exec();

    // Create a map of companyId -> aggregation results
    const threadStatsMap = new Map<string, { threadCount: number; lastMessageAt: Date | null }>();
    for (const stat of threadAggregation) {
      const companyIdStr = stat._id?.toString();
      if (companyIdStr) {
        threadStatsMap.set(companyIdStr, {
          threadCount: stat.threadCount || 0,
          lastMessageAt: stat.lastMessageAt || null,
        });
      }
    }

    // Load Company documents
    const companies = await Company.find({
      _id: { $in: companyIds },
      workspaceId: wsId,
    })
      .select("_id name")
      .lean()
      .exec();

    // Get latest health scores per company (from threads)
    const healthScoresMap = new Map<string, number>();
    if (companyIds.length > 0) {
      // First, get all threadIds for these companies
      const threadIds = await ConversationThread.distinct("_id", {
        workspaceId: wsId,
        companyId: { $in: companyIds },
      }).exec();

      if (threadIds.length > 0) {
        // For each company, get the latest health score from any of its threads
        const healthAggregation = await DealHealth.aggregate([
          {
            $match: {
              workspaceId: wsId,
              threadId: { $in: threadIds },
            },
          },
          {
            $lookup: {
              from: "conversationthreads",
              localField: "threadId",
              foreignField: "_id",
              as: "thread",
            },
          },
          {
            $unwind: {
              path: "$thread",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $group: {
              _id: "$thread.companyId",
              maxScore: { $max: "$score" },
            },
          },
        ]).exec();

        for (const health of healthAggregation) {
          const companyIdStr = health._id?.toString();
          if (companyIdStr && health.maxScore !== undefined) {
            healthScoresMap.set(companyIdStr, health.maxScore);
          }
        }
      }
    }

    // Build summaries
    const summaries: M03CompanySummary[] = companies.map((c) => {
      const companyIdStr = c._id.toString();
      const stats = threadStatsMap.get(companyIdStr) || { threadCount: 0, lastMessageAt: null };
      const healthScore = healthScoresMap.get(companyIdStr);

      return {
        id: companyIdStr,
        name: c.name,
        threadCount: stats.threadCount,
        lastMessageAt: stats.lastMessageAt,
        lastHealthScore: healthScore !== undefined ? healthScore : null,
      };
    });

    // Sort by name
    summaries.sort((a, b) => a.name.localeCompare(b.name));

    return summaries;
  } catch (err) {
    console.error("Error listing companies:", err);
    return [];
  }
}

