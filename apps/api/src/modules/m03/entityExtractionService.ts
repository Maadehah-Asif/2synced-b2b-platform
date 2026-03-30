import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import ConversationEntity, {
  type ConversationEntityCreateInput,
  type ConversationEntityType,
} from "./models/ConversationEntity.js";

// -----------------------------------------------------------------------------
// Entity extraction result type
// -----------------------------------------------------------------------------

export interface ExtractedEntity {
  type: ConversationEntityType;
  value: string;
  confidence: number;
  sourceMessageId?: Types.ObjectId;
}

// -----------------------------------------------------------------------------
// Budget extraction rules
// -----------------------------------------------------------------------------

const BUDGET_KEYWORDS = [
  "budget",
  "pricing",
  "price",
  "cost",
  "quote",
  "dollars",
  "usd",
  "eur",
  "pkr",
  "rupees",
  "per month",
  "per year",
  "annual",
  "monthly",
];

const STRONG_BUDGET_KEYWORDS = ["budget", "pricing", "price"];

// Currency patterns: $123, 123k, 123 thousand, 123 million, etc.
const CURRENCY_PATTERN = /\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:k|K|thousand|million|m|b)?/i;

// Budget phrases that include numbers
const BUDGET_PATTERNS: RegExp[] = [
  /(?:budget|pricing|price|cost)\s+(?:of|is|around|about|approximately|roughly|up to|limited to|max|maximum)\s+\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:k|K|thousand|million|m|b)?/i,
  /\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:k|K|thousand|million|m|b)?\s+(?:dollars?|usd|eur|pkr|rupees?|per month|per year|annual|monthly)/i,
  /(?:budget|pricing|price|cost)\s+(?:of|is)\s+\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?/i,
  /(?:around|about|approximately|roughly)\s+\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:k|K|thousand|million|m|b)?\s+(?:dollars?|budget|price|cost)/i,
];

function extractBudgetEntities(text: string, originalText: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const textLower = text.toLowerCase();
  const seen = new Set<string>();

  // Check for budget patterns with numbers
  for (const pattern of BUDGET_PATTERNS) {
    const matches = originalText.matchAll(new RegExp(pattern.source, "gi"));
    for (const match of matches) {
      const phrase = match[0].trim();
      if (phrase.length > 80) continue; // Skip overly long matches

      const normalized = phrase.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      // Check if it contains a strong budget keyword
      const hasStrongKeyword = STRONG_BUDGET_KEYWORDS.some((kw) =>
        normalized.includes(kw)
      );
      const hasNumber = CURRENCY_PATTERN.test(phrase);

      let confidence = 0.7;
      if (hasStrongKeyword && hasNumber) {
        confidence = 0.9;
      } else if (hasNumber) {
        confidence = 0.7;
      } else if (hasStrongKeyword) {
        confidence = 0.5;
      }

      entities.push({
        type: "budget",
        value: phrase.substring(0, 80), // Limit length
        confidence,
      });
    }
  }

  // Also check for standalone currency mentions near budget keywords
  const sentences = originalText.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const hasBudgetKeyword = BUDGET_KEYWORDS.some((kw) =>
      sentenceLower.includes(kw)
    );
    const currencyMatch = sentence.match(CURRENCY_PATTERN);

    if (hasBudgetKeyword && currencyMatch) {
      const phrase = sentence.trim();
      if (phrase.length > 80) continue;

      const normalized = phrase.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const hasStrongKeyword = STRONG_BUDGET_KEYWORDS.some((kw) =>
        normalized.includes(kw)
      );

      entities.push({
        type: "budget",
        value: phrase.substring(0, 80),
        confidence: hasStrongKeyword ? 0.9 : 0.7,
      });
    }
  }

  return entities;
}

// -----------------------------------------------------------------------------
// Decision maker extraction rules
// -----------------------------------------------------------------------------

const DECISION_MAKER_TITLES = [
  "ceo",
  "cto",
  "coo",
  "cfo",
  "founder",
  "cofounder",
  "vp",
  "vice president",
  "director",
  "head of",
  "lead",
  "owner",
  "procurement",
  "purchasing manager",
  "decision maker",
  "final approver",
  "sign off",
  "final decision",
  "final say",
  "approver",
];

const DECISION_STRONG_MARKERS = [
  "decision",
  "sign off",
  "final call",
  "final say",
  "approve",
  "approver",
];

// Pattern for person names: Capitalized word followed by another capitalized word
const PERSON_NAME_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/;

