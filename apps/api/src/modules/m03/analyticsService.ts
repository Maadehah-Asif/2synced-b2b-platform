import { Types } from "mongoose";
import ConversationThread from "./models/ConversationThreads.js";
import ConversationMessage from "./models/ConversationMessage.js";
import MessageSentiment from "./models/MessageSentiment.js";
import ConversationEntity from "./models/ConversationEntity.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AnalyticsSummary {
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sentimentOverTime: {
    date: string;
    avgScore: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  }[];
  entityCounts: {
    type: string;
    count: number;
  }[];
  topEntities: {
    type: string;
    value: string;
    count: number;
  }[];
  channelCoverage: {
    channel: string;
    threadCount: number;
    messageCount: number;
  }[];
  totalThreads: number;
  totalMessages: number;
}

// -----------------------------------------------------------------------------
// Main analytics summary builder
// -----------------------------------------------------------------------------

export async function buildAnalyticsSummaryForWorkspace(
  workspaceId: Types.ObjectId | string,
  opts?: { channel?: string }
): Promise<AnalyticsSummary> {
  const wsId =
    workspaceId instanceof Types.ObjectId
      ? workspaceId
      : new Types.ObjectId(workspaceId);

  // Build base match query
  const baseMatch: any = { workspaceId: wsId };
  if (opts?.channel && opts.channel !== "all") {
    baseMatch.channel = opts.channel;
  }

  // Get thread IDs that match the filter (for message queries)
  const matchingThreads = await ConversationThread.find(baseMatch)
    .select("_id channel")
    .lean()
    .exec();
  const threadIds = matchingThreads.map((t) => t._id);

  // -----------------------------------------------------------------------------
  // 1. Total threads and messages
  // -----------------------------------------------------------------------------

  const totalThreads = await ConversationThread.countDocuments(baseMatch);

  const messageMatch: any = {
    workspaceId: wsId,
  };
  if (threadIds.length > 0) {
    messageMatch.threadId = { $in: threadIds };
  } else {
    // If no threads match, return early with empty data
    return {
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
      sentimentOverTime: [],
      entityCounts: [],
      topEntities: [],
      channelCoverage: [],
      totalThreads: 0,
      totalMessages: 0,
    };
  }

  // Optionally filter messages by channel via thread lookup
  if (opts?.channel && opts.channel !== "all") {
    const channelThreadIds = matchingThreads
      .filter((t) => t.channel === opts.channel)
      .map((t) => t._id);
    if (channelThreadIds.length > 0) {
      messageMatch.threadId = { $in: channelThreadIds };
    } else {
      messageMatch.threadId = { $in: [] }; // No threads for this channel
    }
  }

  const totalMessages = await ConversationMessage.countDocuments(messageMatch);

  // -----------------------------------------------------------------------------
  // 2. Sentiment distribution
  // -----------------------------------------------------------------------------

  const sentimentMatch: any = { workspaceId: wsId };
  if (threadIds.length > 0) {
    sentimentMatch.threadId = { $in: threadIds };
  } else {
    sentimentMatch.threadId = { $in: [] };
  }

  // If channel filter is applied, we need to join via threads
  if (opts?.channel && opts.channel !== "all") {
    const channelThreadIds = matchingThreads
      .filter((t) => t.channel === opts.channel)
      .map((t) => t._id);
    if (channelThreadIds.length > 0) {
      sentimentMatch.threadId = { $in: channelThreadIds };
    } else {
      sentimentMatch.threadId = { $in: [] };
    }
  }

  const sentimentDistributionAgg = await MessageSentiment.aggregate([
    { $match: sentimentMatch },
    {
      $group: {
        _id: "$label",
        count: { $sum: 1 },
      },
    },
  ]).exec();

  const sentimentDistribution = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  for (const item of sentimentDistributionAgg) {
    if (item._id === "positive") sentimentDistribution.positive = item.count;
    else if (item._id === "neutral") sentimentDistribution.neutral = item.count;
    else if (item._id === "negative")
      sentimentDistribution.negative = item.count;
  }

  // -----------------------------------------------------------------------------
  // 3. Sentiment over time
  // -----------------------------------------------------------------------------

  const sentimentOverTimeAgg = await MessageSentiment.aggregate([
    {
      $match: sentimentMatch,
    },
    {
      $lookup: {
        from: "conversationmessages",
        localField: "messageId",
        foreignField: "_id",
        as: "message",
      },
    },
    { $unwind: { path: "$message", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$message.sentAt" },
          },
        },
        avgScore: { $avg: "$score" },
        positiveCount: {
          $sum: { $cond: [{ $eq: ["$label", "positive"] }, 1, 0] },
        },
        neutralCount: {
          $sum: { $cond: [{ $eq: ["$label", "neutral"] }, 1, 0] },
        },
        negativeCount: {
          $sum: { $cond: [{ $eq: ["$label", "negative"] }, 1, 0] },
        },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]).exec();

  const sentimentOverTime = sentimentOverTimeAgg.map((item: any) => ({
    date: item._id.date,
    avgScore: item.avgScore || 0,
    positiveCount: item.positiveCount || 0,
    neutralCount: item.neutralCount || 0,
    negativeCount: item.negativeCount || 0,
  }));

  // -----------------------------------------------------------------------------
  // 4. Entity counts
  // -----------------------------------------------------------------------------

  const entityMatch: any = {
    workspaceId: wsId,
    status: { $ne: "obsolete" }, // Only active entities
  };

  if (threadIds.length > 0) {
    entityMatch.threadId = { $in: threadIds };
  } else {
    entityMatch.threadId = { $in: [] };
  }

  // If channel filter is applied, join via threads
  if (opts?.channel && opts.channel !== "all") {
    const channelThreadIds = matchingThreads
      .filter((t) => t.channel === opts.channel)
      .map((t) => t._id);
    if (channelThreadIds.length > 0) {
      entityMatch.threadId = { $in: channelThreadIds };
    } else {
      entityMatch.threadId = { $in: [] };
    }
  }

  const entityCountsAgg = await ConversationEntity.aggregate([
    {
      $match: entityMatch,
    },
    {
      $lookup: {
        from: "conversationthreads",
        localField: "threadId",
        foreignField: "_id",
        as: "thread",
      },
    },
    { $unwind: { path: "$thread", preserveNullAndEmptyArrays: false } },
    {
      $match: opts?.channel && opts.channel !== "all"
        ? { "thread.channel": opts.channel }
        : {},
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]).exec();

  const entityCounts = entityCountsAgg.map((item: any) => ({
    type: item._id,
    count: item.count,
  }));

  // -----------------------------------------------------------------------------
  // 5. Top entities
  // -----------------------------------------------------------------------------

  const topEntitiesAgg = await ConversationEntity.aggregate([
    {
      $match: entityMatch,
    },
    {
      $lookup: {
        from: "conversationthreads",
        localField: "threadId",
        foreignField: "_id",
        as: "thread",
      },
    },
    { $unwind: { path: "$thread", preserveNullAndEmptyArrays: false } },
    {
      $match: opts?.channel && opts.channel !== "all"
        ? { "thread.channel": opts.channel }
        : {},
    },
    {
      $group: {
        _id: {
          type: "$type",
          value: { $toLower: "$value" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).exec();

  const topEntities = topEntitiesAgg.map((item: any) => ({
    type: item._id.type,
    value: item._id.value,
    count: item.count,
  }));

  // -----------------------------------------------------------------------------
  // 6. Channel coverage
  // -----------------------------------------------------------------------------

  const channelCoverageAgg = await ConversationThread.aggregate([
    { $match: { workspaceId: wsId } },
    {
      $group: {
        _id: "$channel",
        threadCount: { $sum: 1 },
      },
    },
  ]).exec();

  // Get message counts per channel
  const channelMessageCounts = await ConversationMessage.aggregate([
    {
      $match: { workspaceId: wsId },
    },
    {
      $lookup: {
        from: "conversationthreads",
        localField: "threadId",
        foreignField: "_id",
        as: "thread",
      },
    },
    { $unwind: { path: "$thread", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: "$thread.channel",
        messageCount: { $sum: 1 },
      },
    },
  ]).exec();

  const channelMessageMap: Record<string, number> = {};
  for (const item of channelMessageCounts) {
    channelMessageMap[item._id] = item.messageCount;
  }

  const allChannels: string[] = [
    "email",
    "whatsapp",
    "call",
    "meeting",
    "note",
    "other",
  ];

  const channelCoverage = allChannels.map((channel) => {
    const threadData = channelCoverageAgg.find((c: any) => c._id === channel);
    return {
      channel,
      threadCount: threadData?.threadCount || 0,
      messageCount: channelMessageMap[channel] || 0,
    };
  });

  // -----------------------------------------------------------------------------
  // Return summary
  // -----------------------------------------------------------------------------

  return {
    sentimentDistribution,
    sentimentOverTime,
    entityCounts,
    topEntities,
    channelCoverage,
    totalThreads,
    totalMessages,
  };
}

