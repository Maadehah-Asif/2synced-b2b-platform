import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import ConversationEntity, {
  type ConversationEntityDocument,
  type ConversationEntityType,
  type ConversationEntityCreateInput,
} from "./models/ConversationEntity.js";
import MessageSentiment, {
  type MessageSentimentDocument,
  type SentimentLabel,
} from "./models/MessageSentiment.js";
import DealHealth, {
  type DealHealthBand,
  type DealHealthDocument,
} from "./models/DealHealth.js";
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
}

// -----------------------------------------------------------------------------
// Sales-specific sentiment rules
// -----------------------------------------------------------------------------

const STRONG_POSITIVE_PHRASES = [
  "move forward",
  "let's move forward",
  "go ahead",
  "approve",
  "approved",
  "ready to sign",
  "send the contract",
  "looks good to me",
  "looks good",
  "happy to proceed",
];

const POSITIVE_PHRASES = [
  "interested",
  "keen",
  "sounds good",
  "promising",
  "excited",
  "like this",
  "fits our needs",
  "schedule a call",
  "set up a call",
  "book a demo",
];

const STRONG_NEGATIVE_PHRASES = [
  "not moving forward",
  "no longer moving forward",
  "won't move forward",
  "cancel the project",
  "cancel this",
  "stop this",
  "not going ahead",
  "decided against",
];

const NEGATIVE_PHRASES = [
  "no budget",
  "not a priority",
  "budget freeze",
  "on hold",
  "hold off",
  "push this back",
  "delay this",
  "not interested",
  "doesn't fit",
  "reject",
];

const STALL_PHRASES = [
  "revisit next quarter",
  "touch base next quarter",
  "touch base later",
  "circle back later",
  "after our budgeting cycle",
  "after budget cycle",
];

// Simple lexicon-based sentiment
function analyzeSentimentForSales(textRaw: string): {
  label: SentimentLabel;
  score: number; // -1..1
} {
  const text = (textRaw || "").toLowerCase();

  let score = 0;

  for (const phrase of STRONG_POSITIVE_PHRASES) {
    if (text.includes(phrase)) score += 3;
  }
  for (const phrase of POSITIVE_PHRASES) {
    if (text.includes(phrase)) score += 1;
  }

  for (const phrase of STRONG_NEGATIVE_PHRASES) {
    if (text.includes(phrase)) score -= 3;
  }
  for (const phrase of NEGATIVE_PHRASES) {
    if (text.includes(phrase)) score -= 1;
  }
  for (const phrase of STALL_PHRASES) {
    if (text.includes(phrase)) score -= 1;
  }

  const normalized =
    score === 0 ? 0 : Math.max(-1, Math.min(1, score / 4)); // basic normalization

  let label: SentimentLabel = "neutral";
  if (normalized > 0.25) label = "positive";
  else if (normalized < -0.25) label = "negative";

  return {
    label,
    score: normalized,
  };
}

// -----------------------------------------------------------------------------
// Entity extraction rules
// -----------------------------------------------------------------------------

const BUDGET_REGEXES: RegExp[] = [
  /(budget|pricing|price|cost).{0,40}\$?\d+(\.\d+)?\s?(k|k|thousand|million|m)?/i,
  /\$?\d+(\.\d+)?\s?(k|k|thousand|million|m).{0,40}(budget|per month|per year)/i,
];

const DECISION_MAKER_PHRASES = [
  "decision maker",
  "final decision",
  "final say",
  "sign off",
  "approver",
  "c-level",
  "cfo",
  "ceo",
  "vp",
  "vice president",
  "head of",
  "director",
];

const TIMELINE_PHRASES = [
  "q1",
  "q2",
  "q3",
  "q4",
  "this quarter",
  "next quarter",
  "next month",
  "this month",
  "next year",
  "this year",
  "by end of",
  "by the end of",
];

const TIMELINE_REGEXES: RegExp[] = [
  /\b(20[2-9][0-9])\b/, // years 2020+
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i,
];

const COMPETITOR_NAMES = [
  "hubspot",
  "salesforce",
  "pipedrive",
  "zoho",
  "freshsales",
];

