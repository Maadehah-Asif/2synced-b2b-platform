import type { Request, Response } from "express";
import { User } from "./models/User.js";
import type { UserDoc } from "./models/User.js";
import { WorkspaceMember } from "./models/WorkspaceMember.js";
import type { WorkspaceMemberDoc } from "./models/WorkspaceMember.js";
import { hashPassword, verifyPassword } from "./utils/password.js";
import { signToken, verifyToken } from "./utils/jwt.js";
import type { AuthJwtPayload } from "./utils/jwt.js";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signup(req: Request, res: Response) {
  try {
  const { email, password, fullName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const normalizedEmail = normalizeEmail(email);

    const existing = await User.findOne({ email: normalizedEmail }).exec();
    if (existing) return res.status(409).json({ error: "user already exists" });
    // Create user only. Workspace creation/joining is handled later by the user.
    const passwordHash = await hashPassword(password);
    const user = await User.create({ email: normalizedEmail, fullName, passwordHash });
    const token = signToken({ sub: String(user._id) } as any);
    return res.status(201).json({ token, user: { id: String(user._id), email: user.email, fullName: user.fullName } });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ error: "duplicate key" });
    // eslint-disable-next-line no-console
    console.error("[auth/signup]", err);
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = signToken({ sub: String(user._id) } as AuthJwtPayload);

    return res.json({
      token,
      user: { id: String(user._id), email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "missing_token" });
    const payload = verifyToken(token);

    const user = await User.findById(payload.sub).exec();
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const memberships = (await WorkspaceMember.find({ userId: user._id }).exec()) as WorkspaceMemberDoc[];
    return res.json({
      user: { id: String(user._id), email: user.email, fullName: user.fullName },
      memberships: memberships.map((m: WorkspaceMemberDoc) => ({ id: String(m._id), workspaceId: String(m.workspaceId), role: m.role })),
    });
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "missing_token" });
    const payload = verifyToken(token);

    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "old_and_new_required" });

    const user = await User.findById(payload.sub).exec();
    if (!user || !user.passwordHash) return res.status(404).json({ error: "user_not_found" });

    const ok = await verifyPassword(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const passwordHash = await hashPassword(newPassword);
    user.passwordHash = passwordHash;
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth/change-password]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
