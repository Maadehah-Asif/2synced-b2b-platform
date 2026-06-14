/**
 * Module: Conversation Intelligence (m03)
 * Layer: Backend
 * File: controllers.ts
 * Purpose: Supports the c on tr ol le rs flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

import {
  manualLogConversation,
  listConversations,
  getConversationDetail,
  exportConversations,
} from "./conversationService.js";
import {
  startConversationImport,
  processConversationImport,
} from "./importService.js";
import ConversationImport from "./models/ConversationImport.js";
import { runFullAnalysis } from "./analysisService.js";
import { listFollowUps, updateFollowUp } from "./followUpService.js";
import { getConversationSummary } from "./dashboardService.js";
import {
  logConversationSync,
  updateSyncStatus,
} from "./crmSyncService.js";
import FollowUpReminder from "./models/FollowUpReminder.js";
import { buildAnalyticsSummaryForWorkspace } from "./analyticsService.js";
import { listDealHealth } from "./services/dealHealthListService.js";
import { importConversationLogFromCsv } from "./services/conversationImportService.js";
import {
  listOrganisationsWithActivity,
  getOrgTimeline,
} from "./services/orgTimelineService.js";
import { listCompaniesWithActivity } from "./services/companyListService.js";

// -----------------------------------------------------------------------------
// Auth request type helpers
// -----------------------------------------------------------------------------

interface AuthUser {
  id: string;
  workspaceId: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function requireAuthContext(req: AuthenticatedRequest): asserts req is AuthenticatedRequest & { user: AuthUser } {
  if (!req.user || !req.user.id || !req.user.workspaceId) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

function getWorkspaceIdFromRequest(req: AuthenticatedRequest): string {
  requireAuthContext(req);
  return req.user.workspaceId;
}

function getUserIdFromRequest(req: AuthenticatedRequest): string {
  requireAuthContext(req);
  return req.user.id;
}

// -----------------------------------------------------------------------------
// Conversations: manual log
// -----------------------------------------------------------------------------

export async function manualLogConversationController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const {
      leadId,
      dealId,
      channel,
      subject,
      body, // New unified field
      bodyText, // Legacy field
      direction,
      occurredAt, // New unified field
      sentAt, // Legacy field
      sender, // Legacy format
      // Channel-specific fields
      contactName,
      contactEmail,
      contactPhone,
      toEmails,
      participants,
      endTime,
      companyName, // New: company name from frontend
    } = req.body || {};

    // Validate required fields
    if (!channel || !subject) {
      return res.status(400).json({
        error: "Channel and subject are required.",
      });
    }

    // Body can come from either 'body' or 'bodyText'
    const bodyContent = body || bodyText;
    if (!bodyContent) {
      return res.status(400).json({
        error: "Message body is required.",
      });
    }

    // For channels that require direction, validate it
    if (channel !== "note" && !direction) {
      return res.status(400).json({
        error: "Direction is required for this channel.",
      });
    }

    // Timestamp can come from either 'occurredAt' or 'sentAt'
    const timestamp = occurredAt || sentAt;
    if (!timestamp) {
      return res.status(400).json({
        error: "Timestamp (occurredAt or sentAt) is required.",
      });
    }

    // Extract prospect email based on channel and direction
    let prospectEmail: string | null = null;
    if (channel === "email") {
      if (direction === "inbound") {
        prospectEmail = contactEmail || null;
      } else if (direction === "outbound" && toEmails && Array.isArray(toEmails) && toEmails.length > 0) {
        // For outbound, use first to email as prospect
        prospectEmail = toEmails[0] || null;
      }
    }

    const result = await manualLogConversation({
      workspaceId,
      leadId,
      dealId,
      channel,
      subject,
      body: bodyContent,
      bodyText: bodyContent, // For backward compatibility
      direction: direction || "outbound",
      occurredAt: timestamp,
      sentAt: timestamp, // For backward compatibility
      sender, // Legacy format
      contactName,
      contactEmail,
      contactPhone,
      toEmails,
      participants,
      endTime,
      companyName, // Pass company name
      prospectEmail, // Pass prospect email for company resolution
      createdBy: userId,
    });

    return res.status(201).json({
      thread: result.thread,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Conversation imports
// -----------------------------------------------------------------------------

export async function startConversationImportController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const { uploadFileId, mappingTemplateId } = req.body || {};
    if (!uploadFileId) {
      return res.status(400).json({
        error: "uploadFileId is required.",
      });
    }

    const { conversationImport } = await startConversationImport({
      workspaceId,
      uploadFileId,
      mappingTemplateId,
      createdBy: userId,
    });

    return res.status(201).json({ conversationImport });
  } catch (err) {
    next(err);
  }
}

export async function processConversationImportController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Import ID is required." });
    }

    // Safety: ensure import belongs to this workspace
    const imp = await ConversationImport.findOne({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).lean();

    if (!imp) {
      return res.status(404).json({ error: "Conversation import not found." });
    }

    const result = await processConversationImport({
      importId: id,
      requestedByUserId: userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listConversationImportsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const imports = await ConversationImport.find({
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    return res.status(200).json({ imports });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Simplified conversation import (single endpoint)
// -----------------------------------------------------------------------------

export async function runConversationImportController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const { uploadFileId } = req.body || {};
    if (!uploadFileId) {
      return res.status(400).json({
        error: "uploadFileId is required.",
      });
    }

    // Validate that the upload file belongs to this workspace
    // Note: Module 1 uses 'workspace' field, not 'workspaceId'
    const UploadFile = (await import("../m01/models/UploadFile.js")).default;
    const upload = await UploadFile.findOne({
      _id: new Types.ObjectId(uploadFileId),
      workspace: new Types.ObjectId(workspaceId),
    }).exec();

    if (!upload) {
      return res.status(404).json({
        error: "Upload file not found or does not belong to this workspace.",
      });
    }

    // Start the import
    const { conversationImport } = await startConversationImport({
      workspaceId,
      uploadFileId,
      createdBy: userId,
    });

    // Process the import immediately
    const result = await processConversationImport({
      importId: conversationImport._id.toString(),
      requestedByUserId: userId,
    });

    return res.status(200).json({
      status: "ok",
      threadsCreated: result.createdThreads,
      messagesCreated: result.createdMessages,
    });
  } catch (err: any) {
    console.error("Error in runConversationImportController", err);
    return res.status(500).json({
      error: err?.message || "Failed to run conversation import.",
    });
  }
}

// -----------------------------------------------------------------------------
// Conversation listing & detail
// -----------------------------------------------------------------------------

export async function listConversationsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const {
      page,
      pageSize,
      search,
      channel,
      band,
      leadId,
      dealId,
      companyId, // New: filter by company ID
    } = req.query as Record<string, string | undefined>;

    const result = await listConversations({
      workspaceId,
      page: page ? parseInt(page, 10) || 1 : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) || 20 : 20,
      ...(search && { search }),
      channel: channel as any,
      band: band as any,
      ...(leadId && { leadId }),
      ...(dealId && { dealId }),
      ...(companyId && { companyId }), // Pass companyId filter
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getConversationDetailController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation id is required." });
    }

    const detail = await getConversationDetail(workspaceId, id);
    if (!detail) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    return res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Full analysis (entities + sentiment + deal health + follow-ups)
// -----------------------------------------------------------------------------

export async function runFullAnalysisController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation id is required." });
    }

    const result = await runFullAnalysis({
      workspaceId,
      threadId: id,
      userId,
    });

    // Include deal health summary in response
    return res.status(200).json({
      ...result,
      dealHealth: result.dealHealth
        ? {
            score: result.dealHealth.score,
            band: result.dealHealth.band,
            reasons: result.dealHealth.reasons,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Follow-ups
// -----------------------------------------------------------------------------

export async function listFollowUpsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const {
      assigneeId,
      status,
      overdueOnly,
      page,
      pageSize,
      search,
    } = req.query as Record<string, string | undefined>;

    // By default, show only my follow-ups
    const effectiveAssigneeId = assigneeId || userId;

    const result = await listFollowUps({
      workspaceId,
      assigneeId: effectiveAssigneeId,
      status: status as any,
      overdueOnly: overdueOnly === "true",
      page: page ? parseInt(page, 10) || 1 : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) || 20 : 20,
      ...(search && { search }),
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateFollowUpController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Follow up id is required." });
    }

    // Check ownership: only assignee (or admin) can update
    const followUp = await FollowUpReminder.findOne({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();

    if (!followUp) {
      return res.status(404).json({ error: "Follow up not found." });
    }

    if (followUp.assigneeId.toString() !== userId) {
      // You can also allow admin roles here based on req.user.role
      return res.status(403).json({ error: "Not allowed to update this follow up." });
    }

    const { status, dueAt, snoozedUntil } = req.body || {};

    const updated = await updateFollowUp({
      workspaceId,
      followUpId: id,
      status,
      dueAt,
      snoozedUntil,
    });

    return res.status(200).json({ followUp: updated });
  } catch (err) {
    next(err);
  }
}

export async function markFollowUpDoneController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Follow up id is required." });
    }

    // Check ownership: only assignee (or admin) can update
    const followUp = await FollowUpReminder.findOne({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();

    if (!followUp) {
      return res.status(404).json({ error: "Follow up not found." });
    }

    if (followUp.assigneeId.toString() !== userId) {
      return res.status(403).json({ error: "Not allowed to update this follow up." });
    }

    const updated = await updateFollowUp({
      workspaceId,
      followUpId: id,
      status: "done",
    });

    return res.status(200).json({ followUp: updated });
  } catch (err) {
    next(err);
  }
}

export async function snoozeFollowUpController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Follow up id is required." });
    }

    // Check ownership: only assignee (or admin) can update
    const followUp = await FollowUpReminder.findOne({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();

    if (!followUp) {
      return res.status(404).json({ error: "Follow up not found." });
    }

    if (followUp.assigneeId.toString() !== userId) {
      return res.status(403).json({ error: "Not allowed to update this follow up." });
    }

    const { snoozedUntil } = req.body || {};
    if (!snoozedUntil) {
      return res.status(400).json({ error: "snoozedUntil is required." });
    }

    const updated = await updateFollowUp({
      workspaceId,
      followUpId: id,
      status: "snoozed",
      snoozedUntil: snoozedUntil,
    });

    return res.status(200).json({ followUp: updated });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Dashboard summary
// -----------------------------------------------------------------------------

export async function conversationSummaryController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const summary = await getConversationSummary(workspaceId);
    return res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Analytics summary
// -----------------------------------------------------------------------------

export async function getAnalyticsSummaryController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const channel =
      typeof req.query.channel === "string" ? req.query.channel : undefined;

    const opts = channel ? { channel } : undefined;
    const summary = await buildAnalyticsSummaryForWorkspace(workspaceId, opts);

    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("Error in getAnalyticsSummaryController", err);
    return res
      .status(500)
      .json({ error: "Failed to compute analytics summary." });
  }
}

// -----------------------------------------------------------------------------
// Upload conversation log (direct CSV upload)
// -----------------------------------------------------------------------------

export async function uploadConversationLogController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    // Get file from multer
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: "CSV file is required." });
    }

    // Get channel from form data
    const channel = (req.body?.channel || "").toLowerCase();
    if (!["email", "whatsapp", "call", "meeting"].includes(channel)) {
      return res.status(400).json({
        error: "Channel must be one of: email, whatsapp, call, meeting.",
      });
    }

    // Import the CSV
    const result = await importConversationLogFromCsv({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      channel: channel as "email" | "whatsapp" | "call" | "meeting",
      csvBuffer: file.buffer,
    });

    // Check if result is an error
    if ("error" in result) {
      return res.status(400).json({
        error: result.error,
        details: result.details,
      });
    }

    return res.status(200).json({
      status: "ok",
      message: `Conversation import started. Created ${result.threadsCreated} threads and ${result.messagesCreated} messages.`,
      channel,
      threadsCreated: result.threadsCreated,
      messagesCreated: result.messagesCreated,
    });
  } catch (err: any) {
    console.error("Error in uploadConversationLogController", err);
    return res.status(500).json({
      error: err?.message || "Failed to upload conversation log.",
    });
  }
}

// -----------------------------------------------------------------------------
// Deal health list
// -----------------------------------------------------------------------------

export async function getDealHealthListController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const {
      page,
      pageSize,
      band,
      dealId,
      sortBy,
      sortOrder,
    } = req.query as Record<string, string | undefined>;

    const opts: Parameters<typeof listDealHealth>[1] = {
      page: page ? parseInt(page, 10) || 1 : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) || 20 : 20,
    };
    if (band) {
      // Handle backward compatibility: "neutral" and "monitor" map to "steady"
      const normalizedBand = band === "neutral" || band === "monitor" ? "steady" : band;
      opts.band = normalizedBand as "healthy" | "steady" | "at_risk";
    }
    if (dealId) {
      opts.dealId = dealId;
    }
    if (sortBy) {
      opts.sortBy = sortBy as "score" | "lastMessageAt" | "lastAnalyzedAt";
    }
    if (sortOrder) {
      opts.sortOrder = sortOrder as "asc" | "desc";
    }

    const result = await listDealHealth(workspaceId, opts);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in getDealHealthListController", err);
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Export conversations
// -----------------------------------------------------------------------------

export async function exportConversationsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const {
      channel,
      band,
      leadId,
      dealId,
      limit,
    } = req.query as Record<string, string | undefined>;

    const rows = await exportConversations({
      workspaceId,
      channel: channel as any,
      band: band as any,
      ...(leadId && { leadId }),
      ...(dealId && { dealId }),
      limit: limit ? parseInt(limit, 10) || 1000 : 1000,
    });

    return res.status(200).json({ rows });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// CRM sync logging
// -----------------------------------------------------------------------------

export async function logCrmSyncController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation id is required." });
    }

    const { dealId, payload } = req.body || {};
    if (!payload) {
      return res.status(400).json({ error: "payload is required." });
    }

    const { syncLog } = await logConversationSync({
      workspaceId,
      threadId: id,
      dealId,
      payload,
      createdBy: userId,
    });

    return res.status(201).json({ syncLog });
  } catch (err) {
    next(err);
  }
}

// Optional: if you later have an endpoint to update sync status
export async function updateSyncStatusController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { status, errorMessage } = req.body || {};

    if (!id || !status) {
      return res
        .status(400)
        .json({ error: "syncLog id and status are required." });
    }

    const updated = await updateSyncStatus({
      syncLogId: id,
      status,
      errorMessage,
    });

    if (!updated) {
      return res.status(404).json({ error: "Sync log not found." });
    }

    return res.status(200).json({ syncLog: updated });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// Organisation timeline
// -----------------------------------------------------------------------------

/**
 * List all organisations (companies) with conversation activity.
 * GET /m03/orgs
 */
export async function listOrganisationsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const orgs = await listOrganisationsWithActivity(workspaceId);

    return res.status(200).json({ orgs });
  } catch (err) {
    console.error("Error in listOrganisationsController", err);
    next(err);
  }
}

/**
 * Get timeline events for a specific organisation.
 * GET /m03/orgs/:orgId/timeline?days=90
 */
export async function getOrgTimelineController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);
    const { orgId } = req.params;
    const days = req.query.days
      ? parseInt(req.query.days as string, 10) || 90
      : 90;

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required." });
    }

    const timeline = await getOrgTimeline(workspaceId, orgId, days);

    if (!timeline) {
      return res.status(404).json({ error: "Organisation not found." });
    }

    return res.status(200).json(timeline);
  } catch (err) {
    console.error("Error in getOrgTimelineController", err);
    next(err);
  }
}

/**
 * List all companies with conversation activity.
 * GET /m03/companies
 */
export async function listCompaniesController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceIdFromRequest(req);

    const companies = await listCompaniesWithActivity(workspaceId);

    return res.status(200).json({ companies });
  } catch (err) {
    console.error("Error in listCompaniesController", err);
    next(err);
  }
}
