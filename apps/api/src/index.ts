import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRouter from "./modules/core/auth/routes.js";
import workspaceRouter from "./modules/core/workspaces/routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth routes
app.use("/auth", authRouter);
// Workspace routes
app.use("/workspaces", workspaceRouter);

(async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`API running on port ${ENV.PORT}`);
  });
})();
