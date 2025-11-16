import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './utils/jwt.js';
import { User } from './models/User.js';

// Attach user to req.user when Authorization header contains a valid Bearer token.
// This middleware is non-fatal: if no token or invalid token is present, it simply calls next().
export async function attachOptionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.header('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return next();
    const payload = verifyToken(token);
    if (!payload || !payload.sub) return next();
    const user = await User.findById(payload.sub).lean();
    if (user) {
      // attach minimal user info to req for downstream handlers
      (req as any).user = {
        _id: user._id,
        id: String(user._id),
        email: (user as any).email,
        fullName: (user as any).fullName,
        username: (user as any).username,
      };
    }
    return next();
  } catch (e) {
    // ignore token errors; do not block request
    return next();
  }
}
