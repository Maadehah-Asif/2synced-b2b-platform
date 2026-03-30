import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import ConversationEntity, {
  type ConversationEntityDocument,
} from "./models/ConversationEntity.js";
import { runEntityExtractionForThread } from "./entityExtractionService.js";
import { runSentimentForThread } from "./sentimentService.js";
import MessageSentiment, {
  type MessageSentimentDocument,
  type SentimentLabel,
} from "./models/MessageSentiment.js";
import DealHealth, {
  type DealHealthBand,
  type DealHealthDocument,
} from "./models/DealHealth.js";
import { runDealHealthForThread } from "./services/dealHealthService.js";
import { upsertFollowUpsForThread } from "./services/followUpService.js";
import FollowUpReminder, {
  type FollowUpReminderDocument,
} from "./models/FollowUpReminder.js";
import ConversationAnalysisRun, {
  type ConversationAnalysisRunDocument,
} from "./models/ConversationAnalysisRun.js";

// -----------------------------------------------------------------------------
// Types for features / scoring
// -----------------------------------------------------------------------------

export interface DealHealthFeatures {
  numMessages: number;
  numInbound: number;
  numOutbound: number;
  inboundRatio: number;

  daysSinceFirstMessage: number;
  daysSinceLastMessage: number;
  daysSinceLastInbound: number | null;

  avgSentiment: number;
  lastSentiment: number;
  minSentiment: number;
  maxSentiment: number;
  numNegativeMessages: number;
  numPositiveMessages: number;

  hasBudget: boolean;
  hasDecisionMaker: boolean;
  hasTimeline: boolean;
  competitorMentions: number;

  numBackAndForthCycles: number;
  lastMessageDirection: "inbound" | "outbound" | "none";
}

export type FollowUpAction = "now" | "later" | "stop";

export interface RunFullAnalysisParams {
  workspaceId: string;
  threadId: string;
  userId: string;
}

export interface RunFullAnalysisResult {
  analysisRun: ConversationAnalysisRunDocument;
  dealHealth?: DealHealthDocument | null;
  followUps: FollowUpReminderDocument[];
  sentimentSummary?: {
    avgScore: number;
    totalMessages: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
}

// -----------------------------------------------------------------------------
// Sentiment analysis is now handled by sentimentService.ts
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Entity extraction is now handled by entityExtractionService.ts
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Core analysis pipeline
// -----------------------------------------------------------------------------

export async function runFullAnalysis(
  params: RunFullAnalysisParams
): Promise<RunFullAnalysisResult> {
  const { workspaceId, threadId, userId } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const tId = new Types.ObjectId(threadId);
  const uId = new Types.ObjectId(userId);

  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).exec();

  if (!thread) {
    throw new Error("Conversation thread not found in this workspace.");
  }

  const analysisRun = await ConversationAnalysisRun.create({
    workspaceId: wsId,
    threadId: tId,
    startedBy: uId,
    startedAt: new Date(),
    status: "running",
  });

