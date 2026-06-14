/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: importService.ts
 * Purpose: Supports the i mp or tS er vi ce flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { Types } from "mongoose";

import ConversationImport, {
  type ConversationImportDocument,
} from "./models/ConversationImport.js";
import ConversationThread, {
  type ConversationThreadDocument,
  type ConversationChannel,
} from "./models/ConversationThreads.js";
import ConversationMessage, {
  type ConversationMessageDocument,
} from "./models/ConversationMessage.js";
import UploadFile from "../m01/models/UploadFile.js";
import { resolveOrCreateCompanyForInput } from "./utils/companyResolver.js";

/**
 * Params for starting an import from an existing UploadFile
 */
export interface StartConversationImportParams {
  workspaceId: string;
  uploadFileId: string;
  mappingTemplateId?: string;
  createdBy: string;
}

export interface StartConversationImportResult {
  conversationImport: ConversationImportDocument;
}

/**
 * Params for processing an existing ConversationImport
 */
export interface ProcessConversationImportParams {
  importId: string;
  requestedByUserId: string;
}

export interface ProcessConversationImportResult {
  conversationImport: ConversationImportDocument;
  createdThreads: number;
  createdMessages: number;
  skippedRows: number;
}

// -----------------------------------------------------------------------------
// Start import
// -----------------------------------------------------------------------------

export async function startConversationImport(
  params: StartConversationImportParams
): Promise<StartConversationImportResult> {
  const { workspaceId, uploadFileId, mappingTemplateId, createdBy } = params;

  const wsId = new Types.ObjectId(workspaceId);
  const fileId = new Types.ObjectId(uploadFileId);
  const userId = new Types.ObjectId(createdBy);

  const upload = await UploadFile.findOne({
    _id: fileId,
    workspace: wsId, // Module 1 uses 'workspace' field
  }).exec();

  if (!upload) {
    throw new Error("Upload file not found in this workspace.");
  }

  const conversationImport = await ConversationImport.create({
    workspaceId: wsId,
    uploadFileId: upload._id,
    mappingTemplateId: mappingTemplateId
      ? new Types.ObjectId(mappingTemplateId)
      : undefined,
    status: "pending",
    summary: {
      totalRows: 0,
      createdThreads: 0,
      createdMessages: 0,
      skippedRows: 0,
    },
    errorMessage: undefined,
    createdBy: userId,
  });

  return { conversationImport };
}

// -----------------------------------------------------------------------------
// Process import
// -----------------------------------------------------------------------------

/**
 * NOTE on expected CSV columns:
 *
 * This implementation assumes the CSV has (at least) the following headers:
 *  - thread_subject
 *  - channel                (email | whatsapp | call | meeting | note | other)
 *  - direction              (inbound | outbound)
 *  - sent_at                (ISO date string)
 *  - sender_name
 *  - sender_email
 *  - sender_role            (prospect | rep | other)
 *  - body_text
 *
 * You can adjust the column names in `mapRowToMessageInput` to match your actual files.
 */

interface NormalizedRow {
  threadSubject: string;
  channel: ConversationChannel;
  direction: "inbound" | "outbound";
  sentAt: Date;
  sender: {
    name: string;
    email?: string;
    role: "prospect" | "rep" | "other";
  };
  bodyText: string;
  company?: string; // Company name from CSV
  prospectEmail?: string; // Prospect email for company resolution
}

function mapRowToMessageInput(row: Record<string, string>): NormalizedRow | null {
  const subject = (row["thread_subject"] || "").trim();
  const channelRaw = (row["channel"] || "").toLowerCase();
  const directionRaw = (row["direction"] || "").toLowerCase();
  const sentAtStr = row["sent_at"] || "";
  const senderName = (row["sender_name"] || "").trim();
  const senderEmail = (row["sender_email"] || "").trim();
  const senderRoleRaw = (row["sender_role"] || "").toLowerCase();
  const bodyText = (row["body_text"] || "").toString();
  const company = (row["company"] || row["company_name"] || row["account"] || "").trim();
  const toEmail = (row["to_email"] || "").trim();

  if (!subject || !channelRaw || !directionRaw || !sentAtStr || !senderName) {
    return null; // skip incomplete row
  }

  const channel = (["email", "whatsapp", "call", "meeting", "note", "other"] as ConversationChannel[]).includes(
    channelRaw as ConversationChannel
  )
    ? (channelRaw as ConversationChannel)
    : "other";

  const direction =
    directionRaw === "inbound" || directionRaw === "outbound"
      ? (directionRaw as "inbound" | "outbound")
      : "inbound";

  const sentAt = new Date(sentAtStr);
  if (Number.isNaN(sentAt.getTime())) {
    return null;
  }

  let role: "prospect" | "rep" | "other" = "other";
  if (senderRoleRaw === "prospect") role = "prospect";
  else if (senderRoleRaw === "rep" || senderRoleRaw === "sales") role = "rep";

  const senderObj: {
    name: string;
    email?: string;
    role: "prospect" | "rep" | "other";
  } = {
    name: senderName,
    role,
  };
  if (senderEmail) {
    senderObj.email = senderEmail;
  }

  // Determine prospect email for company resolution
  let prospectEmail: string | undefined = undefined;
  if (channel === "email") {
    if (direction === "inbound") {
      prospectEmail = senderEmail || undefined;
    } else if (direction === "outbound") {
      prospectEmail = toEmail || undefined;
    }
  }

  const result: NormalizedRow = {
    threadSubject: subject,
    channel,
    direction,
    sentAt,
    sender: senderObj,
    bodyText,
  };
  
  if (company) {
    result.company = company;
  }
  if (prospectEmail) {
    result.prospectEmail = prospectEmail;
  }
  
  return result;
}

