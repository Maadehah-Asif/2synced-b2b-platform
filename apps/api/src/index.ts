import express from "express";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRouter from "./modules/core/auth/routes.js";
import workspaceRouter from "./modules/core/workspaces/routes.js";
import m01Router from "./modules/m01/routes.js";
import m06Router from "./modules/m06/routes.js";
import m02Router from "./modules/m02/routes.js";
import m07Router from "./modules/m07/routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: ENV.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: ENV.BODY_LIMIT }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth routes
app.use("/auth", authRouter);
// Workspace routes
app.use("/workspaces", workspaceRouter);
// Module 01 (ingestion) routes
app.use("/m01", m01Router);
app.use("/m06", m06Router);
// Module 02 (intent scoring)
app.use("/m02", m02Router);
app.use("/m07", m07Router);

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    return res.status(413).json({
      error: "request_too_large",
      message: `Request body exceeds the configured limit of ${ENV.BODY_LIMIT}.`,
    });
  }

  return next(error);
});

(async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`API running on port ${ENV.PORT}`);
  });
})();