function extractEntitiesFromMessage(
  workspaceId: Types.ObjectId,
  threadId: Types.ObjectId,
  message: ConversationMessageDocument
): ConversationEntityCreateInput[] {
  const text = (message.bodyText || "").toLowerCase();
  const entities: ConversationEntityCreateInput[] = [];

  // Budget
  for (const regex of BUDGET_REGEXES) {
    const match = regex.exec(message.bodyText || "");
    if (match) {
      entities.push({
        workspaceId,
        threadId,
        messageId: message._id,
        type: "budget",
        value: match[0],
        confidence: 0.9,
        sourceSnippet: match[0],
      });
      break;
    }
  }

  // Decision maker
  for (const phrase of DECISION_MAKER_PHRASES) {
    if (text.includes(phrase)) {
      entities.push({
        workspaceId,
        threadId,
        messageId: message._id,
        type: "decision_maker",
        value: phrase,
        confidence: 0.8,
        sourceSnippet: phrase,
      });
      break;
    }
  }

  // Timeline
  let timelineFound = false;
  for (const phrase of TIMELINE_PHRASES) {
    if (text.includes(phrase)) {
      entities.push({
        workspaceId,
        threadId,
        messageId: message._id,
        type: "timeline",
        value: phrase,
        confidence: 0.8,
        sourceSnippet: phrase,
      });
      timelineFound = true;
      break;
    }
  }
  if (!timelineFound) {
    for (const regex of TIMELINE_REGEXES) {
      const match = regex.exec(message.bodyText || "");
      if (match) {
        entities.push({
          workspaceId,
          threadId,
          messageId: message._id,
          type: "timeline",
          value: match[0],
          confidence: 0.7,
          sourceSnippet: match[0],
        });
        break;
      }
    }
  }

  // Competitors
  for (const competitor of COMPETITOR_NAMES) {
    if (text.includes(competitor)) {
      entities.push({
        workspaceId,
        threadId,
        messageId: message._id,
        type: "competitor",
        value: competitor,
        confidence: 0.9,
        sourceSnippet: competitor,
      });
    }
  }

  return entities;
}

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
    const entities = await computeEntitiesForThread(wsId, tId, messages);

    // 2) Sentiment
    const sentiments = await computeSentimentForThread(wsId, tId, messages);

    // 3) Deal health
    const features = buildDealHealthFeatures(thread, messages, sentiments, entities);
    const dealHealth = await computeDealHealthForThread(
      wsId,
      thread,
      features
    );

    // 4) Follow-ups
    const followUps = await updateFollowUpsForThread(
      wsId,
      tId,
      uId,
      dealHealth,
      features
    );

    analysisRun.status = "succeeded";
    analysisRun.finishedAt = new Date();
    await analysisRun.save();

    return {
      analysisRun,
      dealHealth,
      followUps,
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
  await ConversationEntity.deleteMany({ workspaceId, threadId });

  const docs: ConversationEntityCreateInput[] = [];
  for (const message of messages) {
    const extracted = extractEntitiesFromMessage(workspaceId, threadId, message);
    docs.push(...extracted);
  }

  if (docs.length === 0) {
    return [];
  }

  const created = await ConversationEntity.insertMany(docs);
  return created;
}


async function computeSentimentForThread(
  workspaceId: Types.ObjectId,
  threadId: Types.ObjectId,
  messages: ConversationMessageDocument[]
): Promise<MessageSentimentDocument[]> {
  await MessageSentiment.deleteMany({ workspaceId, threadId });

  const docs = [];

  for (const message of messages) {
    const { label, score } = analyzeSentimentForSales(message.bodyText || "");
    docs.push({
      workspaceId,
      threadId,
      messageId: message._id,
      label,
      score,
    });
  }

  if (docs.length === 0) {
    return [];
  }

  const created = await MessageSentiment.insertMany(docs);
  return created;
}

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

  let band: DealHealthBand = "neutral";
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

// -----------------------------------------------------------------------------
// Follow-up predictor (placeholder for ML classifier)
// -----------------------------------------------------------------------------

function predictFollowUpAction(
  health: DealHealthDocument,
  features: DealHealthFeatures
): FollowUpAction {
  // Placeholder rule-based logic. This is where a small ML classifier
  // would be plugged in using the same features.
  const days = features.daysSinceLastMessage;

  if (health.band === "at_risk") {
    if (days > 7) return "now";
    if (days > 3) return "later";
    return "later";
  }

  if (health.band === "healthy") {
    if (days > 14) return "now";
    if (days > 5) return "later";
    return "later";
  }

  // neutral
  if (days > 10) return "now";
  if (days > 3) return "later";
  return "later";
}

async function updateFollowUpsForThread(
  workspaceId: Types.ObjectId,
  threadId: Types.ObjectId,
  assigneeId: Types.ObjectId,
  health: DealHealthDocument,
  features: DealHealthFeatures
): Promise<FollowUpReminderDocument[]> {
  // Delete any existing pending/snoozed followups for this assignee+thread
  await FollowUpReminder.deleteMany({
    workspaceId,
    threadId,
    assigneeId,
    status: { $in: ["pending", "snoozed"] },
  });

  const action = predictFollowUpAction(health, features);
  const now = new Date();
  const followUps: FollowUpReminderDocument[] = [];

  if (action === "stop") {
      // no follow-up created
      return followUps;
  }

  let dueAt: Date;
  if (action === "now") {
    // due next day
    dueAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  } else {
    // later: ~1 week
    dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const reason =
    action === "now"
      ? "Health and recency indicate a follow-up should be sent soon."
      : "Health is moderate; a follow-up is recommended later.";

  const followUp = await FollowUpReminder.create({
    workspaceId,
    threadId,
    assigneeId,
    dueAt,
    status: "pending",
    reason,
    createdBy: assigneeId,
  });

  followUps.push(followUp);
  return followUps;
}
