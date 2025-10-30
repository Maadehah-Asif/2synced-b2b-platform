import { Router } from "express";
import { createWorkspace, joinWorkspace, listWorkspaces, listJoinRequests, approveRequest, rejectRequest, listMembers, updateMemberRole } from "./controllers.js";

const router = Router();

router.post("/create", createWorkspace);
router.post("/join", joinWorkspace);
router.get("/", listWorkspaces);
router.get("/:id/requests", listJoinRequests);
router.post("/:id/requests/:memberId/approve", approveRequest);
router.post("/:id/requests/:memberId/reject", rejectRequest);
router.get("/:id/members", listMembers);
router.post("/:id/members/:memberId/role", updateMemberRole);

export default router;
