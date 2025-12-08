import { Router } from "express";
import {
  manualLogConversationController,
  startConversationImportController,
  processConversationImportController,
  listConversationImportsController,
  listConversationsController,
  getConversationDetailController,
  runFullAnalysisController,
  listFollowUpsController,
  updateFollowUpController,
  conversationSummaryController,
  exportConversationsController,
  logCrmSyncController,
  updateSyncStatusController,
} from "./controllers.js";

const m03Router = Router();

// NOTE: In your main app, make sure your auth middleware
// (that populates req.user) is applied before these routes,
// e.g. app.use("/api", requireAuth, apiRouter);

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

// -----------------------------------------------------------------------------
// Dashboard summary
// -----------------------------------------------------------------------------

// GET /api/m03/dashboard/summary
m03Router.get(
  "/dashboard/summary",
  conversationSummaryController
);

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

export default m03Router;
