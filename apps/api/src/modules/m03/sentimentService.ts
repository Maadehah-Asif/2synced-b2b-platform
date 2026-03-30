import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import MessageSentiment, {
  type MessageSentimentDocument,
  type SentimentLabel,
} from "./models/MessageSentiment.js";

// -----------------------------------------------------------------------------
// Sentiment lexicons
// -----------------------------------------------------------------------------

const POSITIVE_WORDS = [
  "great",
  "good",
  "excellent",
  "helpful",
  "positive",
  "impressed",
  "happy",
  "love",
  "liked",
  "works well",
  "satisfied",
  "valuable",
  "useful",
  "promising",
  "interested",
  "keen",
  "excited",
  "favorable",
  "pleased",
  "delighted",
  "amazing",
  "wonderful",
  "fantastic",
  "perfect",
  "outstanding",
  "brilliant",
  "awesome",
  "thrilled",
  "grateful",
  "appreciate",
  "thanks",
  "thank you",
  "yes",
  "sounds good",
  "looks good",
  "perfect fit",
  "exactly what we need",
];

const NEGATIVE_WORDS = [
  "bad",
  "poor",
  "terrible",
  "negative",
  "confusing",
  "buggy",
  "slow",
  "expensive",
  "too expensive",
  "pricey",
  "not interested",
  "not a priority",
  "concern",
  "issue",
  "problem",
  "delay",
  "blocked",
  "unhappy",
  "frustrated",
  "risk",
  "worried",
  "disappointed",
  "disappointing",
  "awful",
  "horrible",
  "useless",
  "waste",
  "difficult",
  "complicated",
  "broken",
  "doesn't work",
  "not working",
  "failed",
  "failure",
  "error",
  "bug",
  "bugs",
];

const STRONG_POSITIVE_PHRASES = [
  "move forward",
  "let's move forward",
  "go ahead",
  "approve",
  "approved",
  "ready to sign",
  "send the contract",
  "looks good to me",
  "happy to proceed",
  "excited to start",
  "let's do this",
  "sounds perfect",
  "exactly what we need",
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
  "not a fit",
  "doesn't fit our needs",
  "not for us",
];

const BOOSTERS = ["very", "really", "extremely", "highly", "strongly", "super", "quite", "absolutely", "completely"];

const NEGATIONS = ["not", "never", "no", "hardly", "barely", "without", "don't", "doesn't", "won't", "can't", "cannot"];

// -----------------------------------------------------------------------------
// Text processing utilities
// -----------------------------------------------------------------------------

/**
 * Simple tokenization: split on whitespace and punctuation, keeping words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Check if a word appears in a window before the current position
 */
