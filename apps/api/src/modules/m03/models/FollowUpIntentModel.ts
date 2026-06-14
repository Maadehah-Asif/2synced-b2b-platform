/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: FollowUpIntentModel.ts
 * Purpose: Supports the F ol lo wU pI nt en tM od el flow for this module.
 * Notes: Documentation header added for maintainability.
 */

// apps/api/src/modules/m03/FollowUpIntentModel.ts
// Auto-generated from scikit-learn logistic regression
// trained on deal_followup_dataset_10k.xlsx

export type FollowUpIntent =
  | "ask_for_meeting"
  | "check_in_gentle"
  | "confirm_decision_maker"
  | "nurture_later"
  | "revive_ghosted"
  | "send_pricing_clarification";

export interface FollowUpFeatures {
  segment: "Enterprise" | "MidMarket" | "SMB";
  currentStage: "Closed Won" | "Discovery" | "Legal" | "Negotiation" | "Proposal";
  dealValueK: number;
  dealHealthScore: number;
  daysSinceLastMessage: number;
  lastSentiment: number;
  negRatioRecent: number;
  numUniqueContacts: number;
  hasBudget: 0 | 1;
  hasDecisionMaker: 0 | 1;
  hasTimeline: 0 | 1;
  competitorMentioned: 0 | 1;
}

const classes: FollowUpIntent[] = [
  "ask_for_meeting",
  "check_in_gentle",
  "confirm_decision_maker",
  "nurture_later",
  "revive_ghosted",
  "send_pricing_clarification",
];

const segmentCategories = ["Enterprise", "MidMarket", "SMB"];
const stageCategories = ["Closed Won", "Discovery", "Legal", "Negotiation", "Proposal"];

// Coefficients shape: [nClasses][nFeatures]
const coefs: number[][] = [
  [-0.848625, -0.905363, -0.856111, -0.557825, -0.522297, -0.469702, -0.224999, -0.101781, -0.650281, -0.164488, 0.013765, -0.085708, -0.013536, -0.020734, -0.113608, -0.044113, -0.094017, -0.070138],
  [0.397887, 0.39981, 0.399423, 0.278616, 0.269995, 0.254693, 0.081857, 0.052985, 0.247952, 0.092611, -0.008842, 0.058874, 0.004031, 0.023634, 0.066654, 0.031442, 0.048318, 0.038409],
  [0.158152, 0.165081, 0.163396, 0.104674, 0.100952, 0.090705, 0.043587, 0.029235, 0.128499, 0.048834, -0.004754, 0.019753, 0.002023, 0.011618, 0.033222, 0.014474, 0.026377, 0.020038],
  [0.125456, 0.125339, 0.130334, 0.083038, 0.070593, 0.07477, 0.036412, 0.023266, 0.102015, 0.034888, -0.005426, 0.011952, 0.000712, 0.007323, 0.021104, 0.010303, 0.018337, 0.012934],
  [0.099844, 0.100409, 0.104368, 0.06957, 0.065943, 0.059184, 0.030787, 0.021423, 0.082706, 0.027805, -0.005043, 0.014335, 0.000869, 0.006168, 0.018093, 0.008808, 0.015372, 0.011155],
  [0.067286, 0.114723, 0.05859, 0.021927, 0.014814, -0.01065, 0.032356, -0.025128, 0.08911, -0.03965, 0.010299, -0.019206, 0.005901, -0.028009, -0.025464, -0.020914, -0.014388, -0.012399],
];

// Intercept per class
const intercepts: number[] = [-2.625434, 1.110835, 0.299932, 0.527994, 0.481816, 0.204858];

function buildVector(f: FollowUpFeatures): number[] {
  const vec: number[] = [];

  // One-hot for segment
  for (const seg of segmentCategories) {
    vec.push(f.segment === seg ? 1 : 0);
  }

  // One-hot for stage
  for (const st of stageCategories) {
    vec.push(f.currentStage === st ? 1 : 0);
  }

  // Numeric features in the exact order used during training
  vec.push(
    f.dealValueK,
    f.dealHealthScore,
    f.daysSinceLastMessage,
    f.lastSentiment,
    f.negRatioRecent,
    f.numUniqueContacts,
    f.hasBudget,
    f.hasDecisionMaker,
    f.hasTimeline,
    f.competitorMentioned
  );

  return vec;
}

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - maxLogit));
  const sum = exps.reduce((acc, v) => acc + v, 0);
  return exps.map((v) => v / sum);
}

export function predictFollowUpIntent(
  features: FollowUpFeatures
): {
  intent: FollowUpIntent;
  probabilities: Record<FollowUpIntent, number>;
} {
  const x = buildVector(features);

  const logits: number[] = coefs.map((row, i) => {
    const intercept = intercepts[i];
    if (intercept === undefined) {
      throw new Error(`Intercept missing for class index ${i}`);
    }
    let s: number = intercept;
    for (let j = 0; j < row.length; j++) {
      const coef = row[j];
      const feature = x[j];
      if (coef === undefined || feature === undefined) {
        throw new Error(`Missing coefficient or feature at index ${j}`);
      }
      s += coef * feature;
    }
    return s;
  });

  const probsArr = softmax(logits);

  if (probsArr.length === 0) {
    throw new Error("No probabilities computed");
  }

  let bestIdx = 0;
  let bestProb = probsArr[0];
  if (bestProb === undefined) {
    throw new Error("First probability is undefined");
  }

  for (let i = 1; i < probsArr.length; i++) {
    const prob = probsArr[i];
    if (prob !== undefined && prob > bestProb) {
      bestProb = prob;
      bestIdx = i;
    }
  }

  const intent = classes[bestIdx];
  if (intent === undefined) {
    throw new Error(`No intent found for index ${bestIdx}`);
  }

  const probabilities = classes.reduce((acc, label, idx) => {
    const prob = probsArr[idx];
    if (prob === undefined) {
      throw new Error(`Probability missing for class index ${idx}`);
    }
    acc[label] = prob;
    return acc;
  }, {} as Record<FollowUpIntent, number>);

  return { intent, probabilities };
}
