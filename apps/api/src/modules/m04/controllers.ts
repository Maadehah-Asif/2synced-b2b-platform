/**
 * Module: Guided Assistant (m04)
 * Layer: Backend
 * File: controllers.ts
 * Purpose: Supports the c on tr ol le rs flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import type { Request, Response } from "express";
import mongoose from "mongoose";
import { verifyToken } from "../core/auth/utils/jwt.js";
import { WorkspaceMember } from "../core/auth/models/WorkspaceMember.js";
import { User } from "../core/auth/models/User.js";
import GuidedAssistantConversation from "./models/GuidedAssistantConversation.js";
import { findFaqById, getAssistantPageConfig, matchFaqFromText } from "./faqCatalog.js";

const ADMIN_ROLES = new Set(["head_manager", "sales_manager", "marketing_manager"]);

function normalizeRole(role: string | null | undefined) {
  const value = (role || "").toString().trim().toLowerCase();
  if (value === "admin") return "head_manager";
  if (value === "manager") return "sales_manager";
  if (value === "member") return "sales_team_member";
  return value;
}

function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function getUserIdFromReq(req: Request) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

function getWorkspaceId(req: Request) {
  return (req.query.workspaceId as string)
    || (req.query.workspace as string)
    || (req.body?.workspaceId as string)
    || (req.body?.workspace as string)
    || null;
}

function serializeConversation(doc: any) {
  return {
    id: String(doc._id),
    workspaceId: String(doc.workspaceId),
    userId: String(doc.userId),
    pageKey: doc.pageKey,
    hasPendingAdminReply: !!doc.hasPendingAdminReply,
    needsAdminForward: !!doc.needsAdminForward,
    messages: (doc.messages || []).map((message: any) => ({
      id: String(message._id),
      sender: message.sender,
      kind: message.kind,
      text: message.text,
      faqId: message.faqId || null,
      createdAt: message.createdAt,
    })),
  };
}

async function getMembershipRole(workspaceId: string, userId: string) {
  const member = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: "active",
  }).lean();
  return normalizeRole(member?.role || null);
}

async function ensureConversation(workspaceId: string, userId: string, pageKey: string) {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);
  const userOid = new mongoose.Types.ObjectId(userId);

  let conversation = await GuidedAssistantConversation.findOne({
    workspaceId: workspaceOid,
    userId: userOid,
    pageKey,
  }).exec();

  if (!conversation) {
    conversation = await GuidedAssistantConversation.create({
      workspaceId: workspaceOid,
      userId: userOid,
      pageKey,
      hasPendingAdminReply: false,
      needsAdminForward: false,
      messages: [],
    });
  }

  return conversation;
}

async function buildAdminInbox(workspaceId: string) {
  const items = await GuidedAssistantConversation.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    hasPendingAdminReply: true,
  })
    .populate({ path: "userId", select: "fullName email" })
    .sort({ updatedAt: -1 })
    .lean();

  return items.map((conversation: any) => {
    const lastQuestion = [...(conversation.messages || [])]
      .reverse()
      .find((message: any) => message.kind === "custom_question");

    return {
      id: String(conversation._id),
      pageKey: conversation.pageKey,
      updatedAt: conversation.updatedAt,
      question: lastQuestion?.text || "",
      requester: conversation.userId ? {
        id: String(conversation.userId._id || conversation.userId),
        fullName: conversation.userId.fullName || null,
        email: conversation.userId.email || null,
      } : null,
    };
  });
}

export async function bootstrapAssistant(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const pageKey = String(req.query.pageKey || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!pageKey) return res.status(400).json({ error: "pageKey_required" });

    const conversation = await ensureConversation(workspaceId, userId, pageKey);
    const role = await getMembershipRole(workspaceId, userId);
    const page = getAssistantPageConfig(pageKey);
    const adminInbox = isAdminRole(role) ? await buildAdminInbox(workspaceId) : [];

    return res.json({
      ok: true,
      page,
      role,
      isAdmin: isAdminRole(role),
      conversation: serializeConversation(conversation),
      adminInbox,
    });
  } catch (error) {
    console.error("[m04/bootstrapAssistant]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function sendFaqMessage(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const pageKey = String(req.body?.pageKey || "").trim();
    const faqId = String(req.body?.faqId || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!pageKey) return res.status(400).json({ error: "pageKey_required" });
    if (!faqId) return res.status(400).json({ error: "faqId_required" });

    const faq = findFaqById(pageKey, faqId);
    if (!faq) return res.status(404).json({ error: "faq_not_found" });

    const conversation = await ensureConversation(workspaceId, userId, pageKey);
    conversation.messages.push(
      { sender: "user", kind: "faq_question", text: faq.label, faqId, createdAt: new Date() } as any,
      { sender: "assistant", kind: "faq_answer", text: faq.answer, faqId, createdAt: new Date() } as any,
    );
    conversation.needsAdminForward = false;
    await conversation.save();

    return res.json({ ok: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/sendFaqMessage]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function submitCustomQuestion(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const pageKey = String(req.body?.pageKey || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!pageKey) return res.status(400).json({ error: "pageKey_required" });
    if (!text) return res.status(400).json({ error: "text_required" });

    const conversation = await ensureConversation(workspaceId, userId, pageKey);
    const matchedFaq = matchFaqFromText(pageKey, text);

    if (matchedFaq) {
      conversation.messages.push(
        { sender: "user", kind: "custom_question", text, faqId: matchedFaq.id, createdAt: new Date() } as any,
        { sender: "assistant", kind: "faq_answer", text: matchedFaq.answer, faqId: matchedFaq.id, createdAt: new Date() } as any,
      );
      conversation.hasPendingAdminReply = false;
      conversation.needsAdminForward = false;
      await conversation.save();

      return res.json({
        ok: true,
        matched: true,
        conversation: serializeConversation(conversation),
      });
    }

    conversation.messages.push({ sender: "user", kind: "custom_question", text, createdAt: new Date() } as any);
    conversation.messages.push({
      sender: "assistant",
      kind: "faq_answer",
      text: "I do not have a confident guided answer for that yet. If you want, I can forward this question to an admin so they can reply back here.",
      createdAt: new Date(),
    } as any);
    conversation.hasPendingAdminReply = false;
    conversation.needsAdminForward = true;
    await conversation.save();

    return res.json({ ok: true, matched: false, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/submitCustomQuestion]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function forwardQuestionToAdmin(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const conversationId = String(req.body?.conversationId || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!conversationId || !mongoose.isValidObjectId(conversationId)) return res.status(400).json({ error: "conversationId_required" });

    const conversation = await GuidedAssistantConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();

    if (!conversation) return res.status(404).json({ error: "conversation_not_found" });
    if (!conversation.needsAdminForward) {
      return res.status(400).json({ error: "no_pending_forward_request" });
    }

    conversation.messages.push({
      sender: "assistant",
      kind: "faq_answer",
      text: "Your question has been forwarded to an admin. You will see the reply here once someone responds.",
      createdAt: new Date(),
    } as any);
    conversation.needsAdminForward = false;
    conversation.hasPendingAdminReply = true;
    await conversation.save();

    return res.json({ ok: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/forwardQuestionToAdmin]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function dismissAdminForward(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const conversationId = String(req.body?.conversationId || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!conversationId || !mongoose.isValidObjectId(conversationId)) return res.status(400).json({ error: "conversationId_required" });

    const conversation = await GuidedAssistantConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();

    if (!conversation) return res.status(404).json({ error: "conversation_not_found" });

    conversation.messages.push({
      sender: "assistant",
      kind: "faq_answer",
      text: "No problem. Your question was not forwarded. You can keep using the guided options here, or ask another question.",
      createdAt: new Date(),
    } as any);
    conversation.needsAdminForward = false;
    await conversation.save();

    return res.json({ ok: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/dismissAdminForward]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function clearConversation(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const pageKey = String(req.body?.pageKey || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!pageKey) return res.status(400).json({ error: "pageKey_required" });

    const conversation = await ensureConversation(workspaceId, userId, pageKey);
    conversation.messages = [] as any;
    conversation.hasPendingAdminReply = false;
    conversation.needsAdminForward = false;
    await conversation.save();

    return res.json({ ok: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/clearConversation]", error);
    return res.status(500).json({ error: "internal" });
  }
}

export async function replyAsAdmin(req: Request, res: Response) {
  try {
    const userId = getUserIdFromReq(req);
    const workspaceId = getWorkspaceId(req);
    const conversationId = String(req.body?.conversationId || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!userId) return res.status(401).json({ error: "missing_token" });
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspaceId_required" });
    if (!conversationId || !mongoose.isValidObjectId(conversationId)) return res.status(400).json({ error: "conversationId_required" });
    if (!text) return res.status(400).json({ error: "text_required" });

    const role = await getMembershipRole(workspaceId, userId);
    if (!isAdminRole(role)) return res.status(403).json({ error: "not_admin" });

    const conversation = await GuidedAssistantConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    }).exec();

    if (!conversation) return res.status(404).json({ error: "conversation_not_found" });

    const adminUser = await User.findById(userId).select("fullName email").lean();
    const adminLabel = adminUser?.fullName || adminUser?.email || "Admin";

    conversation.messages.push({
      sender: "admin",
      kind: "admin_reply",
      text: `${adminLabel}: ${text}`,
      createdAt: new Date(),
    } as any);
    conversation.hasPendingAdminReply = false;
    conversation.needsAdminForward = false;
    await conversation.save();

    return res.json({ ok: true, conversation: serializeConversation(conversation) });
  } catch (error) {
    console.error("[m04/replyAsAdmin]", error);
    return res.status(500).json({ error: "internal" });
  }
}