  try {
    const messages = await ConversationMessage.find({
      workspaceId: wsId,
      threadId: tId,
    })
      .sort({ sentAt: 1 })
      .exec();

    // 1) Entities
    await runEntityExtractionForThread(tId);
    const entities = await ConversationEntity.find({
      workspaceId: wsId,
      threadId: tId,
      status: "active",
    }).exec();

    // 2) Sentiment
    const sentimentSummary = await runSentimentForThread(wsId, tId);
    const sentiments = await MessageSentiment.find({
      workspaceId: wsId,
      threadId: tId,
    }).exec();

    // 3) Deal health (using new rule-based scoring)
    const dealHealth = await runDealHealthForThread(wsId, tId);

    // 4) Follow-ups (using dealHealth for scoring)
    // Extract daysSinceLastMessage from dealHealth signals
    const daysSinceLastMessage = dealHealth.signals.daysSinceLastMessage || 0;
    await upsertFollowUpsForThread({
      workspaceId: wsId,
      threadId: tId,
      assigneeId: uId,
      healthScore: dealHealth.score,
      daysSinceLastMessage: daysSinceLastMessage,
    });
    
    // Load created follow-ups for return
    const followUps = await FollowUpReminder.find({
      workspaceId: wsId,
      threadId: tId,
      assigneeId: uId,
      status: "pending",
    }).exec();

    analysisRun.status = "succeeded";
    analysisRun.finishedAt = new Date();
    await analysisRun.save();

    return {
      analysisRun,
      dealHealth,
      followUps,
      sentimentSummary,
    };
  } catch (err: any) {
    analysisRun.status = "failed";
    analysisRun.finishedAt = new Date();
    analysisRun.errorMessage = err?.message || "Unknown error";
    await analysisRun.save();
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Entities & Sentiment
// -----------------------------------------------------------------------------

async function computeEntitiesForThread(
  workspaceId: Types.ObjectId,
  threadId: Types.ObjectId,
  messages: ConversationMessageDocument[]
): Promise<ConversationEntityDocument[]> {
  // Use the dedicated entity extraction service
  await runEntityExtractionForThread(threadId);

  // Return the newly created active entities
  const entities = await ConversationEntity.find({
    workspaceId,
    threadId,
    status: "active",
  }).exec();

  return entities;
}


// Sentiment computation is now handled by sentimentService.ts

// -----------------------------------------------------------------------------
// Feature builder for deal health
// -----------------------------------------------------------------------------

export function buildDealHealthFeatures(
  thread: ConversationThreadDocument,
  messages: ConversationMessageDocument[],
  sentiments: MessageSentimentDocument[],
  entities: ConversationEntityDocument[]
): DealHealthFeatures {
  const now = new Date();

  const numMessages = messages.length;
  let numInbound = 0;
  let numOutbound = 0;
  let firstMessageAt: Date | null = null;
  let lastMessageAt: Date | null = null;
  let lastInboundAt: Date | null = null;
  let lastDirection: "inbound" | "outbound" | "none" = "none";

  let numBackAndForthCycles = 0;
  let prevDirection: "inbound" | "outbound" | "none" = "none";

  for (const msg of messages) {
    if (!firstMessageAt || msg.sentAt < firstMessageAt) {
      firstMessageAt = msg.sentAt;
    }
    if (!lastMessageAt || msg.sentAt > lastMessageAt) {
      lastMessageAt = msg.sentAt;
    }

    if (msg.direction === "inbound") {
      numInbound += 1;
      lastInboundAt = msg.sentAt;
    } else if (msg.direction === "outbound") {
      numOutbound += 1;
    }

    const currentDir =
      msg.direction === "inbound" || msg.direction === "outbound"
        ? msg.direction
        : "none";

    if (prevDirection && prevDirection !== "none" && currentDir !== "none") {
      if (prevDirection !== currentDir) {
        numBackAndForthCycles += 1;
      }
    }

    prevDirection = currentDir;
    lastDirection = currentDir;
  }

  const inboundRatio =
    numMessages > 0 ? numInbound / numMessages : 0;

  const daysSinceFirstMessage =
    firstMessageAt != null
      ? Math.floor(
          (now.getTime() - firstMessageAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const daysSinceLastMessage =
    lastMessageAt != null
      ? Math.floor(
          (now.getTime() - lastMessageAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const daysSinceLastInbound =
    lastInboundAt != null
      ? Math.floor(
          (now.getTime() - lastInboundAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  // Sentiment stats
  let avgSentiment = 0;
  let lastSentiment = 0;
  let minSentiment = 0;
  let maxSentiment = 0;
  let numNegativeMessages = 0;
  let numPositiveMessages = 0;

  if (sentiments.length > 0) {
    const scores = sentiments.map((s) => s.score);
    const sum = scores.reduce((acc, s) => acc + s, 0);
    avgSentiment = sum / sentiments.length;
    minSentiment = Math.min(...scores);
    maxSentiment = Math.max(...scores);
    // guard against possible undefined element access
    lastSentiment = sentiments[sentiments.length - 1]?.score ?? 0;
    numNegativeMessages = sentiments.filter((s) => s.label === "negative").length;
    numPositiveMessages = sentiments.filter((s) => s.label === "positive").length;
  }

  // Entity flags
  let hasBudget = false;
  let hasDecisionMaker = false;
  let hasTimeline = false;
  let competitorMentions = 0;

  for (const e of entities) {
    if (e.type === "budget") hasBudget = true;
    if (e.type === "decision_maker") hasDecisionMaker = true;
    if (e.type === "timeline") hasTimeline = true;
    if (e.type === "competitor") competitorMentions += 1;
  }

  const features: DealHealthFeatures = {
    numMessages,
    numInbound,
    numOutbound,
    inboundRatio,
    daysSinceFirstMessage,
    daysSinceLastMessage,
    daysSinceLastInbound,
    avgSentiment,
    lastSentiment,
    minSentiment,
    maxSentiment,
    numNegativeMessages,
    numPositiveMessages,
    hasBudget,
    hasDecisionMaker,
    hasTimeline,
    competitorMentions,
    numBackAndForthCycles,
    lastMessageDirection: lastDirection,
  };

  return features;
}

// -----------------------------------------------------------------------------
// Deal health scoring (placeholder for ML model)
// -----------------------------------------------------------------------------

function scoreDealHealthWithModel(
  features: DealHealthFeatures
): { score: number; band: DealHealthBand; redFlagDetected: boolean } {
  // This is a rule-based placeholder that can later be replaced by a trained ML model.
  // The features map exactly to what you will export to CSV for training.

  let score = 50;
  let redFlagDetected = false;

  // Recency
  if (features.daysSinceLastMessage <= 3) score += 20;
  else if (features.daysSinceLastMessage <= 7) score += 10;
  else if (features.daysSinceLastMessage <= 14) score += 0;
  else score -= 10;

  // Entity coverage
  if (features.hasBudget) score += 10;
  if (features.hasDecisionMaker) score += 10;
  if (features.hasTimeline) score += 10;

  // Sentiment
  if (features.avgSentiment >= 0.4) score += 15;
  else if (features.avgSentiment >= 0.1) score += 5;
  else if (features.avgSentiment <= -0.4) score -= 15;
  else if (features.avgSentiment <= -0.1) score -= 5;

  // Red flag: many negatives
  if (features.numNegativeMessages >= 2) {
    score -= 10;
    redFlagDetected = true;
  }

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let band: DealHealthBand = "steady";
  if (score >= 70) band = "healthy";
  else if (score < 40) band = "at_risk";

  return { score, band, redFlagDetected };
}

async function computeDealHealthForThread(
  workspaceId: Types.ObjectId,
  thread: ConversationThreadDocument,
  features: DealHealthFeatures
): Promise<DealHealthDocument> {
  const threadId = thread._id;
  const { score, band, redFlagDetected } = scoreDealHealthWithModel(features);

  const previous = await DealHealth.findOne({
    workspaceId,
    threadId,
  })
    .sort({ lastComputedAt: -1 })
    .exec();

  let trend: "up" | "flat" | "down" = "flat";
  if (previous) {
    const delta = score - previous.score;
    if (delta >= 10) trend = "up";
    else if (delta <= -10) trend = "down";
  }

  const summary = buildDealHealthSummary(thread, features, score, band);

  const health = await DealHealth.create({
    workspaceId,
    threadId,
    leadId: thread.leadId,
    dealId: thread.dealId,
    score,
    band,
    trend,
    signals: {
      hasBudget: features.hasBudget,
      hasDecisionMaker: features.hasDecisionMaker,
      hasTimeline: features.hasTimeline,
      avgSentiment: features.avgSentiment,
      lastSentiment: features.lastSentiment,
      daysSinceLastMessage: features.daysSinceLastMessage,
      numMessages: features.numMessages,
      numNegativeMessages: features.numNegativeMessages,
      numPositiveMessages: features.numPositiveMessages,
      competitorMentions: features.competitorMentions,
      redFlagDetected,
    },
    summary,
    lastComputedAt: new Date(),
  });

  return health;
}

function buildDealHealthSummary(
  thread: ConversationThreadDocument,
  features: DealHealthFeatures,
  score: number,
  band: DealHealthBand
): string {
  const parts: string[] = [];

  parts.push(
    `Conversation "${thread.subject}" currently looks ${band.replace(
      "_",
      " "
    )} with a health score of ${Math.round(score)}.`
  );

  if (features.hasBudget) parts.push("Budget has been discussed.");
  if (features.hasDecisionMaker) parts.push("Decision maker is identified.");
  if (features.hasTimeline) parts.push("Timeline is mentioned.");

  if (!features.hasBudget || !features.hasDecisionMaker || !features.hasTimeline) {
    parts.push(
      "Key details like budget, decision maker or timeline may still be missing."
    );
  }

  if (features.daysSinceLastMessage > 14) {
    parts.push(
      `No activity for ${features.daysSinceLastMessage} days, which increases risk.`
    );
  }

  if (features.avgSentiment > 0.3) {
    parts.push("Overall sentiment across messages is positive.");
  } else if (features.avgSentiment < -0.3) {
    parts.push("Overall sentiment across messages is negative.");
  }

  return parts.join(" ");
}

// Old follow-up creation logic removed - now handled by services/followUpService.ts
