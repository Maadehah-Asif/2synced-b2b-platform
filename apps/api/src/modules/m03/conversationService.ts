import { Types } from "mongoose";
import ConversationThread, {
  type ConversationChannel,
  type ConversationThreadDocument,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import DealHealth, {
  type DealHealthBand,
  type DealHealthDocument,
} from "./models/DealHealth.js";
import ConversationEntity, {
  type ConversationEntityDocument,
} from "./models/ConversationEntity.js";
import MessageSentiment, {
  type MessageSentimentDocument,
} from "./models/MessageSentiment.js";
import FollowUpReminder, {
  type FollowUpReminderDocument,
} from "./models/FollowUpReminder.js";
import { resolveOrCreateCompanyForInput } from "./utils/companyResolver.js";

export interface ManualLogSender {
  name: string;
  email?: string;
  phone?: string;
  role: "prospect" | "rep" | "other";
}

export interface ManualLogPayload {
  workspaceId: string;
  leadId?: string;
  dealId?: string;
  channel: ConversationChannel;
  subject: string;
  body?: string; // New unified field name for body/notes/message
  bodyText?: string; // Legacy field
  direction?: "inbound" | "outbound"; // Optional for notes
  occurredAt?: string | Date; // New unified field name
  sentAt?: string | Date; // Legacy field
  sender?: ManualLogSender; // Legacy format
  // Channel-specific fields
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  toEmails?: string;
  participants?: string[]; // For meetings
  endTime?: string | Date; // For calls/meetings
  companyName?: string; // Company name for company resolution
  prospectEmail?: string | null; // Prospect email for company resolution
  createdBy: string;
}

export interface ManualLogResult {
  thread: ConversationThreadDocument;
  message: ConversationMessageDocument;
}

// ---------- Manual logging ----------

async function findOrCreateManualThread(
  workspaceId: Types.ObjectId,
  companyId: Types.ObjectId,
  leadId: Types.ObjectId | undefined,
  dealId: Types.ObjectId | undefined,
  channel: ConversationChannel,
  subject: string,
  createdBy: Types.ObjectId
): Promise<ConversationThreadDocument> {
  const query: any = {
    workspaceId,
    companyId,
    subject,
    source: "manual",
  };

  if (leadId) query.leadId = leadId;
  if (dealId) query.dealId = dealId;

  let thread = await ConversationThread.findOne(query);

  if (!thread) {
    thread = await ConversationThread.create({
      workspaceId,
      companyId,
      leadId,
      dealId,
      channel,
      subject,
      participants: [],
      messageCount: 0,
      source: "manual",
      createdBy,
    });
  }

  return thread;
}

export async function manualLogConversation(
  payload: ManualLogPayload
): Promise<ManualLogResult> {
  const workspaceId = new Types.ObjectId(payload.workspaceId);
  const createdBy = new Types.ObjectId(payload.createdBy);
  const leadId = payload.leadId ? new Types.ObjectId(payload.leadId) : undefined;
  const dealId = payload.dealId ? new Types.ObjectId(payload.dealId) : undefined;

  // Resolve or create company
  const company = await resolveOrCreateCompanyForInput(
    workspaceId,
    payload.companyName || null,
    payload.prospectEmail || null
  );

  // Normalize timestamp (use occurredAt or fallback to sentAt)
  const sentAt =
    payload.occurredAt instanceof Date
      ? payload.occurredAt
      : payload.sentAt instanceof Date
      ? payload.sentAt
      : new Date(payload.occurredAt || payload.sentAt || new Date());

  // Normalize body text
  const bodyText = payload.body || payload.bodyText || "";

  // Normalize direction (default to outbound for notes)
  const direction = payload.direction || "outbound";

  // Build sender object from channel-specific fields
  let sender: {
    name: string;
    email?: string;
    phone?: string;
    role: "prospect" | "rep" | "other";
  };

  if (payload.sender) {
    // Legacy format
    sender = {
      name: payload.sender.name,
      role: payload.sender.role,
    };
    if (payload.sender.email) {
      sender.email = payload.sender.email;
    }
    if (payload.sender.phone) {
      sender.phone = payload.sender.phone;
    }
  } else {
    // New channel-specific format
    const contactName = payload.contactName || "Unknown";
    sender = {
      name: contactName,
      role: direction === "inbound" ? "prospect" : "rep",
    };
    if (payload.contactEmail) {
      sender.email = payload.contactEmail;
    }
    if (payload.contactPhone) {
      sender.phone = payload.contactPhone;
    }
  }

  // Build participants array for thread
  const participants: Array<{
    role: "prospect" | "rep" | "other";
    name: string;
    email?: string;
    phone?: string;
  }> = [];

  if (payload.participants && payload.participants.length > 0) {
    // Meeting participants
    for (const participant of payload.participants) {
      const trimmed = participant.trim();
      if (trimmed) {
        // Try to parse as email or name
        const isEmail = trimmed.includes("@");
        const participantObj: {
          role: "prospect" | "rep" | "other";
          name: string;
          email?: string;
        } = {
          role: "prospect", // Default, could be enhanced
          name: isEmail ? (trimmed.split("@")[0] || trimmed) : trimmed,
        };
        if (isEmail) {
          participantObj.email = trimmed;
        }
        participants.push(participantObj);
      }
    }
  } else if (sender.name && sender.name.trim()) {
    // Single participant from sender
    const participantObj: {
      role: "prospect" | "rep" | "other";
      name: string;
      email?: string;
      phone?: string;
    } = {
      role: sender.role,
      name: sender.name.trim(),
    };
    if (sender.email) {
      participantObj.email = sender.email;
    }
    if (sender.phone) {
      participantObj.phone = sender.phone;
    }
    participants.push(participantObj);
  }

  const thread = await findOrCreateManualThread(
    workspaceId,
    company._id,
    leadId,
    dealId,
    payload.channel,
    payload.subject,
    createdBy
  );

  // Update thread participants if needed
  if (participants.length > 0 && thread.participants.length === 0) {
    thread.participants = participants;
  }

  const message = await ConversationMessage.create({
    workspaceId,
    threadId: thread._id,
    direction,
    sender,
    sentAt,
    subject: payload.subject,
    bodyText,
    channel: payload.channel,
    meta: {
      endTime: payload.endTime
        ? payload.endTime instanceof Date
          ? payload.endTime
          : new Date(payload.endTime)
        : undefined,
    },
  });

  if (!thread.firstMessageAt || sentAt < thread.firstMessageAt) {
    thread.firstMessageAt = sentAt;
  }
  if (!thread.lastMessageAt || sentAt > thread.lastMessageAt) {
    thread.lastMessageAt = sentAt;
  }
  thread.messageCount = (thread.messageCount || 0) + 1;

  await thread.save();

  return { thread, message };
}

// ---------- List conversations ----------

export interface ListConversationsParams {
  workspaceId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  channel?: ConversationChannel;
  band?: DealHealthBand;
  leadId?: string;
  dealId?: string;
  companyId?: string; // New: filter by company ID
}

export interface ConversationListItem {
  thread: ConversationThreadDocument;
  latestHealth?: DealHealthDocument | null;
}

export interface ListConversationsResult {
  items: ConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listConversations(
  params: ListConversationsParams
): Promise<ListConversationsResult> {
  const {
    workspaceId,
    page = 1,
    pageSize = 20,
    search,
    channel,
    band,
    leadId,
    dealId,
    companyId, // New: filter by company ID
  } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const query: any = {
    workspaceId: wsId,
  };

  if (channel) {
    query.channel = channel;
  }
  if (leadId) {
    query.leadId = new Types.ObjectId(leadId);
  }
  if (dealId) {
    query.dealId = new Types.ObjectId(dealId);
  }
  if (companyId) {
    query.companyId = new Types.ObjectId(companyId);
  }
  if (search && search.trim().length > 0) {
    query.subject = { $regex: search.trim(), $options: "i" };
  }

  const total = await ConversationThread.countDocuments(query);

  const threads = await ConversationThread.find(query)
    .sort({ lastMessageAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<ConversationThreadDocument[]>()
    .exec();

  const threadIds = threads.map((t) => t._id);

  let healthByThreadId: Record<string, DealHealthDocument | null> = {};
  if (threadIds.length > 0) {
    const healthDocs = await Promise.all(
      threadIds.map((id) =>
        DealHealth.findOne({
          workspaceId: wsId,
          threadId: id,
        })
          .sort({ lastComputedAt: -1 })
          .lean<DealHealthDocument | null>()
          .exec()
      )
    );

    healthByThreadId = {};
    threadIds.forEach((id, idx) => {
      const h = healthDocs[idx];
      if (h) {
        healthByThreadId[id.toString()] = h;
      }
    });

    if (band) {
      const filtered: ConversationThreadDocument[] = [];
      threads.forEach((t) => {
        const h = healthByThreadId[t._id.toString()];
        if (!h && band) {
          return;
        }
        if (!h || h.band === band) {
          filtered.push(t);
        }
      });

      threads.splice(0, threads.length, ...filtered);
    }
  }

  const items: ConversationListItem[] = threads.map((thread) => ({
    thread: thread as any,
    latestHealth: healthByThreadId[thread._id.toString()] || null,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

// ---------- Conversation detail ----------

export interface ConversationDetail {
  thread: ConversationThreadDocument;
  messages: ConversationMessageDocument[];
  entities: ConversationEntityDocument[];
  sentiments: Array<{
    _id: Types.ObjectId;
    messageId: Types.ObjectId;
    score: number;
    label: string;
    direction?: "inbound" | "outbound";
  }>;
  latestHealth?: DealHealthDocument | null;
  followUps: FollowUpReminderDocument[];
  followUpIntent?: {
    label: string;
    confidence: number;
    suggestedMessage: string;
  } | null;
}

export async function getConversationDetail(
  workspaceId: string,
  threadId: string
): Promise<ConversationDetail | null> {
  const wsId = new Types.ObjectId(workspaceId);
  const tId = new Types.ObjectId(threadId);

  const thread = await ConversationThread.findOne({
    _id: tId,
    workspaceId: wsId,
  }).exec();

  if (!thread) {
    return null;
  }

  const [messages, entities, sentiments, latestHealth, followUps] =
    await Promise.all([
      ConversationMessage.find({
        workspaceId: wsId,
        threadId: tId,
      })
        .sort({ sentAt: 1 })
        .exec(),
      ConversationEntity.find({
        workspaceId: wsId,
        threadId: tId,
        status: { $ne: "obsolete" }, // Only load active entities
      }).exec(),
      MessageSentiment.find({
        workspaceId: wsId,
        threadId: tId,
      }).exec(),
      DealHealth.findOne({
        workspaceId: wsId,
        threadId: tId,
      })
        .sort({ lastComputedAt: -1 })
        .exec(),
      FollowUpReminder.find({
        workspaceId: wsId,
        threadId: tId,
        status: { $in: ["pending", "snoozed"] },
      })
        .sort({ dueAt: 1 })
        .exec(),
    ]);

  // Format sentiments to only include necessary fields for frontend
  const formattedSentiments: ConversationDetail["sentiments"] = sentiments.map((s) => {
    const sentiment: ConversationDetail["sentiments"][0] = {
      _id: s._id,
      messageId: s.messageId,
      score: s.score,
      label: s.label,
    };
    if (s.direction) {
      sentiment.direction = s.direction;
    }
    return sentiment;
  });

  // Compute follow-up intent if deal health is available
  let followUpIntent: ConversationDetail["followUpIntent"] = null;
  if (latestHealth) {
    try {
      const { computeFollowUpIntentFromDeal } = await import(
        "./services/followUpIntentService.js"
      );
      
      // Extract contact name from thread participants or messages
      const primaryContact = thread.participants.find((p) => p.role === "prospect") || 
                            thread.participants[0];
      const context: {
        contactName?: string;
        companyName?: string;
      } = {
        companyName: thread.subject, // Use subject as fallback for company name
      };
      if (primaryContact?.name) {
        context.contactName = primaryContact.name;
      }

      const intentResult = computeFollowUpIntentFromDeal(latestHealth, context);

      if (intentResult) {
        followUpIntent = {
          label: intentResult.intent,
          confidence: intentResult.confidence,
          suggestedMessage: intentResult.suggestedMessage,
        };
      }
    } catch (err: any) {
      console.error("Error computing follow-up intent:", err);
      // Continue without follow-up intent if computation fails
    }
  }

  return {
    thread,
    messages,
    entities,
    sentiments: formattedSentiments,
    latestHealth: latestHealth || null,
    followUps,
    followUpIntent,
  };
}

// ---------- Export conversations ----------

export interface ExportConversationRow {
  threadId: string;
  subject: string;
  channel: ConversationChannel;
  leadId?: string | undefined;
  dealId?: string | undefined;
  lastMessageAt?: Date | null | undefined;
  messageCount: number;
  healthBand?: DealHealthBand | undefined;
  healthScore?: number | undefined;
  daysSinceLastMessage?: number | null | undefined;
  hasBudget?: boolean | undefined;
  hasDecisionMaker?: boolean | undefined;
  hasTimeline?: boolean | undefined;
  competitorMentions?: number | undefined;
}

export interface ExportConversationsParams {
  workspaceId: string;
  channel?: ConversationChannel;
  band?: DealHealthBand;
  leadId?: string;
  dealId?: string;
  limit?: number;
}

export async function exportConversations(
  params: ExportConversationsParams
): Promise<ExportConversationRow[]> {
  const {
    workspaceId,
    channel,
    band,
    leadId,
    dealId,
    limit = 1000,
  } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const query: any = {
    workspaceId: wsId,
  };

  if (channel) query.channel = channel;
  if (leadId) query.leadId = new Types.ObjectId(leadId);
  if (dealId) query.dealId = new Types.ObjectId(dealId);

  const threads = await ConversationThread.find(query)
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean<ConversationThreadDocument[]>()
    .exec();

  const threadIds = threads.map((t) => t._id);
  const now = new Date();

  let healthByThreadId: Record<string, DealHealthDocument | null> = {};
  if (threadIds.length > 0) {
    const healthDocs = await Promise.all(
      threadIds.map((id) =>
        DealHealth.findOne({
          workspaceId: wsId,
          threadId: id,
        })
          .sort({ lastComputedAt: -1 })
          .lean<DealHealthDocument | null>()
          .exec()
      )
    );
    healthByThreadId = {};
    threadIds.forEach((id, idx) => {
      const h = healthDocs[idx];
      if (h) {
        healthByThreadId[id.toString()] = h;
      }
    });
  }

  const filteredThreads = band
    ? threads.filter((t) => {
        const h = healthByThreadId[t._id.toString()];
        return h && h.band === band;
      })
    : threads;

  const rows: ExportConversationRow[] = filteredThreads.map((t) => {
    const health = healthByThreadId[t._id.toString()] || null;
    const lastMessageAt = t.lastMessageAt || null;
    const daysSinceLastMessage =
      lastMessageAt != null
        ? Math.floor(
            (now.getTime() - lastMessageAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

    const signals = health?.signals || undefined;

    return {
      threadId: t._id.toString(),
      subject: t.subject,
      channel: t.channel,
      leadId: t.leadId ? t.leadId.toString() : undefined,
      dealId: t.dealId ? t.dealId.toString() : undefined,
      lastMessageAt,
      messageCount: t.messageCount || 0,
      healthBand: health?.band,
      healthScore: health?.score,
      daysSinceLastMessage,
      hasBudget: signals?.hasBudget,
      hasDecisionMaker: signals?.hasDecisionMaker,
      hasTimeline: signals?.hasTimeline,
      competitorMentions: signals?.competitorMentions,
    };
  });

  return rows;
}
