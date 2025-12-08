import { Types } from "mongoose";
import ConversationThread from "./models/ConversationThreads.js";
import DealHealth from "./models/DealHealth.js";
import ConversationEntity from "./models/ConversationEntity.js";
import FollowUpReminder from "./models/FollowUpReminder.js";

export interface HealthBandSummaryItem {
  band: "healthy" | "neutral" | "at_risk";
  count: number;
}

export interface CompetitorSummaryItem {
  name: string;
  count: number;
}

export interface ConversationSummary {
  totalThreads: number;
  healthByBand: HealthBandSummaryItem[];
  averageHealthScore?: number | null;
  pendingFollowUps: number;
  overdueFollowUps: number;
  topCompetitors: CompetitorSummaryItem[];
}

/**
 * Return high-level summary metrics for the module 3 dashboard.
 */
export async function getConversationSummary(
  workspaceId: string
): Promise<ConversationSummary> {
  const wsId = new Types.ObjectId(workspaceId);
  const now = new Date();

  const [
    totalThreads,
    healthAgg,
    followUpsAgg,
    competitorAgg,
  ] = await Promise.all([
    ConversationThread.countDocuments({ workspaceId: wsId }),

    // healthAgg: count per band + average score
    DealHealth.aggregate([
      { $match: { workspaceId: wsId } },
      {
        $sort: { lastComputedAt: -1 },
      },
      // keep latest per thread
      {
        $group: {
          _id: "$threadId",
          band: { $first: "$band" },
          score: { $first: "$score" },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$score" },
          bands: {
            $push: {
              band: "$band",
              score: "$score",
            },
          },
        },
      },
    ]).exec(),

    // followUpsAgg: pending + overdue
    FollowUpReminder.aggregate([
      {
        $match: {
          workspaceId: wsId,
          status: { $in: ["pending", "snoozed"] },
        },
      },
      {
        $group: {
          _id: null,
          pending: { $sum: 1 },
          overdue: {
            $sum: {
              $cond: [{ $lt: ["$dueAt", now] }, 1, 0],
            },
          },
        },
      },
    ]).exec(),

    // competitorAgg: top 5 competitors by mentions
    ConversationEntity.aggregate([
      {
        $match: {
          workspaceId: wsId,
          type: "competitor",
        },
      },
      {
        $group: {
          _id: { $toLower: "$value" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).exec(),
  ]);

  // Parse healthAgg
  let healthByBand: HealthBandSummaryItem[] = [
    { band: "healthy", count: 0 },
    { band: "neutral", count: 0 },
    { band: "at_risk", count: 0 },
  ];
  let averageHealthScore: number | null = null;

  if (healthAgg.length > 0) {
    const row = healthAgg[0] as any;
    averageHealthScore =
      typeof row.avgScore === "number" ? row.avgScore : null;

    const bandCounts: Record<string, number> = {};
    for (const item of row.bands as { band: string; score: number }[]) {
      bandCounts[item.band] = (bandCounts[item.band] || 0) + 1;
    }

    healthByBand = [
      {
        band: "healthy",
        count: bandCounts["healthy"] || 0,
      },
      {
        band: "neutral",
        count: bandCounts["neutral"] || 0,
      },
      {
        band: "at_risk",
        count: bandCounts["at_risk"] || 0,
      },
    ];
  }

  // Parse followUpsAgg
  let pendingFollowUps = 0;
  let overdueFollowUps = 0;
  if (followUpsAgg.length > 0) {
    const row = followUpsAgg[0] as any;
    pendingFollowUps = row.pending || 0;
    overdueFollowUps = row.overdue || 0;
  }

  // Parse competitorAgg
  const topCompetitors: CompetitorSummaryItem[] = (competitorAgg as any[]).map(
    (row) => ({
      name: row._id as string,
      count: row.count as number,
    })
  );

  return {
    totalThreads,
    healthByBand,
    averageHealthScore,
    pendingFollowUps,
    overdueFollowUps,
    topCompetitors,
  };
}