function hasWordInWindow(
  tokens: string[],
  position: number,
  windowSize: number,
  words: string[]
): boolean {
  const start = Math.max(0, position - windowSize);
  for (let i = start; i < position && i < tokens.length; i++) {
    const token = tokens[i];
    if (token && words.includes(token)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for multi-word phrases in text
 */
function findPhrases(text: string, phrases: string[]): string[] {
  const textLower = text.toLowerCase();
  const found: string[] = [];
  for (const phrase of phrases) {
    if (textLower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  return found;
}

// -----------------------------------------------------------------------------
// Core sentiment computation
// -----------------------------------------------------------------------------

export interface SentimentResult {
  score: number; // -1..1
  label: SentimentLabel;
  matchedPositive: string[];
  matchedNegative: string[];
}

export function computeSentimentForText(text: string): SentimentResult {
  if (!text || text.trim().length < 2) {
    return {
      score: 0,
      label: "neutral",
      matchedPositive: [],
      matchedNegative: [],
    };
  }

  const textLower = text.toLowerCase().trim();
  const tokens = tokenize(text);
  let rawScore = 0;
  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];

  // Check for strong phrases first (they have higher weight)
  const strongPositivePhrases = findPhrases(textLower, STRONG_POSITIVE_PHRASES);
  const strongNegativePhrases = findPhrases(textLower, STRONG_NEGATIVE_PHRASES);

  for (const phrase of strongPositivePhrases) {
    rawScore += 3;
    if (!matchedPositive.includes(phrase)) {
      matchedPositive.push(phrase);
    }
  }

  for (const phrase of strongNegativePhrases) {
    rawScore -= 3;
    if (!matchedNegative.includes(phrase)) {
      matchedNegative.push(phrase);
    }
  }

  // Check for multi-word negative phrases
  const negativePhrases = findPhrases(textLower, ["not interested", "not a priority", "too expensive"]);
  for (const phrase of negativePhrases) {
    rawScore -= 2;
    if (!matchedNegative.includes(phrase)) {
      matchedNegative.push(phrase);
    }
  }

  // Check individual words
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let contribution = 0;
    let isPositive = false;
    let isNegative = false;

    // Check for positive words
    if (typeof token === 'string' && POSITIVE_WORDS.includes(token)) {
      contribution = 1;
      isPositive = true;
      if (!matchedPositive.includes(token)) {
        matchedPositive.push(token);
      }
    }

    // Check for negative words
    if (typeof token === 'string' && NEGATIVE_WORDS.includes(token)) {
      contribution = -1;
      isNegative = true;
      if (!matchedNegative.includes(token)) {
        matchedNegative.push(token);
      }
    }

    // Apply boosters (check if booster appears before this word)
    if (contribution !== 0 && hasWordInWindow(tokens, i, 2, BOOSTERS)) {
      contribution *= 1.5;
    }

    // Apply negations
    if (contribution !== 0 && hasWordInWindow(tokens, i, 2, NEGATIONS)) {
      if (isPositive) {
        // "not happy" -> flip to negative but weaker
        contribution = -0.5;
        const posIdx = matchedPositive.indexOf(token as string);
        if (posIdx !== -1) {
          matchedPositive.splice(posIdx, 1);
        }
        if (!matchedNegative.includes(`not ${token}`)) {
          matchedNegative.push(`not ${token}`);
        }
      } else if (isNegative) {
        // "not bad" -> flip to positive but weaker
        contribution = 0.5;
        const negIdx = matchedNegative.indexOf(token as string);
        if (negIdx !== -1) {
          matchedNegative.splice(negIdx, 1);
        }
        if (!matchedPositive.includes(`not ${token}`)) {
          matchedPositive.push(`not ${token}`);
        }
      }
    }

    rawScore += contribution;
  }

  // Clamp and normalize
  const clamped = Math.max(-3, Math.min(3, rawScore));
  const normalized = clamped / 3; // gives -1..1

  // Determine label
  let label: SentimentLabel = "neutral";
  if (normalized > 0.2) {
    label = "positive";
  } else if (normalized < -0.2) {
    label = "negative";
  }

  return {
    score: normalized,
    label,
    matchedPositive: [...new Set(matchedPositive)], // deduplicate
    matchedNegative: [...new Set(matchedNegative)], // deduplicate
  };
}

// -----------------------------------------------------------------------------
// Thread-level sentiment analysis
// -----------------------------------------------------------------------------

export interface SentimentSummary {
  avgScore: number;
  totalMessages: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

export async function runSentimentForThread(
  workspaceId: Types.ObjectId | string,
  threadId: Types.ObjectId | string
): Promise<SentimentSummary> {
  const wsId =
    workspaceId instanceof Types.ObjectId
      ? workspaceId
      : new Types.ObjectId(workspaceId);
  const tId =
    threadId instanceof Types.ObjectId ? threadId : new Types.ObjectId(threadId);

  // Load thread with workspace validation
  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).exec();

  if (!thread) {
    throw new Error("Conversation thread not found in this workspace.");
  }

  // Load all messages for this thread
  const messages = await ConversationMessage.find({
    workspaceId: wsId,
    threadId: tId,
  })
    .sort({ sentAt: 1 })
    .exec();

  // Delete existing sentiment rows for this thread
  await MessageSentiment.deleteMany({
    workspaceId: wsId,
    threadId: tId,
  });

  // Process each message
  const sentimentDocs: Array<{
    workspaceId: Types.ObjectId;
    threadId: Types.ObjectId;
    messageId: Types.ObjectId;
    direction?: "inbound" | "outbound";
    label: SentimentLabel;
    score: number;
    tokensAnalyzed?: number;
    meta?: {
      matchedPositive?: string[];
      matchedNegative?: string[];
    };
  }> = [];

  let total = 0;
  let sumScore = 0;
  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  for (const message of messages) {
    const bodyText = message.bodyText || "";
    
    // Skip very short messages
    if (bodyText.trim().length < 2) {
      // Create neutral sentiment for empty/short messages
      sentimentDocs.push({
        workspaceId: wsId,
        threadId: tId,
        messageId: message._id,
        direction: message.direction,
        label: "neutral",
        score: 0,
        tokensAnalyzed: 0,
      });
      total++;
      neutralCount++;
      continue;
    }

    // Compute sentiment
    const result = computeSentimentForText(bodyText);

    // Update aggregates
    total++;
    sumScore += result.score;
    if (result.label === "positive") positiveCount++;
    else if (result.label === "negative") negativeCount++;
    else neutralCount++;

    // Create sentiment document
    sentimentDocs.push({
      workspaceId: wsId,
      threadId: tId,
      messageId: message._id,
      direction: message.direction,
      label: result.label,
      score: result.score,
      tokensAnalyzed: tokenize(bodyText).length,
      meta: {
        matchedPositive: result.matchedPositive,
        matchedNegative: result.matchedNegative,
      },
    });
  }

  // Insert sentiment documents
  if (sentimentDocs.length > 0) {
    await MessageSentiment.insertMany(sentimentDocs);
  }

  // Return summary
  return {
    avgScore: total > 0 ? sumScore / total : 0,
    totalMessages: total,
    positiveCount,
    neutralCount,
    negativeCount,
  };
}

