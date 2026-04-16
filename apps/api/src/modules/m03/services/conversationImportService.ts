/**
 * Conversation Import Service
 * 
 * Parses CSV files and creates ConversationThread and ConversationMessage records.
 */

import { parse } from "csv-parse/sync";
import { Types } from "mongoose";
import ConversationThread, {
  type ConversationThreadDocument,
  type ConversationChannel,
} from "../models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "../models/ConversationMessage.js";
import { resolveOrCreateCompanyForInput, extractDomainFromEmail } from "../utils/companyResolver.js";
import { resolveLeadForConversation } from "./leadResolverService.js";

export interface RawMessageRow {
  threadKey: string;
  sentAt: Date;
  direction: "inbound" | "outbound";
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  toEmail?: string; // For email channel, recipient email (for outbound company resolution)
  subject?: string;
  bodyText?: string;
  notes?: string;
  participants?: string; // For meeting notes
  endTime?: Date; // For meeting notes
  company?: string; // Company name from CSV
}

export interface ImportConversationLogOptions {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: "email" | "whatsapp" | "call" | "meeting";
  csvBuffer: Buffer;
}

export interface ImportConversationLogResult {
  threadsCreated: number;
  messagesCreated: number;
}

export interface ImportConversationLogError {
  error: string;
  details?: string;
}

/**
 * Required CSV headers per channel.
 */
const REQUIRED_HEADERS = {
  email: [
    "thread_key",
    "sent_at",
    "from_name",
    "from_email",
    "to_email",
    "subject",
    "body",
    "direction",
  ],
  meeting: [
    "thread_key",
    "meeting_start",
    "meeting_end",
    "participants",
    "note_text",
  ],
  whatsapp: [
    "thread_key",
    "sent_at",
    "sender_name",
    "sender_phone",
    "direction",
    "message_text",
  ],
  call: [
    "thread_key",
    "call_start",
    "call_end",
    "caller_name",
    "direction",
    "notes",
  ],
} as const;

/**
 * Validate CSV headers for a given channel.
 */
function validateCsvHeaders(
  headers: string[],
  channel: "email" | "whatsapp" | "call" | "meeting"
): { valid: boolean; missingHeaders?: string[] } {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  const requiredHeaders = REQUIRED_HEADERS[channel].map((h) => h.toLowerCase());

  const missingHeaders = requiredHeaders.filter(
    (req) => !normalizedHeaders.includes(req)
  );

  if (missingHeaders.length > 0) {
    return { valid: false, missingHeaders };
  }

  return { valid: true };
}

/**
 * Map CSV row to normalized message input based on channel.
 */
