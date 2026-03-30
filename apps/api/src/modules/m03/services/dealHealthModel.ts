/**
 * Deal Health Rule-Based Scoring
 * 
 * Realistic scoring that treats sentiment as the strongest signal and doesn't
 * brutally punish missing BANT entities on early deals.
 * 
 * Key principles:
 * - Sentiment is the strongest driver
 * - Missing BANT signals have small penalties (not brutal)
 * - Recency/ghosting adds risk but doesn't override very positive conversations
 * - Early-stage deals have a floor so they can't drop to "at risk" just because we don't know everything yet
 */

export interface DealHealthFeatures {
  avg_sentiment_all: number;
  avg_sentiment_recent: number;
  sentiment_trend: number;
  sentiment_volatility: number;
  pos_ratio_all: number;
  neg_ratio_all: number;
  neg_ratio_recent: number;
  days_since_last_inbound: number;
  total_messages_log: number;
  inbound_to_outbound_ratio_recent: number;
  has_budget: number;
  has_decision_maker: number;
  has_timeline: number;
  has_competitor: number;
  num_unique_prospect_contacts: number;
  num_contacts_active_last_30d: number;
  dm_engagement_score: number;
  ghosting_score: number;
}

export interface DealHealthPrediction {
  probabilityHealthy: number;
  healthScore: number; // 0..100
  band: "healthy" | "steady" | "at_risk";
}

/**
 * Helper: Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Predict deal health from features using realistic rule-based scoring.
 * 
 * Scoring logic:
 * - Base score: 50 (neutral baseline)
 * - Sentiment (strongest driver): +20 if > 0.4, +12 if > 0.15, -25 if < -0.4, -15 if < -0.15
 * - Pos/neg ratio mix: (posRatio - negRatio) * 10
 * - Recency: +8 if <= 7 days, -10 if > 14 days, -18 if > 30 days, -25 if > 60 days
 * - BANT: +6 for each present, -4 for each missing (helpful but not all-or-nothing)
 * - Competitors: -5 if mentioned
 * - Early-stage floor: minimum 55 if early stage and sentiment >= -0.15
 */
export function predictDealHealth(
  features: DealHealthFeatures
): DealHealthPrediction {
  // Derive metrics from features
  const messageCount = Math.round(Math.expm1(features.total_messages_log));
  const avgSentiment = features.avg_sentiment_all;
  const posRatioAll = features.pos_ratio_all;
  const negRatioAll = features.neg_ratio_all;
  const daysSinceLastMessage = features.days_since_last_inbound;
  
  // Calculate deal age (approximate from message count and recency)
  // If we have first message date, use it; otherwise estimate
  const dealAgeDays = daysSinceLastMessage + (messageCount * 7); // Rough estimate
  
  let score = 50; // neutral baseline
  
  // 1) Sentiment – strongest driver
  if (avgSentiment > 0.4) score += 20;
  else if (avgSentiment > 0.15) score += 12;
  else if (avgSentiment < -0.4) score -= 25;
  else if (avgSentiment < -0.15) score -= 15;
  
  // Mix of pos vs neg across all messages
  score += (posRatioAll - negRatioAll) * 10;
  
  // 2) Recency / ghosting
  if (daysSinceLastMessage > 60) score -= 25;
  else if (daysSinceLastMessage > 30) score -= 18;
  else if (daysSinceLastMessage > 14) score -= 10;
  else if (daysSinceLastMessage <= 7) score += 8;
  
  // 3) BANT – helpful but not all-or-nothing
  if (features.has_budget === 1) score += 6;
  else score -= 4;
  
  if (features.has_decision_maker === 1) score += 6;
  else score -= 4;
  
  if (features.has_timeline === 1) score += 6;
  else score -= 4;
  
  // 4) Competitors: mild risk
  if (features.has_competitor === 1) score -= 5;
  
  // 5) Early-stage floor:
  // if deal is young and messages are few, don't call it "at risk" unless sentiment is aggressively bad.
  const isEarlyStage = messageCount < 3 || dealAgeDays < 30;
  if (isEarlyStage && score < 55 && avgSentiment >= -0.15) {
    score = 55;
  }
  
  // Clamp
  score = clamp(score, 0, 100);
  
  // Bands
  let band: "healthy" | "steady" | "at_risk" = "steady";
  if (score >= 70) band = "healthy";
  else if (score <= 40) band = "at_risk";
  
  // Compute probabilityHealthy as a normalized score (0..1)
  const probabilityHealthy = score / 100;
  
  return {
    probabilityHealthy,
    healthScore: Math.round(score),
    band,
  };
}

