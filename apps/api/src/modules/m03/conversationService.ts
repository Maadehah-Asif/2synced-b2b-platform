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
  bodyText: string;
  direction: "inbound" | "outbound";
  sentAt: string | Date;
  sender: ManualLogSender;
  createdBy: string;
}

export interface ManualLogResult {
  thread: ConversationThreadDocument;
  message: ConversationMessageDocument;
}

// ---------- Manual logging ----------

async function findOrCreateManualThread(
  workspaceId: Types.ObjectId,
  leadId: Types.ObjectId | undefined,
  dealId: Types.ObjectId | undefined,
  channel: ConversationChannel,
  subject: string,
  createdBy: Types.ObjectId
): Promise<ConversationThreadDocument> {
  const query: any = {
    workspaceId,
    subject,
    source: "manual",
  };

  if (leadId) query.leadId = leadId;
  if (dealId) query.dealId = dealId;

  let thread = await ConversationThread.findOne(query);

  if (!thread) {
    thread = await ConversationThread.create({
      workspaceId,
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

  const sentAt =
    payload.sentAt instanceof Date
      ? payload.sentAt
      : new Date(payload.sentAt);

  const thread = await findOrCreateManualThread(
    workspaceId,
    leadId,
    dealId,
    payload.channel,
    payload.subject,
    createdBy
  );

  const message = await ConversationMessage.create({
    workspaceId,
    threadId: thread._id,
    direction: payload.direction,
    sender: payload.sender,
    sentAt,
    subject: payload.subject,
    bodyText: payload.bodyText,
    channel: payload.channel,
    meta: {},
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
  sentiments: MessageSentimentDocument[];
  latestHealth?: DealHealthDocument | null;
  followUps: FollowUpReminderDocument[];
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

  return {
    thread,
    messages,
    entities,
    sentiments,
    latestHealth: latestHealth || null,
    followUps,
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