async function upsertThreadAndMessage(
  workspaceId: Types.ObjectId,
  input: NormalizedRow
): Promise<{ thread: ConversationThreadDocument; message: ConversationMessageDocument }> {
  const { threadSubject, channel, sentAt, sender, bodyText, direction, company, prospectEmail } = input;

  // Resolve or create company
  const companyDoc = await resolveOrCreateCompanyForInput(
    workspaceId,
    company || null,
    prospectEmail || null
  );

  const query: any = {
    workspaceId,
    companyId: companyDoc._id,
    subject: threadSubject,
    source: "upload",
  };

  let thread = await ConversationThread.findOne(query).exec();

  if (!thread) {
    thread = await ConversationThread.create({
      workspaceId,
      companyId: companyDoc._id,
      channel,
      subject: threadSubject,
      participants: [],
      messageCount: 0,
      source: "upload",
    });
  }

  const message = await ConversationMessage.create({
    workspaceId,
    threadId: thread._id,
    direction,
    sender,
    sentAt,
    subject: threadSubject,
    bodyText,
    channel,
    meta: {
      importSource: "m03_upload",
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

export async function processConversationImport(
  params: ProcessConversationImportParams
): Promise<ProcessConversationImportResult> {
  const { importId, requestedByUserId } = params;

  const impId = new Types.ObjectId(importId);
  const userId = new Types.ObjectId(requestedByUserId);

  const conversationImport = await ConversationImport.findById(impId).exec();
  if (!conversationImport) {
    throw new Error("Conversation import not found.");
  }

  const workspaceId = conversationImport.workspaceId as Types.ObjectId;

  // Optionally: check that requestedByUserId has rights (admin role).
  // That should be done at controller level.

  const upload = await UploadFile.findOne({
    _id: conversationImport.uploadFileId,
    workspace: workspaceId, // Module 1 uses 'workspace' field
  }).exec();

  if (!upload) {
    conversationImport.status = "failed";
    conversationImport.errorMessage = "Upload file missing or not in workspace.";
    await conversationImport.save();
    throw new Error("Upload file missing or not in workspace.");
  }

  // UploadFile stores fileId (GridFS reference).
  // For now, we'll assume the CSV file is accessible via the upload metadata.
  // In production, you'd retrieve from GridFS using the fileId.
  if (!upload.metadata?.filePath) {
    conversationImport.status = "failed";
    conversationImport.errorMessage = "Stored upload file path not found.";
    await conversationImport.save();
    throw new Error("Stored upload file path not found.");
  }

  const storagePath: string = upload.metadata.filePath;

  if (!storagePath || !fs.existsSync(storagePath)) {
    conversationImport.status = "failed";
    conversationImport.errorMessage = "Stored upload file path not found.";
    await conversationImport.save();
    throw new Error("Stored upload file path not found.");
  }

  conversationImport.status = "processing";
  conversationImport.set({ errorMessage: undefined });
  await conversationImport.save();

  let createdThreads = 0;
  let createdMessages = 0;
  let skippedRows = 0;
  let totalRows = 0;

  try {
    const fileContent = fs.readFileSync(storagePath, "utf8");

    const rows: Record<string, string>[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    totalRows = rows.length;

    const seenThreadIds = new Set<string>();

    for (const row of rows) {
      const normalized = mapRowToMessageInput(row);
      if (!normalized) {
        skippedRows += 1;
        continue;
      }

      const { thread, message } = await upsertThreadAndMessage(
        workspaceId,
        normalized
      );

      createdMessages += 1;
      if (!seenThreadIds.has(thread._id.toString())) {
        seenThreadIds.add(thread._id.toString());
        createdThreads += 1;
      }
    }

    conversationImport.status = "done";
    conversationImport.summary = {
      totalRows,
      createdThreads,
      createdMessages,
      skippedRows,
    };
    conversationImport.set({ errorMessage: undefined });
    await conversationImport.save();

    return {
      conversationImport,
      createdThreads,
      createdMessages,
      skippedRows,
    };
  } catch (err: any) {
    conversationImport.status = "failed";
    conversationImport.errorMessage = err?.message || "Failed to process import.";
    await conversationImport.save();
    throw err;
  }
}
