/**
 * Deal Health Feature Extraction Service
 * 
 * Computes the 18 features required for deal health prediction from
 * conversation threads, messages, sentiments, and entities.
 */

import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "../models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "../models/ConversationMessage.js";
import MessageSentiment, {
  type MessageSentimentDocument,
} from "../models/MessageSentiment.js";
import ConversationEntity, {
  type ConversationEntityDocument,
} from "../models/ConversationEntity.js";
import type { DealHealthFeatures } from "./dealHealthModel.js";

/**
 * Compute all 18 features for deal health prediction.
 */
export async function computeDealHealthFeaturesForThread(
  workspaceId: Types.ObjectId | string,
  threadId: Types.ObjectId | string
): Promise<DealHealthFeatures> {
  const wsId =
    workspaceId instanceof Types.ObjectId
      ? workspaceId
      : new Types.ObjectId(workspaceId);
  const tId =
    threadId instanceof Types.ObjectId ? threadId : new Types.ObjectId(threadId);

  // Load thread and validate
  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).exec();

  if (!thread) {
    throw new Error("Conversation thread not found in this workspace.");
  }

  // Load all related data
  const [messages, sentiments, entities] = await Promise.all([
    ConversationMessage.find({
      workspaceId: wsId,
      threadId: tId,
    })
      .sort({ sentAt: 1 })
      .exec(),
    MessageSentiment.find({
      workspaceId: wsId,
      threadId: tId,
    }).exec(),
    ConversationEntity.find({
      workspaceId: wsId,
      threadId: tId,
      status: "active",
    }).exec(),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Define "recent" window: last 5 messages or last 30 days, whichever is smaller
  const recentWindowSize = Math.min(5, messages.length);
  const recentMessages = messages.slice(-recentWindowSize);
  const recentCutoffDate = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const recentMessagesByDate = messages.filter(
    (m) => m.sentAt >= recentCutoffDate
  );

  // Create a map of messageId -> sentiment for quick lookup
  const sentimentMap = new Map<string, MessageSentimentDocument>();
  for (const s of sentiments) {
    sentimentMap.set(s.messageId.toString(), s);
  }

  // 1. avg_sentiment_all: average of all message sentiment scores
  let avg_sentiment_all = 0;
  if (sentiments.length > 0) {
    const sum = sentiments.reduce((acc, s) => acc + s.score, 0);
    avg_sentiment_all = sum / sentiments.length;
  }

  // 2. avg_sentiment_recent: average over recent messages
  let avg_sentiment_recent = 0;
  const recentSentiments = recentMessages
    .map((m) => sentimentMap.get(m._id.toString()))
    .filter((s): s is MessageSentimentDocument => s !== undefined);
  if (recentSentiments.length > 0) {
    const sum = recentSentiments.reduce((acc, s) => acc + s.score, 0);
    avg_sentiment_recent = sum / recentSentiments.length;
  } else {
    avg_sentiment_recent = avg_sentiment_all; // Fallback
  }

  // 3. sentiment_trend: recent - older
  const olderSentiments = sentiments.filter(
    (s) => !recentSentiments.includes(s)
  );
  let avg_older = 0;
  if (olderSentiments.length > 0) {
    const sum = olderSentiments.reduce((acc, s) => acc + s.score, 0);
    avg_older = sum / olderSentiments.length;
  }
  const sentiment_trend = avg_sentiment_recent - avg_older;

  // 4. sentiment_volatility: standard deviation of scores, normalized to 0..1
  let sentiment_volatility = 0;
  if (sentiments.length > 1) {
    const scores = sentiments.map((s) => s.score);
    const mean = avg_sentiment_all;
    const variance =
      scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) /
      scores.length;
    const stdDev = Math.sqrt(variance);
    // Normalize: stdDev can be at most ~2 (from -1 to 1 range), so divide by 2
    sentiment_volatility = Math.min(1, stdDev / 2);
  }

  // 5. pos_ratio_all: count positive labels / total
  const pos_ratio_all =
    sentiments.length > 0
      ? sentiments.filter((s) => s.label === "positive").length /
        sentiments.length
      : 0;

  // 6. neg_ratio_all: count negative labels / total
  const neg_ratio_all =
    sentiments.length > 0
      ? sentiments.filter((s) => s.label === "negative").length /
        sentiments.length
      : 0;

  // 7. neg_ratio_recent: same but only recent window
  const neg_ratio_recent =
    recentSentiments.length > 0
      ? recentSentiments.filter((s) => s.label === "negative").length /
        recentSentiments.length
      : 0;

  // 8. days_since_last_inbound: days since last inbound message
  const inboundMessages = messages.filter((m) => m.direction === "inbound");
  let days_since_last_inbound = 60; // Default high value if no inbound
  if (inboundMessages.length > 0) {
    const lastInbound = inboundMessages[inboundMessages.length - 1];
    if (lastInbound) {
      const daysDiff =
        (now.getTime() - lastInbound.sentAt.getTime()) /
        (1000 * 60 * 60 * 24);
      days_since_last_inbound = Math.min(60, Math.max(0, daysDiff));
    }
  }

  // 9. total_messages_log: Math.log1p(totalMessages)
  const total_messages_log = Math.log1p(messages.length);

  // 10. inbound_to_outbound_ratio_recent: in recent window, inbound / outbound
  const recentInbound = recentMessagesByDate.filter(
    (m) => m.direction === "inbound"
  ).length;
  const recentOutbound = recentMessagesByDate.filter(
    (m) => m.direction === "outbound"
  ).length;
  let inbound_to_outbound_ratio_recent = 0;
  if (recentOutbound > 0) {
    inbound_to_outbound_ratio_recent = recentInbound / recentOutbound;
  } else if (recentInbound > 0) {
    inbound_to_outbound_ratio_recent = 3; // Cap at 3
  }
  inbound_to_outbound_ratio_recent = Math.min(3, Math.max(0, inbound_to_outbound_ratio_recent));

  // 11-14. Entity flags: has_budget, has_decision_maker, has_timeline, has_competitor
  const has_budget = entities.some((e) => e.type === "budget") ? 1 : 0;
  const has_decision_maker = entities.some(
    (e) => e.type === "decision_maker"
  )
    ? 1
    : 0;
  const has_timeline = entities.some((e) => e.type === "timeline") ? 1 : 0;
  const has_competitor = entities.some((e) => e.type === "competitor") ? 1 : 0;

  // 15. num_unique_prospect_contacts: distinct prospect participants
  const prospectEmails = new Set<string>();
  const prospectNames = new Set<string>();
  for (const msg of messages) {
    if (msg.sender.role === "prospect") {
      if (msg.sender.email) {
        prospectEmails.add(msg.sender.email.toLowerCase());
      } else if (msg.sender.name) {
        prospectNames.add(msg.sender.name.toLowerCase());
      }
    }
  }
  const num_unique_prospect_contacts =
    prospectEmails.size > 0 ? prospectEmails.size : prospectNames.size;

  // 16. num_contacts_active_last_30d: prospect contacts with messages in last 30 days
  const activeProspectEmails = new Set<string>();
  const activeProspectNames = new Set<string>();
  for (const msg of messages) {
    if (
      msg.sender.role === "prospect" &&
      msg.sentAt >= thirtyDaysAgo
    ) {
      if (msg.sender.email) {
        activeProspectEmails.add(msg.sender.email.toLowerCase());
      } else if (msg.sender.name) {
        activeProspectNames.add(msg.sender.name.toLowerCase());
      }
    }
  }
  const num_contacts_active_last_30d =
    activeProspectEmails.size > 0
      ? activeProspectEmails.size
      : activeProspectNames.size;

  // 17. dm_engagement_score: decision maker engagement (0..1)
  let dm_engagement_score = 0;
  const dmEntities = entities.filter((e) => e.type === "decision_maker");
  if (dmEntities.length > 0) {
    // Try to identify DM from entities or participants
    const dmNames = new Set<string>();
    for (const e of dmEntities) {
      const value = e.value.toLowerCase();
      // Extract potential names (simple heuristic)
      const words = value.split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && /^[A-Z]/.test(word)) {
          dmNames.add(word.toLowerCase());
        }
      }
    }

    // Count messages from potential DMs
    let dmMessageCount = 0;
    let dmRecentMessageCount = 0;
    for (const msg of messages) {
      const senderName = msg.sender.name.toLowerCase();
      const senderEmail = msg.sender.email?.toLowerCase() || "";
      const isDM =
        Array.from(dmNames).some(
          (name) => senderName.includes(name) || senderEmail.includes(name)
        ) ||
        // Also check for common titles in sender name
        /(ceo|cto|cfo|coo|vp|vice president|director|head of|founder|cofounder)/i.test(
          senderName
        );

      if (isDM) {
        dmMessageCount++;
        if (msg.sentAt >= thirtyDaysAgo) {
          dmRecentMessageCount++;
        }
      }
    }

    // Score based on message count and recency
    if (dmMessageCount > 0) {
      const recencyScore = dmRecentMessageCount > 0 ? 0.6 : 0.2;
      const volumeScore = Math.min(1, dmMessageCount / 5) * 0.4;
      dm_engagement_score = Math.min(1, recencyScore + volumeScore);
    }
  }

  // 18. ghosting_score: days_since_last_inbound / typical_rhythm
  let ghosting_score = 0;
  if (inboundMessages.length > 1) {
    // Compute typical rhythm as average gap between inbound messages
    let totalGapDays = 0;
    let gapCount = 0;
    for (let i = 1; i < inboundMessages.length; i++) {
      const currentInbound = inboundMessages[i];
      const previousInbound = inboundMessages[i - 1];
      if (!currentInbound || !previousInbound) continue;
      const gap =
        (currentInbound.sentAt.getTime() -
          previousInbound.sentAt.getTime()) /
        (1000 * 60 * 60 * 24);
      totalGapDays += gap;
      gapCount++;
    }
    const typical_rhythm = gapCount > 0 ? totalGapDays / gapCount : 7; // Default 7 days
    ghosting_score = Math.min(10, days_since_last_inbound / Math.max(1, typical_rhythm));
  } else {
    // No inbound messages or only one: use default rhythm of 7 days
    ghosting_score = Math.min(10, days_since_last_inbound / 7);
  }

  return {
    avg_sentiment_all,
    avg_sentiment_recent,
    sentiment_trend,
    sentiment_volatility,
    pos_ratio_all,
    neg_ratio_all,
    neg_ratio_recent,
    days_since_last_inbound,
    total_messages_log,
    inbound_to_outbound_ratio_recent,
    has_budget,
    has_decision_maker,
    has_timeline,
    has_competitor,
    num_unique_prospect_contacts,
    num_contacts_active_last_30d,
    dm_engagement_score,
    ghosting_score,
  };
}