function mapRowToMessageInput(
  row: Record<string, string>,
  channel: "email" | "whatsapp" | "call" | "meeting"
): RawMessageRow | null {
  let threadKey = "";
  let sentAt: Date | null = null;
  let direction: "inbound" | "outbound" | null = null;
  let senderName: string | undefined;
  let senderEmail: string | undefined;
  let senderPhone: string | undefined;
  let subject: string | undefined;
  let bodyText: string | undefined;
  let notes: string | undefined;

  if (channel === "email") {
    threadKey = (row["thread_key"] || row["conversation_id"] || row["thread_id"] || "").trim();
    const sentAtStr = row["sent_at"] || row["timestamp"] || "";
    direction = (row["direction"] || "").toLowerCase() as "inbound" | "outbound";
    senderName = (row["from_name"] || row["sender_name"] || "").trim();
    senderEmail = (row["from_email"] || row["sender_email"] || "").trim();
    const toEmail = (row["to_email"] || "").trim();
    subject = (row["subject"] || "").trim();
    bodyText = (row["body"] || row["body_text"] || row["message"] || "").trim();
    
    // Extract company from CSV (try company, company_name, account)
    const company = (row["company"] || row["company_name"] || row["account"] || "").trim();

    if (!threadKey || !sentAtStr || !direction || !senderName) {
      return null;
    }

    try {
      sentAt = new Date(sentAtStr);
      if (isNaN(sentAt.getTime())) {
        return null;
      }
    } catch {
      return null;
    }
    
    const result: RawMessageRow = {
      threadKey,
      sentAt,
      direction,
      senderName,
      senderEmail,
      subject,
      bodyText,
    };
    if (toEmail) {
      result.toEmail = toEmail;
    }
    if (company) {
      result.company = company;
    }
    return result;
  } else if (channel === "whatsapp") {
    threadKey = (row["thread_key"] || row["conversation_id"] || row["chat_id"] || "").trim();
    const timestampStr = row["timestamp"] || row["sent_at"] || row["message_time"] || "";
    const senderType = (row["sender_type"] || "").toLowerCase();
    direction = senderType === "customer" || senderType === "prospect" ? "inbound" : "outbound";
    if (!direction && row["direction"]) {
      direction = (row["direction"] || "").toLowerCase() as "inbound" | "outbound";
    }
    senderName = (row["sender_name"] || row["contact_name"] || "").trim();
    senderPhone = (row["sender_phone"] || row["phone"] || "").trim();
    bodyText = (row["message_text"] || row["message"] || row["text"] || "").trim();

    if (!threadKey || !timestampStr || !direction || !senderName) {
      return null;
    }

    try {
      sentAt = new Date(timestampStr);
      if (isNaN(sentAt.getTime())) {
        return null;
      }
    } catch {
      return null;
    }
  } else if (channel === "call") {
    threadKey = (row["thread_key"] || row["call_id"] || row["conversation_id"] || "").trim();
    const callStartStr = row["call_start"] || row["start_time"] || row["timestamp"] || "";
    direction = (row["direction"] || "").toLowerCase() as "inbound" | "outbound";
    senderName = (row["caller_name"] || row["caller"] || row["contact_name"] || "").trim();
    notes = (row["notes"] || row["call_notes"] || row["summary"] || "").trim();
    bodyText = notes;

    if (!threadKey || !callStartStr || !direction || !senderName) {
      return null;
    }

    try {
      sentAt = new Date(callStartStr);
      if (isNaN(sentAt.getTime())) {
        return null;
      }
    } catch {
      return null;
    }
  } else if (channel === "meeting") {
    threadKey = (row["thread_key"] || "").trim();
    const meetingStartStr = (row["meeting_start"] || "").trim();
    const meetingEndStr = (row["meeting_end"] || "").trim();
    const participantsStr = (row["participants"] || "").trim();
    notes = (row["note_text"] || "").trim();
    bodyText = notes;

    // For meetings, we don't require senderName since participants is the key field
    // Use participants as senderName if available, or a default
    senderName = participantsStr || "Meeting participants";

    // Meetings are typically internal notes, default to outbound
    direction = "outbound";

    // Validate required fields for meeting
    if (!threadKey || !meetingStartStr || !notes) {
      return null;
    }

    try {
      sentAt = new Date(meetingStartStr);
      if (isNaN(sentAt.getTime())) {
        return null;
      }
    } catch {
      return null;
    }

    // Store participants and endTime for later use
    const result: RawMessageRow = {
      threadKey,
      sentAt,
      direction,
      senderName,
      bodyText,
      notes,
    };
    
    if (participantsStr) {
      result.participants = participantsStr;
    }
    
    if (meetingEndStr) {
      try {
        const endDate = new Date(meetingEndStr);
        if (!isNaN(endDate.getTime())) {
          result.endTime = endDate;
        }
      } catch {
        // Ignore invalid date
      }
    }
    
    return result;
  }

  if (!threadKey || !sentAt || !direction) {
    return null;
  }

  const result: RawMessageRow = {
    threadKey,
    sentAt,
    direction,
  };
  
  if (senderName) {
    result.senderName = senderName;
  }
  if (senderEmail) {
    result.senderEmail = senderEmail;
  }
  if (senderPhone) {
    result.senderPhone = senderPhone;
  }
  if (subject) {
    result.subject = subject;
  }
  if (bodyText) {
    result.bodyText = bodyText;
  }
  if (notes) {
    result.notes = notes;
  }
  
  // Extract company for other channels too
  const company = (row["company"] || row["company_name"] || row["account"] || "").trim();
  if (company) {
    result.company = company;
  }
  
  return result;
}

