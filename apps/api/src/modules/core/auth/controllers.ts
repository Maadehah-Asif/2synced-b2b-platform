import type { Request, Response } from "express";
import fetch from "node-fetch";
import { User } from "./models/User.js";
import type { UserDoc } from "./models/User.js";
import { WorkspaceMember } from "./models/WorkspaceMember.js";
import type { WorkspaceMemberDoc } from "./models/WorkspaceMember.js";
import { hashPassword, verifyPassword } from "./utils/password.js";
import { signToken, verifyToken } from "./utils/jwt.js";
import { validatePassword } from "../utils/validation.js";
import type { AuthJwtPayload } from "./utils/jwt.js";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signup(req: Request, res: Response) {
  try {
	const { email, password, confirmPassword, fullName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match." });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
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

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

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

export async function googleAuth(req: Request, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  if (!clientId || !redirectUri) {
    // eslint-disable-next-line no-console
    console.error("[auth/google] Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT env vars");
    return res.redirect(`${frontendUrl}/#/login?error=google_config`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(url);
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string | undefined;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

    if (!code) {
      return res.redirect(`${frontendUrl}/#/login?error=google_no_code`);
    }

    if (!clientId || !clientSecret || !redirectUri) {
      // eslint-disable-next-line no-console
      console.error("[auth/google/callback] Missing Google OAuth env vars");
      return res.redirect(`${frontendUrl}/#/login?error=google_config`);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      // eslint-disable-next-line no-console
      console.error("[auth/google/callback] token exchange failed", await tokenRes.text());
      return res.redirect(`${frontendUrl}/#/login?error=google_token`);
    }

    const tokenJson: any = await tokenRes.json();
    const accessToken = tokenJson.access_token as string | undefined;
    const idToken = tokenJson.id_token as string | undefined;

    if (!accessToken && !idToken) {
      return res.redirect(`${frontendUrl}/#/login?error=google_token_missing`);
    }

    let email: string | undefined;
    let fullName: string | undefined;

    // Try to fetch profile via access token
    if (accessToken) {
      try {
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile: any = await profileRes.json();
          email = profile.email;
          fullName = profile.name;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[auth/google/callback] profile fetch failed", e);
      }
    }

    if (!email) {
      return res.redirect(`${frontendUrl}/#/login?error=google_no_email`);
    }

    const normalizedEmail = normalizeEmail(email);
    let user = (await User.findOne({ email: normalizedEmail }).exec()) as UserDoc | null;

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        fullName,
      }) as UserDoc;
    }

    const token = signToken({ sub: String(user._id) } as AuthJwtPayload);

    const redirectWithToken = `${frontendUrl}/#/landing?token=${encodeURIComponent(token)}`;
    return res.redirect(redirectWithToken);
  } catch (err) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    // eslint-disable-next-line no-console
    console.error("[auth/google/callback] unexpected error", err);
    return res.redirect(`${frontendUrl}/#/login?error=google_internal`);
  }
}
