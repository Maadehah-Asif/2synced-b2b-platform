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
      bodyText,
      direction,
      sentAt,
      sender,
    } = req.body || {};

    if (!channel || !subject || !bodyText || !direction || !sentAt || !sender) {
      return res.status(400).json({
        error: "Missing required fields for manual log.",
      });
    }

    const result = await manualLogConversation({
      workspaceId,
      leadId,
      dealId,
      channel,
      subject,
      bodyText,
      direction,
      sentAt,
      sender,
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

    return res.status(200).json(result);
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
