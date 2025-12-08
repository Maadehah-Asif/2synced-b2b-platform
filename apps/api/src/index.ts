import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRouter from "./modules/core/auth/routes.js";
import workspaceRouter from "./modules/core/workspaces/routes.js";
import m01Router from "./modules/m01/routes.js";
import m03Router from "./modules/m03/routes.js";
import m06Router from "./modules/m06/routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth routes
app.use("/auth", authRouter);
// Workspace routes
app.use("/workspaces", workspaceRouter);
// Module 01 (ingestion) routes
app.use("/m01", m01Router);
// Module 03 (conversations) routes
app.use("/m03", m03Router);
// Module 07 routes (analytics/attribution)
// Module 06 (was m07) routes
app.use("/m06", m06Router);

(async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`API running on port ${ENV.PORT}`);
  });
})();