/**
 * Upsert a thread and create a message.
 */
async function upsertThreadAndMessage(
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId,
  channel: ConversationChannel,
  row: RawMessageRow
): Promise<{ thread: ConversationThreadDocument; message: ConversationMessageDocument }> {
  const threadKey = row.threadKey;
  
  // Extract prospect email for company resolution
  let prospectEmail: string | null = null;
  if (channel === "email") {
    if (row.direction === "inbound") {
      prospectEmail = row.senderEmail || null;
    } else if (row.direction === "outbound") {
      // For outbound, use to_email (recipient is the prospect)
      prospectEmail = row.toEmail || null;
    }
  }
  
  // Resolve or create company
  const company = await resolveOrCreateCompanyForInput(
    workspaceId,
    row.company || null,
    prospectEmail
  );

  const inferredLeadId = await resolveLeadForConversation({
    email: prospectEmail,
    fullName: row.direction === "inbound" ? row.senderName : null,
    companyName: row.company || company.name,
    companyDomain: company.primaryDomain || extractDomainFromEmail(prospectEmail),
  });
  
  // For meeting notes, use note_text for subject, otherwise use existing logic
  let subject: string;
  if (channel === "meeting") {
    const notePreview = (row.bodyText || row.notes || "").slice(0, 60);
    subject = `Meeting notes: ${notePreview}${notePreview.length >= 60 ? "..." : ""}`;
  } else {
    subject = row.subject || `${channel} thread with ${row.senderName || "contact"}`;
  }

  // Find or create thread using externalThreadId
  let thread = await ConversationThread.findOne({
    workspaceId,
    channel,
    externalThreadId: threadKey,
  }).exec();

  if (!thread) {
    // Build participants array
    const participants: Array<{
      role: "prospect" | "rep" | "other";
      name: string;
      email?: string;
      phone?: string;
    }> = [];

    if (channel === "meeting" && row.participants) {
      // Parse participants string (comma-separated) into array
      const participantNames = row.participants.split(",").map((p) => p.trim()).filter((p): p is string => Boolean(p));
      for (const name of participantNames) {
        // Try to parse as email
        const isEmail = name.includes("@");
        const participant: {
          role: "prospect" | "rep" | "other";
          name: string;
          email?: string;
        } = {
          role: "other",
          name: isEmail ? (name.split("@")[0] || name) : name,
        };
        if (isEmail) {
          participant.email = name;
        }
        participants.push(participant);
      }
    } else if (row.senderName) {
      const participant: {
        role: "prospect" | "rep" | "other";
        name: string;
        email?: string;
        phone?: string;
      } = {
        role: row.direction === "inbound" ? "prospect" : "rep",
        name: row.senderName,
      };
      if (row.senderEmail) {
        participant.email = row.senderEmail;
      }
      if (row.senderPhone) {
        participant.phone = row.senderPhone;
      }
      participants.push(participant);
    }

    thread = await ConversationThread.create({
      workspaceId,
      companyId: company._id,
      ...(inferredLeadId && { leadId: inferredLeadId }),
      channel,
      subject,
      externalThreadId: threadKey,
      participants,
      messageCount: 0,
      source: "upload",
      createdBy: userId,
    });
  } else if (!thread.leadId && inferredLeadId) {
    // Backfill on existing upload threads only when the resolver is confident.
    thread.leadId = inferredLeadId;
  }

  // Create message
  const message = await ConversationMessage.create({
    workspaceId,
    threadId: thread._id,
    direction: row.direction,
    sender: {
      name: row.senderName || "Unknown",
      email: row.senderEmail,
      phone: row.senderPhone,
      role: row.direction === "inbound" ? "prospect" : "rep",
    },
    sentAt: row.sentAt,
    subject: row.subject,
    bodyText: row.bodyText || row.notes || "",
    channel,
    meta: row.endTime ? { endTime: row.endTime } : undefined,
  });

  // Update thread summary - use min/max dates across all messages
  const messages = await ConversationMessage.find({
    workspaceId,
    threadId: thread._id,
  })
    .sort({ sentAt: 1 })
    .exec();

  thread.messageCount = messages.length;
  if (messages.length > 0) {
    thread.firstMessageAt = messages[0]?.sentAt || row.sentAt;
    thread.lastMessageAt = messages[messages.length - 1]?.sentAt || row.sentAt;
    
    // For meeting notes, also consider endTime if available
    if (channel === "meeting" && row.endTime) {
      const allDates = messages.map((m) => m.sentAt).filter(Boolean) as Date[];
      allDates.push(row.endTime);
      thread.lastMessageAt = new Date(Math.max(...allDates.map((d) => d.getTime())));
    }
  } else {
    thread.firstMessageAt = row.sentAt;
    thread.lastMessageAt = row.endTime || row.sentAt;
  }
  
  await thread.save();

  return { thread, message };
}

