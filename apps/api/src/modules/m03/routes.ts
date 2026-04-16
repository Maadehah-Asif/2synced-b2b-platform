import { Router } from "express";
import multer from "multer";
import {
  manualLogConversationController,
  startConversationImportController,
  processConversationImportController,
  listConversationImportsController,
  runConversationImportController,
  uploadConversationLogController,
  listConversationsController,
  getConversationDetailController,
  runFullAnalysisController,
  listFollowUpsController,
  updateFollowUpController,
  markFollowUpDoneController,
  snoozeFollowUpController,
  conversationSummaryController,
  exportConversationsController,
  logCrmSyncController,
  updateSyncStatusController,
  getAnalyticsSummaryController,
  getDealHealthListController,
  listOrganisationsController,
  getOrgTimelineController,
  listCompaniesController,
  getLeadProfileController,
} from "./controllers.js";
import { attachOptionalUser } from "../core/auth/middleware.js";

const m03Router = Router();

// Attach optional user to requests when Authorization header is present
m03Router.use(attachOptionalUser);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to extract workspaceId from query params and set in req.user
m03Router.use((req: any, _res, next) => {
  if (req.user && !req.user.workspaceId) {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId) {
      req.user.workspaceId = workspaceId;
    }
  }
  next();
});

// -----------------------------------------------------------------------------
// Conversations: manual log
// -----------------------------------------------------------------------------

// POST /api/m03/conversations/manual-log
m03Router.post("/conversations/manual-log", manualLogConversationController);

// -----------------------------------------------------------------------------
// Conversation imports
// -----------------------------------------------------------------------------

// POST /api/m03/conversations/imports
m03Router.post(
  "/conversations/imports",
  startConversationImportController
);

// POST /api/m03/conversations/imports/:id/process
m03Router.post(
  "/conversations/imports/:id/process",
  processConversationImportController
);

// GET /api/m03/conversations/imports
m03Router.get(
  "/conversations/imports",
  listConversationImportsController
);

// POST /api/m03/conversation-import (simplified single endpoint)
m03Router.post(
  "/conversation-import",
  runConversationImportController
);

// POST /api/m03/upload-conversation-log (direct CSV upload)
m03Router.post(
  "/upload-conversation-log",
  upload.single("file"),
  uploadConversationLogController
);

// -----------------------------------------------------------------------------
// Conversation listing & detail
// -----------------------------------------------------------------------------

// GET /api/m03/conversations
m03Router.get("/conversations", listConversationsController);

// GET /api/m03/conversations/:id
m03Router.get("/conversations/:id", getConversationDetailController);

// -----------------------------------------------------------------------------
// Full analysis (entities + sentiment + deal health + follow-ups)
// -----------------------------------------------------------------------------

// POST /api/m03/conversations/:id/analyze
m03Router.post(
  "/conversations/:id/analyze",
  runFullAnalysisController
);

// -----------------------------------------------------------------------------
// Follow-ups
// -----------------------------------------------------------------------------

// GET /api/m03/followups
m03Router.get("/followups", listFollowUpsController);

// PATCH /api/m03/followups/:id
m03Router.patch("/followups/:id", updateFollowUpController);

// POST /api/m03/followups/:id/mark-done
m03Router.post("/followups/:id/mark-done", markFollowUpDoneController);

// POST /api/m03/followups/:id/snooze
m03Router.post("/followups/:id/snooze", snoozeFollowUpController);

// -----------------------------------------------------------------------------
// Dashboard summary
// -----------------------------------------------------------------------------

// GET /api/m03/dashboard/summary
m03Router.get(
  "/dashboard/summary",
  conversationSummaryController
);

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------

// GET /api/m03/analytics/summary
m03Router.get("/analytics/summary", getAnalyticsSummaryController);

// -----------------------------------------------------------------------------
// Deal health list
// -----------------------------------------------------------------------------

// GET /api/m03/deal-health
m03Router.get("/deal-health", getDealHealthListController);

// -----------------------------------------------------------------------------
// Export conversations
// -----------------------------------------------------------------------------

// GET /api/m03/conversations/export
m03Router.get(
  "/conversations/export",
  exportConversationsController
);

// -----------------------------------------------------------------------------
// CRM sync logging
// -----------------------------------------------------------------------------

// POST /api/m03/conversations/:id/sync-crm
m03Router.post(
  "/conversations/:id/sync-crm",
  logCrmSyncController
);

// PATCH /api/m03/sync-logs/:id/status   (optional, for future use)
m03Router.patch(
  "/sync-logs/:id/status",
  updateSyncStatusController
);

// -----------------------------------------------------------------------------
// Organisation timeline
// -----------------------------------------------------------------------------

// GET /api/m03/orgs
m03Router.get("/orgs", listOrganisationsController);

// GET /api/m03/orgs/:orgId/timeline
m03Router.get("/orgs/:orgId/timeline", getOrgTimelineController);

// -----------------------------------------------------------------------------
// Companies list
// -----------------------------------------------------------------------------

// GET /api/m03/companies
m03Router.get("/companies", listCompaniesController);

// -----------------------------------------------------------------------------
// Lead profile
// -----------------------------------------------------------------------------

// GET /api/m03/leads/:leadId/profile
m03Router.get("/leads/:leadId/profile", getLeadProfileController);

export default m03Router;
