/**
 * Deal Health Orchestration Service
 * 
 * Orchestrates feature extraction, ML prediction, and persistence of deal health.
 */

import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "../models/ConversationThreads.js";
import DealHealth, {
  type DealHealthDocument,
  type DealHealthBand,
} from "../models/DealHealth.js";
import { computeDealHealthFeaturesForThread } from "./dealHealthFeatureService.js";
import { predictDealHealth, type DealHealthFeatures } from "./dealHealthModel.js";

/**
 * Run deal health analysis for a thread and persist the result.
 */
export async function runDealHealthForThread(
  workspaceId: Types.ObjectId | string,
  threadId: Types.ObjectId | string
): Promise<DealHealthDocument> {
  const wsId =
    workspaceId instanceof Types.ObjectId
      ? workspaceId
      : new Types.ObjectId(workspaceId);
  const tId =
    threadId instanceof Types.ObjectId ? threadId : new Types.ObjectId(threadId);

  // Load thread to get dealId and leadId
  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).exec();

  if (!thread) {
    throw new Error("Conversation thread not found in this workspace.");
  }

  // Compute features
  const features = await computeDealHealthFeaturesForThread(wsId, tId);

  // Run ML prediction
  const prediction = predictDealHealth(features);

  // Build reasons
  const reasons = buildReasons(features, prediction);

  // Get previous health for trend calculation
  const previous = await DealHealth.findOne({
    workspaceId: wsId,
    threadId: tId,
  })
    .sort({ lastAnalyzedAt: -1 })
    .exec();

  let trend: "up" | "flat" | "down" = "flat";
  if (previous) {
    const delta = prediction.healthScore - previous.score;
    if (delta >= 10) {
      trend = "up";
    } else if (delta <= -10) {
      trend = "down";
    }
  }

  // Upsert deal health
  const dealHealth = await DealHealth.findOneAndUpdate(
    {
      workspaceId: wsId,
      threadId: tId,
    },
    {
      workspaceId: wsId,
      threadId: tId,
      leadId: thread.leadId,
      dealId: thread.dealId,
      score: prediction.healthScore,
      probabilityHealthy: prediction.probabilityHealthy,
      band: prediction.band,
      trend,
      featuresSnapshot: features,
      reasons,
      signals: {
        hasBudget: features.has_budget === 1,
        hasDecisionMaker: features.has_decision_maker === 1,
        hasTimeline: features.has_timeline === 1,
        avgSentiment: features.avg_sentiment_all,
        lastSentiment: features.avg_sentiment_recent,
        daysSinceLastMessage: features.days_since_last_inbound,
        numMessages: Math.round(Math.expm1(features.total_messages_log)),
        numNegativeMessages: Math.round(
          features.neg_ratio_all * Math.expm1(features.total_messages_log)
        ),
        numPositiveMessages: Math.round(
          features.pos_ratio_all * Math.expm1(features.total_messages_log)
        ),
        competitorMentions: features.has_competitor,
        redFlagDetected: prediction.band === "at_risk",
      },
      lastAnalyzedAt: new Date(),
      lastComputedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
    }
  ).exec();

  if (!dealHealth) {
    throw new Error("Failed to create or update deal health record.");
  }

  return dealHealth;
}

/**
 * Build human-readable reasons for the health score.
 */
function buildReasons(
  features: DealHealthFeatures,
  prediction: { healthScore: number; band: DealHealthBand }
): string[] {
  const reasons: string[] = [];

  // Negative factors
  if (features.days_since_last_inbound > 14) {
    reasons.push(
      `Prospect inactive for ${Math.round(features.days_since_last_inbound)} days`
    );
  }

  // Note: Missing BANT signals are no longer penalized - they are simply unknown
  // Only positive factors are mentioned when present

  if (features.has_competitor === 1 && prediction.healthScore < 60) {
    reasons.push("Competitors actively mentioned in thread");
  }

  if (features.neg_ratio_recent > 0.5) {
    reasons.push("High negative sentiment in recent messages");
  }

  if (features.ghosting_score > 3) {
    reasons.push("Prospect response pattern indicates disengagement");
  }

  if (features.inbound_to_outbound_ratio_recent < 0.3) {
    reasons.push("Low prospect response rate");
  }

  if (features.num_unique_prospect_contacts === 1) {
    reasons.push("Single-threaded conversation (only one prospect contact)");
  }

  if (features.dm_engagement_score < 0.2) {
    reasons.push("Decision maker engagement is low");
  }

  // Positive factors
  if (features.dm_engagement_score > 0.6) {
    reasons.push("Decision maker actively engaged");
  }

  if (features.has_budget === 1 && features.has_decision_maker === 1 && features.has_timeline === 1) {
    reasons.push("All key BANT signals present (Budget, Authority, Need, Timeline)");
  }

  if (features.avg_sentiment_recent > 0.3) {
    reasons.push("Positive sentiment trend in recent messages");
  }

  if (features.inbound_to_outbound_ratio_recent >= 1) {
    reasons.push("Prospect responding actively");
  }

  if (features.num_unique_prospect_contacts >= 3) {
    reasons.push("Multiple prospect contacts engaged");
  }

  if (features.days_since_last_inbound < 7) {
    reasons.push("Recent prospect activity");
  }

  // If no reasons, add a generic one
  if (reasons.length === 0) {
    reasons.push(
      `Deal health score: ${prediction.healthScore}/100 (${prediction.band})`
    );
  }

  return reasons;
}