function extractDecisionMakerEntities(
  text: string,
  originalText: string
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const textLower = text.toLowerCase();
  const seen = new Set<string>();

  // Find sentences with decision maker titles
  const sentences = originalText.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    let hasTitle = false;
    let titleFound = "";

    for (const title of DECISION_MAKER_TITLES) {
      if (sentenceLower.includes(title)) {
        hasTitle = true;
        titleFound = title;
        break;
      }
    }

    if (!hasTitle) continue;

    // Check for person name
    const nameMatch = sentence.match(PERSON_NAME_PATTERN);
    const hasStrongMarker = DECISION_STRONG_MARKERS.some((marker) =>
      sentenceLower.includes(marker)
    );

    // Extract phrase around the title
    const titleIndex = sentenceLower.indexOf(titleFound);
    const start = Math.max(0, titleIndex - 30);
    const end = Math.min(sentence.length, titleIndex + titleFound.length + 50);
    let phrase = sentence.substring(start, end).trim();

    // Include name if found
    if (nameMatch) {
      phrase = sentence.trim();
    }

    if (phrase.length > 100) {
      phrase = phrase.substring(0, 100);
    }

    const normalized = phrase.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let confidence = 0.7;
    if (hasStrongMarker) {
      confidence = 0.9;
    } else if (nameMatch) {
      confidence = 0.8;
    }

    entities.push({
      type: "decision_maker",
      value: phrase,
      confidence,
    });
  }

  return entities;
}

// -----------------------------------------------------------------------------
// Timeline extraction rules
// -----------------------------------------------------------------------------

const TIMELINE_KEYWORDS = [
  "this month",
  "next month",
  "this quarter",
  "next quarter",
  "q1",
  "q2",
  "q3",
  "q4",
  "by end of",
  "by the end of",
  "before",
  "after",
  "deadline",
  "in 2 weeks",
  "in 3 weeks",
  "in 4 weeks",
  "in 1 week",
  "in 2 days",
  "in 3 days",
  "in 1 month",
  "in 2 months",
  "in 3 months",
  "by june",
  "by december",
  "by january",
  "by february",
  "by march",
  "by april",
  "by may",
  "by july",
  "by august",
  "by september",
  "by october",
  "by november",
  "this year",
  "next year",
  "soon",
  "later this year",
];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const TIMELINE_PATTERNS: RegExp[] = [
  /\b(?:in|by|before|after|within)\s+\d+\s+(?:days?|weeks?|months?|years?)\b/i,
  /\b(?:q[1-4]|quarter\s+[1-4])\s*(?:of\s+)?(?:20\d{2})?\b/i,
  /\b(?:by|before|after|on)\s+(?:the\s+)?(?:end\s+of\s+)?(?:this|next)\s+(?:month|quarter|year)\b/i,
  /\b(?:by|before|after|on)\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:\d{4})?\b/i,
  /\b(?:20[2-9]\d)\b/, // Years 2020+
];

const VAGUE_TIMELINE_PHRASES = ["soon", "later", "eventually", "someday"];

function extractTimelineEntities(
  text: string,
  originalText: string
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const textLower = text.toLowerCase();
  const seen = new Set<string>();

  // Check for specific timeline patterns
  for (const pattern of TIMELINE_PATTERNS) {
    const matches = originalText.matchAll(new RegExp(pattern.source, "gi"));
    for (const match of matches) {
      const phrase = match[0].trim();
      if (phrase.length > 80) continue;

      const normalized = phrase.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      entities.push({
        type: "timeline",
        value: phrase,
        confidence: 0.9,
      });
    }
  }

  // Check for timeline keywords
  for (const keyword of TIMELINE_KEYWORDS) {
    if (textLower.includes(keyword)) {
      const index = textLower.indexOf(keyword);
      const start = Math.max(0, index - 20);
      const end = Math.min(originalText.length, index + keyword.length + 30);
      let phrase = originalText.substring(start, end).trim();

      // Try to get full sentence
      const sentenceMatch = originalText.match(
        new RegExp(`[^.!?]*${keyword}[^.!?]*[.!?]?`, "i")
      );
      if (sentenceMatch) {
        phrase = sentenceMatch[0].trim();
      }

      if (phrase.length > 100) {
        phrase = phrase.substring(0, 100);
      }

      const normalized = phrase.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const isVague = VAGUE_TIMELINE_PHRASES.some((v) => phrase.toLowerCase().includes(v));
      const confidence = isVague ? 0.6 : 0.8;

      entities.push({
        type: "timeline",
        value: phrase,
        confidence,
      });
    }
  }

  return entities;
}

// -----------------------------------------------------------------------------
// Competitor extraction rules
// -----------------------------------------------------------------------------

const KNOWN_COMPETITORS = [
  "hubspot",
  "salesforce",
  "pipedrive",
  "zoho",
  "freshsales",
  "monday.com",
  "asana",
  "trello",
  "jira",
  "notion",
  "slack",
  "microsoft teams",
  "google workspace",
  "competitor x",
  "competitor y",
];

const GENERIC_COMPETITOR_PHRASES = [
  "other vendors",
  "other tools",
  "other solutions",
  "other platforms",
  "competitors",
  "your competitors",
  "alternative",
  "alternatives",
  "we are also evaluating",
  "we are considering",
  "we are looking at",
];

