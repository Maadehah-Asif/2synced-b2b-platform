import { Types } from "mongoose";
import ConversationThread from "../models/ConversationThreads.js";
import ConversationMessage from "../models/ConversationMessage.js";
import DealHealth from "../models/DealHealth.js";
import FollowUpReminder from "../models/FollowUpReminder.js";
import ConversationEntity from "../models/ConversationEntity.js";
import MessageSentiment from "../models/MessageSentiment.js";
import { computeFollowUpIntentFromDeal } from "./followUpIntentService.js";

export interface LeadProfileThreadSummary {
  threadId: string;
  subject: string;
  channel: "email" | "whatsapp" | "call" | "meeting" | "note" | "other";
  companyId?: string;
  lastMessageAt: string | null;
  firstMessageAt: string | null;
  messageCount: number;
  dealId?: string;
  latestHealth: {
    score: number | null;
    band: "healthy" | "steady" | "at_risk" | null;
    trend: "improving" | "worsening" | "flat" | null;
    lastComputedAt: string | null;
  };
}

export interface LeadProfileResponse {
  leadId: string;
  linkedThreadCount: number;
  latestOverallDealHealth: {
    averageScore: number | null;
    healthyCount: number;
    steadyCount: number;
    atRiskCount: number;
    latestScore: number | null;
    latestBand: "healthy" | "steady" | "at_risk" | null;
    latestComputedAt: string | null;
  };
  followUpSummary: {
    pendingCount: number;
    overdueCount: number;
  };
  groupedConversations: Array<{
    groupKey: string;
    threadCount: number;
    threads: LeadProfileThreadSummary[];
  }>;
  timeline: Array<{
    periodStart: string;
    label: string;
    messageCount: number;
    inboundCount: number;
    outboundCount: number;
    threadCount: number;
  }>;
  entities: {
    totalCount: number;
    byType: Array<{
      type: string;
      count: number;
      topValues: Array<{ value: string; count: number }>;
    }>;
  };
  sentimentSummary: {
    totalMessagesAnalyzed: number;
    averageScore: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
  mostRecentThreads: LeadProfileThreadSummary[];
  competitorMentions: {
    totalMentions: number;
    topCompetitors: Array<{ value: string; count: number }>;
  };
  latestFollowUpIntent: {
    sourceThreadId: string;
    label: string;
    confidence: number;
    suggestedMessage: string;
  } | null;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function normalizeTrend(
  trend?: "up" | "down" | "flat" | null
): "improving" | "worsening" | "flat" | null {
  if (!trend) return null;
  if (trend === "up") return "improving";
  if (trend === "down") return "worsening";
  return "flat";
}

export async function getLeadProfile(
  workspaceId: string,
  leadId: string
): Promise<LeadProfileResponse> {
  const wsId = new Types.ObjectId(workspaceId);
  const lId = new Types.ObjectId(leadId);
  const now = new Date();

  const threads = await ConversationThread.find({
    workspaceId: wsId,
    leadId: lId,
  })
    .sort({ lastMessageAt: -1 })
    .lean()
    .exec();

  if (threads.length === 0) {
    return {
      leadId,
      linkedThreadCount: 0,
      latestOverallDealHealth: {
        averageScore: null,
        healthyCount: 0,
        steadyCount: 0,
        atRiskCount: 0,
        latestScore: null,
        latestBand: null,
        latestComputedAt: null,
      },
      followUpSummary: {
        pendingCount: 0,
        overdueCount: 0,
      },
      groupedConversations: [],
      timeline: [],
      entities: {
        totalCount: 0,
        byType: [],
      },
      sentimentSummary: {
        totalMessagesAnalyzed: 0,
        averageScore: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
      },
      mostRecentThreads: [],
      competitorMentions: {
        totalMentions: 0,
        topCompetitors: [],
      },
      latestFollowUpIntent: null,
    };
  }

  const threadIds = threads.map((thread) => thread._id);

  const [healthDocs, followUps, messages, entities, sentiments] = await Promise.all([
    DealHealth.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
    })
      .sort({ lastComputedAt: -1 })
      .lean()
      .exec(),
    FollowUpReminder.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
      status: { $in: ["pending", "snoozed"] },
    })
      .lean()
      .exec(),
    ConversationMessage.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
    })
      .sort({ sentAt: -1 })
      .lean()
      .exec(),
    ConversationEntity.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
      status: { $ne: "obsolete" },
    })
      .lean()
      .exec(),
    MessageSentiment.find({
      workspaceId: wsId,
      threadId: { $in: threadIds },
    })
      .lean()
      .exec(),
  ]);

  const latestHealthByThread = new Map<string, (typeof healthDocs)[number]>();
  for (const health of healthDocs) {
    const key = health.threadId.toString();
    if (!latestHealthByThread.has(key)) {
      latestHealthByThread.set(key, health);
    }
  }

  const threadSummaries: LeadProfileThreadSummary[] = threads.map((thread) => {
    const latestHealth = latestHealthByThread.get(thread._id.toString());
    const summary: LeadProfileThreadSummary = {
      threadId: thread._id.toString(),
      subject: thread.subject,
      channel: thread.channel,
      lastMessageAt: thread.lastMessageAt ? new Date(thread.lastMessageAt).toISOString() : null,
      firstMessageAt: thread.firstMessageAt ? new Date(thread.firstMessageAt).toISOString() : null,
      messageCount: thread.messageCount || 0,
      latestHealth: {
        score: typeof latestHealth?.score === "number" ? latestHealth.score : null,
        band: latestHealth?.band || null,
        trend: normalizeTrend(latestHealth?.trend || null),
        lastComputedAt: latestHealth?.lastComputedAt
          ? new Date(latestHealth.lastComputedAt).toISOString()
          : null,
      },
    };
    if (thread.companyId) {
      summary.companyId = thread.companyId.toString();
    }
    if (thread.dealId) {
      summary.dealId = thread.dealId.toString();
    }
    return summary;
  });

  const groupedConversations = Array.from(
    threadSummaries.reduce((map, thread) => {
      const key = thread.channel || "other";
      const existing = map.get(key) || [];
      existing.push(thread);
      map.set(key, existing);
      return map;
    }, new Map<string, LeadProfileThreadSummary[]>())
  )
    .map(([groupKey, groupThreads]) => ({
      groupKey,
      threadCount: groupThreads.length,
      threads: groupThreads.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      }),
    }))
    .sort((a, b) => b.threadCount - a.threadCount || a.groupKey.localeCompare(b.groupKey));

  const timelineBuckets = new Map<
    string,
    {
      periodStart: string;
      label: string;
      messageCount: number;
      inboundCount: number;
      outboundCount: number;
      threadIds: Set<string>;
    }
  >();

  for (const message of messages) {
    const sentAt = message.sentAt ? new Date(message.sentAt) : null;
    if (!sentAt || Number.isNaN(sentAt.getTime())) continue;
    const bucketDate = startOfMonth(sentAt);
    const periodStart = bucketDate.toISOString();
    const existing = timelineBuckets.get(periodStart) || {
      periodStart,
      label: formatMonthLabel(bucketDate),
      messageCount: 0,
      inboundCount: 0,
      outboundCount: 0,
      threadIds: new Set<string>(),
    };
    existing.messageCount += 1;
    if (message.direction === "inbound") existing.inboundCount += 1;
    if (message.direction === "outbound") existing.outboundCount += 1;
    existing.threadIds.add(message.threadId.toString());
    timelineBuckets.set(periodStart, existing);
  }

  const timeline = Array.from(timelineBuckets.values())
    .map((bucket) => ({
      periodStart: bucket.periodStart,
      label: bucket.label,
      messageCount: bucket.messageCount,
      inboundCount: bucket.inboundCount,
      outboundCount: bucket.outboundCount,
      threadCount: bucket.threadIds.size,
    }))
    .sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime());

  const entityByType = new Map<string, Map<string, number>>();
  for (const entity of entities) {
    const type = entity.type || "other";
    const value = (entity.value || "").trim();
    if (!value) continue;
    const typeMap = entityByType.get(type) || new Map<string, number>();
    typeMap.set(value, (typeMap.get(value) || 0) + 1);
    entityByType.set(type, typeMap);
  }

  const entityTypeSummaries = Array.from(entityByType.entries())
    .map(([type, values]) => {
      const topValues = Array.from(values.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, 10);
      const count = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
      return { type, count, topValues };
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const sentimentSummary = sentiments.reduce(
    (acc, sentiment) => {
      acc.totalMessagesAnalyzed += 1;
      acc.totalScore += sentiment.score || 0;
      if (sentiment.label === "positive") acc.positiveCount += 1;
      else if (sentiment.label === "negative") acc.negativeCount += 1;
      else acc.neutralCount += 1;
      return acc;
    },
    {
      totalMessagesAnalyzed: 0,
      totalScore: 0,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
    }
  );

  const latestHealthDocs = Array.from(latestHealthByThread.values());
  const averageScore =
    latestHealthDocs.length > 0
      ? latestHealthDocs.reduce((sum, item) => sum + item.score, 0) / latestHealthDocs.length
      : null;

  const latestOverallHealth =
    latestHealthDocs.length > 0
      ? latestHealthDocs
          .slice()
          .sort(
            (a, b) =>
              new Date(b.lastComputedAt).getTime() - new Date(a.lastComputedAt).getTime()
          )[0]
      : null;

  const pendingCount = followUps.length;
  const overdueCount = followUps.filter((followUp) => {
    if (!followUp.dueAt) return false;
    return new Date(followUp.dueAt).getTime() < now.getTime();
  }).length;

  const competitorType = entityTypeSummaries.find((item) => item.type === "competitor");

  let latestFollowUpIntent: LeadProfileResponse["latestFollowUpIntent"] = null;
  if (latestOverallHealth) {
    const sourceThread = threads.find(
      (thread) => thread._id.toString() === latestOverallHealth.threadId.toString()
    );
    const primaryProspect = sourceThread?.participants?.find((participant) => participant.role === "prospect");
    const intentContext: { contactName?: string; companyName?: string } = {};
    if (primaryProspect?.name) {
      intentContext.contactName = primaryProspect.name;
    }
    // Current limitation: Module 3 threads do not consistently hold a lead label, so we avoid guessing one here.
    if (sourceThread?.subject) {
      intentContext.companyName = sourceThread.subject;
    }
    const intent = computeFollowUpIntentFromDeal(latestOverallHealth as any, intentContext);

    if (intent && sourceThread) {
      latestFollowUpIntent = {
        sourceThreadId: sourceThread._id.toString(),
        label: intent.intent,
        confidence: intent.confidence,
        suggestedMessage: intent.suggestedMessage,
      };
    }
  }

  return {
    leadId,
    linkedThreadCount: threads.length,
    latestOverallDealHealth: {
      averageScore: averageScore != null ? Number(averageScore.toFixed(2)) : null,
      healthyCount: latestHealthDocs.filter((item) => item.band === "healthy").length,
      steadyCount: latestHealthDocs.filter((item) => item.band === "steady").length,
      atRiskCount: latestHealthDocs.filter((item) => item.band === "at_risk").length,
      latestScore: latestOverallHealth?.score ?? null,
      latestBand: latestOverallHealth?.band ?? null,
      latestComputedAt: latestOverallHealth?.lastComputedAt
        ? new Date(latestOverallHealth.lastComputedAt).toISOString()
        : null,
    },
    followUpSummary: {
      pendingCount,
      overdueCount,
    },
    groupedConversations,
    timeline,
    entities: {
      totalCount: entities.length,
      byType: entityTypeSummaries,
    },
    sentimentSummary: {
      totalMessagesAnalyzed: sentimentSummary.totalMessagesAnalyzed,
      averageScore:
        sentimentSummary.totalMessagesAnalyzed > 0
          ? Number((sentimentSummary.totalScore / sentimentSummary.totalMessagesAnalyzed).toFixed(3))
          : 0,
      positiveCount: sentimentSummary.positiveCount,
      neutralCount: sentimentSummary.neutralCount,
      negativeCount: sentimentSummary.negativeCount,
    },
    mostRecentThreads: threadSummaries.slice(0, 6),
    competitorMentions: {
      totalMentions: competitorType?.count || 0,
      topCompetitors: competitorType?.topValues || [],
    },
    latestFollowUpIntent,
  };
}
