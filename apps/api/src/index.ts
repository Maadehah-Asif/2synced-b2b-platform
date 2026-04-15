import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRouter from "./modules/core/auth/routes.js";
import workspaceRouter from "./modules/core/workspaces/routes.js";
import m01Router from "./modules/m01/routes.js";
import m03Router from "./modules/m03/routes.js";
import m06Router from "./modules/m06/routes.js";
import m02Router from "./modules/m02/routes.js";
import m07Router from "./modules/m07/routes.js";
import m05Router from "./modules/m05/routes.js";

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
app.use("/m06", m06Router);
// Module 02 (intent scoring)
app.use("/m02", m02Router);
app.use("/m07", m07Router);
app.use("/m05", m05Router);

(async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`API running on port ${ENV.PORT}`);
  });
})();