function extractCompetitorEntities(
  text: string,
  originalText: string
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const textLower = text.toLowerCase();
  const seen = new Set<string>();

  // Check for known competitors
  for (const competitor of KNOWN_COMPETITORS) {
    if (textLower.includes(competitor)) {
      const normalized = competitor.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      entities.push({
        type: "competitor",
        value: competitor,
        confidence: 0.9,
      });
    }
  }

  // Check for generic competitor phrases
  for (const phrase of GENERIC_COMPETITOR_PHRASES) {
    if (textLower.includes(phrase)) {
      const index = textLower.indexOf(phrase);
      const start = Math.max(0, index - 15);
      const end = Math.min(originalText.length, index + phrase.length + 25);
      let extractedPhrase = originalText.substring(start, end).trim();

      if (extractedPhrase.length > 80) {
        extractedPhrase = extractedPhrase.substring(0, 80);
      }

      const normalized = extractedPhrase.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      entities.push({
        type: "competitor",
        value: extractedPhrase,
        confidence: 0.7,
      });
    }
  }

  return entities;
}

// -----------------------------------------------------------------------------
// Main extraction function
// -----------------------------------------------------------------------------

export function extractEntitiesFromText(
  text: string,
  opts?: {
    workspaceId?: Types.ObjectId | string;
    threadId?: Types.ObjectId | string;
    messageId?: Types.ObjectId | string;
  }
): ExtractedEntity[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const originalText = text;
  const normalizedText = text.toLowerCase();

  const allEntities: ExtractedEntity[] = [];

  // Extract each type
  const budgetEntities = extractBudgetEntities(normalizedText, originalText);
  const decisionMakerEntities = extractDecisionMakerEntities(
    normalizedText,
    originalText
  );
  const timelineEntities = extractTimelineEntities(normalizedText, originalText);
  const competitorEntities = extractCompetitorEntities(
    normalizedText,
    originalText
  );

  // Add messageId to entities if provided
  if (opts?.messageId) {
    const messageId =
      opts.messageId instanceof Types.ObjectId
        ? opts.messageId
        : new Types.ObjectId(opts.messageId);

    budgetEntities.forEach((e) => (e.sourceMessageId = messageId));
    decisionMakerEntities.forEach((e) => (e.sourceMessageId = messageId));
    timelineEntities.forEach((e) => (e.sourceMessageId = messageId));
    competitorEntities.forEach((e) => (e.sourceMessageId = messageId));
  }

  allEntities.push(
    ...budgetEntities,
    ...decisionMakerEntities,
    ...timelineEntities,
    ...competitorEntities
  );

  // Deduplicate by value (case-insensitive) per message
  const deduplicated: ExtractedEntity[] = [];
  const valueSet = new Set<string>();

  for (const entity of allEntities) {
    const key = `${entity.type}:${entity.value.toLowerCase()}`;
    if (!valueSet.has(key)) {
      valueSet.add(key);
      deduplicated.push(entity);
    }
  }

  return deduplicated;
}

// -----------------------------------------------------------------------------
// Thread-level extraction
// -----------------------------------------------------------------------------

export async function runEntityExtractionForThread(
  threadId: Types.ObjectId | string
): Promise<void> {
  const tId =
    threadId instanceof Types.ObjectId ? threadId : new Types.ObjectId(threadId);

  // Load thread with workspace validation
  const thread = await ConversationThread.findById(tId).exec();
  if (!thread) {
    throw new Error("Conversation thread not found.");
  }

  const workspaceId = thread.workspaceId;

  // Load all messages for this thread
  const messages = await ConversationMessage.find({
    workspaceId,
    threadId: tId,
  })
    .sort({ sentAt: 1 })
    .exec();

  // Mark existing entities as obsolete
  await ConversationEntity.updateMany(
    {
      workspaceId,
      threadId: tId,
      status: { $ne: "obsolete" },
    },
    {
      $set: { status: "obsolete" },
    }
  );

  // Extract entities from each message
  const entityInputs: ConversationEntityCreateInput[] = [];

  for (const message of messages) {
    if (!message.bodyText || message.bodyText.trim().length === 0) {
      continue;
    }

    // Combine subject and body text for extraction
    const fullText = [message.subject, message.bodyText]
      .filter(Boolean)
      .join(" ");

    const extracted = extractEntitiesFromText(fullText, {
      workspaceId,
      threadId: tId,
      messageId: message._id,
    });

    // Convert to create inputs
    for (const entity of extracted) {
      entityInputs.push({
        workspaceId,
        threadId: tId,
        messageId: entity.sourceMessageId || message._id,
        type: entity.type,
        value: entity.value,
        confidence: Math.max(0, Math.min(1, entity.confidence)), // Ensure 0-1
        sourceSnippet: entity.value,
        status: "active",
      });
    }
  }

  // Note: leadId and dealId are not stored on ConversationEntity model
  // They are available on the thread and can be queried via threadId

  // Insert new entities
  if (entityInputs.length > 0) {
    await ConversationEntity.insertMany(entityInputs);
  }
}

