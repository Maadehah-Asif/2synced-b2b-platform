/**
 * Follow-up Intent Service
 * 
 * Computes ML-based follow-up intent predictions and generates suggested messages.
 */

import type { DealHealthDocument } from "../models/DealHealth.js";
import {
  predictFollowUpIntent,
  type FollowUpIntent,
  type FollowUpFeatures,
} from "../models/FollowUpIntentModel.js";

export interface FollowUpIntentResult {
  intent: FollowUpIntent;
  confidence: number;
  suggestedMessage: string;
}

/**
 * Compute follow-up intent from deal health metrics.
 */
export function computeFollowUpIntentFromDeal(
  dealHealth: DealHealthDocument | null,
  context?: {
    contactName?: string;
    companyName?: string;
  }
): FollowUpIntentResult | null {
  if (!dealHealth) {
    return null;
  }

  try {
    const features = dealHealth.featuresSnapshot;
    const signals = dealHealth.signals;

    // Build features for the ML model
    const f: FollowUpFeatures = {
      segment: "MidMarket", // TODO: plug actual segment when available
      currentStage: "Discovery", // TODO: plug actual stage when available
      dealValueK: Math.max(10, 1), // TODO: get from deal when available, default to 10k
      dealHealthScore: dealHealth.score,
      daysSinceLastMessage: signals.daysSinceLastMessage || features.days_since_last_inbound,
      lastSentiment: signals.lastSentiment || features.avg_sentiment_recent,
      negRatioRecent: features.neg_ratio_recent,
      numUniqueContacts: features.num_unique_prospect_contacts,
      hasBudget: signals.hasBudget ? 1 : 0,
      hasDecisionMaker: signals.hasDecisionMaker ? 1 : 0,
      hasTimeline: signals.hasTimeline ? 1 : 0,
      competitorMentioned: (signals.competitorMentions || features.has_competitor) > 0 ? 1 : 0,
    };

    const { intent, probabilities } = predictFollowUpIntent(f);
    const confidence = probabilities[intent];

    // Generate suggested message - build context object conditionally to avoid undefined values
    const messageContext: {
      contactName?: string;
      companyName?: string;
    } = {};
    if (context?.contactName) {
      messageContext.contactName = context.contactName;
    }
    if (context?.companyName) {
      messageContext.companyName = context.companyName;
    }
    const suggestedMessage = getFollowUpMessage(intent, messageContext);

    return {
      intent,
      confidence,
      suggestedMessage,
    };
  } catch (err: any) {
    console.error("Error computing follow-up intent:", err);
    return null;
  }
}

/**
 * Get follow-up message template for a given intent.
 */
function getFollowUpMessage(
  intent: FollowUpIntent,
  context: {
    contactName?: string;
    companyName?: string;
  }
): string {
  const templates: Record<FollowUpIntent, (ctx: {
    contactName?: string;
    companyName?: string;
  }) => string> = {
    ask_for_meeting: ({ contactName, companyName }) => `
Hi ${contactName || "there"},

It sounds like we're aligned on the problem and potential approach. Would it make sense to schedule a short 30-minute call to walk through the next steps and get your feedback on ${companyName || "this project"}?

Here are a couple of slots that could work for me:
- [Slot 1]
- [Slot 2]

Happy to adjust if those don't work.

Best,
[Your name]
`.trim(),

    check_in_gentle: ({ contactName, companyName }) => `
Hi ${contactName || "there"},

Hope you're doing well. Just checking in to see if you had a chance to review our last update about ${companyName || "the project"} or if there are any questions I can help with.

Best,
[Your name]
`.trim(),

    confirm_decision_maker: ({ contactName }) => `
Hi ${contactName || "there"},

To make sure we give you the most relevant proposal, could you confirm who else should be involved in the decision (for example finance, IT, or procurement)? I'm happy to loop them in so we can address their questions upfront.

Best,
[Your name]
`.trim(),

    send_pricing_clarification: ({ contactName }) => `
Hi ${contactName || "there"},

Thanks for your questions on pricing. I've attached a short breakdown of how the cost changes with volume and contract length, plus a couple of options that might fit your budget.

Let me know if you'd like to walk through the options together on a quick call.

Best,
[Your name]
`.trim(),

    nurture_later: ({ contactName }) => `
Hi ${contactName || "there"},

Thanks again for the conversation and for considering us. Based on your timelines, I'll check back in a bit closer to your next planning cycle, but if anything changes sooner I'm happy to help.

Best,
[Your name]
`.trim(),

    revive_ghosted: ({ contactName }) => `
Hi ${contactName || "there"},

Just following up quickly — I know things get busy. If now isn't the right time, no worries at all. Should we pause this conversation for now, or is there someone else on your side who would be the best person to continue the discussion with?

Best,
[Your name]
`.trim(),
  };

  return templates[intent](context);
}

