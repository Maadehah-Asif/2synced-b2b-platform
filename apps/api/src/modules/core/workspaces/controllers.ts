import type { Request, Response } from "express";
import { Workspace } from "../auth/models/Workspace.js";
import { WorkspaceMember } from "../auth/models/WorkspaceMember.js";
import { User } from "../auth/models/User.js";
import { verifyToken } from "../auth/utils/jwt.js";
import { validateWorkspaceName } from "../utils/validation.js";

function getUserIdFromReq(req: Request) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload.sub;
}

const ADMIN_ROLES = ["head_manager", "sales_manager", "marketing_manager"] as const;

function isManagerRole(role: string | undefined) {
  return role === "head_manager" || role === "sales_manager" || role === "marketing_manager";
}

async function ensureManagerExistsForTeamRole(workspaceId: string, role: string | undefined) {
  if (role === "sales_team_member") {
    const sm = await WorkspaceMember.findOne({ workspaceId, role: "sales_manager", status: "active" }).exec();
    if (!sm) return "sales_manager_required";
  }
  if (role === "marketing_team_member") {
    const mm = await WorkspaceMember.findOne({ workspaceId, role: "marketing_manager", status: "active" }).exec();
    if (!mm) return "marketing_manager_required";
  }
  return null;
}

export async function createWorkspace(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });

    const { name } = req.body || {};
    const nameError = typeof name === "string" ? validateWorkspaceName(name) : "Workspace name is required.";
    if (nameError) return res.status(400).json({ error: nameError });
    const n = name.trim();

    const existing = await Workspace.findOne({ ownerUserId: userId, name: n }).exec();
    if (existing) return res.status(409).json({ error: "You already have a workspace with this name. Please choose a different name." });

  // create workspace with a shareable ID
  const workspace = await Workspace.create({ name: n, ownerUserId: userId, status: "active" });
  // creator is the head manager for the workspace
  await WorkspaceMember.create({ workspaceId: workspace._id, userId, role: "head_manager", status: "active" });

    return res.status(201).json({ workspace: { id: String(workspace._id), name: workspace.name, status: workspace.status, shareId: workspace.shareId } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[workspaces/create]", err);
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function joinWorkspace(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const { workspaceId } = req.body || {};
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    // allow either Mongo _id (24hex) or shareId
    let workspace = null as any;
    if (/^[0-9a-fA-F]{24}$/.test(workspaceId)) {
      workspace = await Workspace.findById(workspaceId).exec();
    }
    if (!workspace) {
      workspace = await Workspace.findOne({ shareId: workspaceId }).exec();
    }
    if (!workspace) return res.status(404).json({ error: "workspace_not_found" });

    const existingMember = await WorkspaceMember.findOne({ workspaceId: workspace._id, userId }).exec();
    if (existingMember) return res.status(200).json({ message: existingMember.status === 'pending' ? 'request_pending' : 'already_member' });

    // default join requests are created as sales team members (pending approval)
    const member = await WorkspaceMember.create({ workspaceId: workspace._id, userId, role: "sales_team_member", status: "pending" });
    return res.status(201).json({ message: 'request_submitted', member: { id: String(member._id), role: member.role, workspaceId: String(workspace._id) } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[workspaces/join]", err);
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function listWorkspaces(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
  const memberships = (await WorkspaceMember.find({ userId, status: 'active' }).exec()) as any[];
  const ids = memberships.map((m: any) => m.workspaceId);
  const workspaces = await Workspace.find({ _id: { $in: ids } }).exec();
  return res.json({ workspaces: workspaces.map((w: any) => ({ id: String(w._id), name: w.name, status: w.status, shareId: (w as any).shareId })) });
  } catch (err) {
    console.error('[workspaces/list]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function listJoinRequests(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const workspaceId = req.params.id;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    // only managers can approve/reject and view join requests
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });
  // include requester user info (email, fullName) to help admins decide
    const requests = await WorkspaceMember.find({ workspaceId, status: 'pending' }).populate({ path: 'userId', select: 'email fullName' }).exec();
    return res.json({ requests: requests.map((r: any) => ({ id: String(r._id), userId: String(r.userId?._id || r.userId), role: r.role, user: r.userId ? { id: String(r.userId._id), email: r.userId.email, fullName: r.userId.fullName } : null })) });
  } catch (err) {
    console.error('[workspaces/requests]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function listMembers(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const workspaceId = req.params.id;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    const member = await WorkspaceMember.findOne({ workspaceId, userId, status: 'active' }).exec();
    if (!member) return res.status(403).json({ error: 'not_member' });
    const members = await WorkspaceMember.find({ workspaceId }).populate({ path: 'userId', select: 'email fullName' }).exec();
    return res.json({ members: members.map((m:any) => ({ id: String(m._id), role: m.role, status: m.status, user: m.userId ? { id: String(m.userId._id), email: m.userId.email, fullName: m.userId.fullName } : null })) });
  } catch (err) {
    console.error('[workspaces/members]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function updateMemberRole(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const { id: workspaceId, memberId } = req.params;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    if (!memberId) return res.status(400).json({ error: "memberId_required" });
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });
    const { role, status } = req.body || {};
    const member = await WorkspaceMember.findOne({ _id: memberId, workspaceId }).exec();
    if (!member) return res.status(404).json({ error: 'member_not_found' });
    // Prevent admins from changing their own role to avoid accidental lockouts
    if (String(member.userId) === String(userId)) {
      return res.status(400).json({ error: 'cannot_edit_own_role' });
    }
    if (role) {
      // Only managers can assign roles; already enforced above.
      // Enforce single sales/marketing manager per workspace
      if (role === 'sales_manager' || role === 'marketing_manager') {
        const existingManager = await WorkspaceMember.findOne({
          workspaceId,
          role,
          status: 'active',
          _id: { $ne: memberId },
        }).exec();
        if (existingManager) {
          return res.status(409).json({ error: `${role}_already_assigned` });
        }
      }

      const managerRequirementError = await ensureManagerExistsForTeamRole(workspaceId, role);
      if (managerRequirementError) {
        return res.status(400).json({ error: managerRequirementError });
      }

      member.role = role;
    }
    if (status) member.status = status;
    await member.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[workspaces/updateMember]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function approveRequest(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const { id: workspaceId, memberId } = req.params;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    if (!memberId) return res.status(400).json({ error: "memberId_required" });
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });
    const member = await WorkspaceMember.findOne({ _id: memberId, workspaceId }).exec();
    if (!member) return res.status(404).json({ error: 'member_not_found' });

    const managerRequirementError = await ensureManagerExistsForTeamRole(workspaceId, member.role);
    if (managerRequirementError) {
      return res.status(400).json({ error: managerRequirementError });
    }

    member.status = 'active';
    await member.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[workspaces/approve]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function rejectRequest(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "missing_token" });
    const { id: workspaceId, memberId } = req.params;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId_required" });
    if (!memberId) return res.status(400).json({ error: "memberId_required" });
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });
    const member = await WorkspaceMember.findOne({ _id: memberId, workspaceId }).exec();
    if (!member) return res.status(404).json({ error: 'member_not_found' });
    member.status = 'rejected';
    await member.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[workspaces/reject]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function inviteByEmail(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'missing_token' });
    const workspaceId = req.params.id;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId_required' });
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });

    const { email, role } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email_required' });
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const existingMember = await WorkspaceMember.findOne({ workspaceId, userId: user._id }).exec();
    if (existingMember) {
      return res.status(200).json({
        message: existingMember.status === 'pending' ? 'request_pending' : 'already_member',
      });
    }

    let targetRole = role || 'sales_team_member';

    if (targetRole === 'sales_manager' || targetRole === 'marketing_manager') {
      const existingManager = await WorkspaceMember.findOne({ workspaceId, role: targetRole, status: 'active' }).exec();
      if (existingManager) {
        return res.status(409).json({ error: `${targetRole}_already_assigned` });
      }
    }

    const managerRequirementError = await ensureManagerExistsForTeamRole(workspaceId, targetRole);
    if (managerRequirementError) {
      return res.status(400).json({ error: managerRequirementError });
    }

    const member = await WorkspaceMember.create({ workspaceId, userId: user._id, role: targetRole, status: 'pending' });
    return res.status(201).json({
      message: 'invited',
      member: { id: String(member._id), workspaceId: String(member.workspaceId), role: member.role, status: member.status },
    });
  } catch (err) {
    console.error('[workspaces/inviteByEmail]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function removeMember(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'missing_token' });
    const { id: workspaceId, memberId } = req.params;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId_required' });
    if (!memberId) return res.status(400).json({ error: 'memberId_required' });
    const admin = await WorkspaceMember.findOne({ workspaceId, userId, role: { $in: ADMIN_ROLES }, status: 'active' }).exec();
    if (!admin) return res.status(403).json({ error: 'not_admin' });

    const member = await WorkspaceMember.findOne({ _id: memberId, workspaceId }).exec();
    if (!member) return res.status(404).json({ error: 'member_not_found' });
    if (String(member.userId) === String(userId)) {
      return res.status(400).json({ error: 'cannot_remove_self' });
    }

    await WorkspaceMember.deleteOne({ _id: memberId, workspaceId }).exec();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[workspaces/removeMember]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