/**
 * Import conversation log from CSV buffer.
 */
export async function importConversationLogFromCsv(
  options: ImportConversationLogOptions
): Promise<ImportConversationLogResult | ImportConversationLogError> {
  const { workspaceId, userId, channel, csvBuffer } = options;

  const fileContent = csvBuffer.toString("utf8");

  let rows: Record<string, string>[];
  let csvHeaders: string[] = [];

  try {
    // Parse CSV with header detection
    const parsed = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    rows = parsed as Record<string, string>[];

    // Get headers from the first row keys, or from the CSV header row
    if (rows.length > 0 && rows[0]) {
      csvHeaders = Object.keys(rows[0]);
    } else {
      // If no rows, try to extract headers from the first line
      const firstLine = fileContent.split("\n")[0];
      if (firstLine) {
        csvHeaders = firstLine.split(",").map((h) => h.trim());
      }
    }
  } catch (err: any) {
    return {
      error: "Invalid CSV format",
      details: `Failed to parse CSV: ${err?.message || "Unknown error"}`,
    };
  }

  // Validate headers
  const headerValidation = validateCsvHeaders(csvHeaders, channel);
  if (!headerValidation.valid) {
    const requiredHeaders = REQUIRED_HEADERS[channel];
    return {
      error: "Invalid CSV format",
      details: `Expected columns: ${requiredHeaders.join(", ")}. Missing: ${headerValidation.missingHeaders?.join(", ")}.`,
    };
  }

  let threadsCreated = 0;
  let messagesCreated = 0;
  const seenThreadKeys = new Set<string>();

  for (const row of rows) {
    const normalized = mapRowToMessageInput(row, channel);
    if (!normalized) {
      continue; // Skip invalid rows
    }

    const { thread } = await upsertThreadAndMessage(
      workspaceId,
      userId,
      channel,
      normalized
    );

    messagesCreated += 1;

    if (!seenThreadKeys.has(normalized.threadKey)) {
      seenThreadKeys.add(normalized.threadKey);
      threadsCreated += 1;
    }
  }

  // Check if we imported any data
  if (threadsCreated === 0 && messagesCreated === 0) {
    return {
      error: "No valid rows",
      details: "CSV was parsed but no rows could be imported for this channel. Check column names, required fields, and data types.",
    };
  }

  return {
    threadsCreated,
    messagesCreated,
  };
}

