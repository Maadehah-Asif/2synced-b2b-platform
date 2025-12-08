import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import type { StringValue } from "ms";
import { ENV } from "../../../../config/env.js";

export type AuthJwtPayload = {
  sub: string; // user id
  wid?: string; // workspace id (primary/current)
};

export function signToken(payload: AuthJwtPayload, expiresIn: number | StringValue = "7d"): string {
  const secret: Secret = ENV.JWT_SECRET;
  const opts: SignOptions = { expiresIn, algorithm: "HS256" };
  return jwt.sign(payload as object, secret, opts);
}

export function verifyToken(token: string): AuthJwtPayload {
  const secret: Secret = ENV.JWT_SECRET;
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") {
    throw new Error("invalid_token");
  }
  return decoded as AuthJwtPayload;
}
