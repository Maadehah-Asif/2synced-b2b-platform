// ==============================
// LOAD ENV FROM apps/api/.env
// ==============================
import dotenv from "dotenv";
dotenv.config({ path: "../../../.env" });   // <-- MAIN FIX

import mongoose from "mongoose";

// REAL WORKSPACE ID
const WORKSPACE_ID = "691d42a6f7055cb3eb370bc6";

// ==============================
// MODELS (DO NOT CHANGE PATHS)
// ==============================
import FunnelStageHistory from "./models/FunnelStageHistory.js";
import LeakagePrediction from "./models/LeakagePrediction.js";
import FatigueResult from "./models/FatigueResult.js";
import Recommendation from "./models/Recommendation.js";
import Lead from "../m01/models/Lead.js";

const { ObjectId } = mongoose.Types;

// ==============================
// UTILS
// ==============================
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Create fake lead IDs for testing
const LEAD_IDS = Array.from({ length: 15 }, () => new ObjectId());

// ==============================
// MAIN SEED FUNCTION
// ==============================
async function seed() {
  // ⭐ FIXED MONGO CONNECTION
  const MONGO = `${process.env.MONGO_URI}${process.env.DB_NAME}`;

  console.log("Connecting to MongoDB:", MONGO);

  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB");

  const workspaceOid = new ObjectId(WORKSPACE_ID);

  // ==============================
  // CLEAR ONLY MODULE 7 COLLECTIONS
  // ==============================
  await FunnelStageHistory.deleteMany({ workspace: workspaceOid });
  await LeakagePrediction.deleteMany({ workspaceId: workspaceOid });
  await FatigueResult.deleteMany({ workspaceId: workspaceOid });
  await Recommendation.deleteMany({ workspaceId: workspaceOid });

  console.log("Cleared Module 7 collections");

  // ==============================
  // CREATE LEAD DOCUMENTS (MINIMAL)
  // ==============================
  for (const leadId of LEAD_IDS) {
    try {
      await Lead.create({
        _id: leadId,
        First_Name: "Demo",
        Last_Name: `Lead_${String(leadId).slice(-4)}`,
        Company: "Acme",
      });
    } catch {
      // ignore duplicates
    }
  }

  // ==============================
  // SEED FUNNEL STAGE HISTORY
  // ==============================
  console.log("Seeding FunnelStageHistory...");
  for (const leadId of LEAD_IDS) {
    await FunnelStageHistory.create({
      lead_id: leadId,
      workspace: workspaceOid,
      from_stage: pick(["Prospect", "MQL"]),
      to_stage: pick(["MQL", "SQL", "Opportunity"]),
      timestamp: new Date(Date.now() - rand(2, 10) * 86400000),
      metadata: { timeInStageDays: Math.floor(rand(1, 12)) },
    });
  }

  // ==============================
  // SEED LEAKAGE PREDICTIONS
  // ==============================
  console.log("Seeding LeakagePrediction...");
  for (const leadId of LEAD_IDS) {
    await LeakagePrediction.create({
      leadId,
      workspaceId: workspaceOid,
      leakageProbability: rand(0.1, 0.95),
      riskBucket: pick(["LOW", "MEDIUM", "HIGH"]),
      modelVersion: "v1.0",
      predictedAt: new Date(),
    });
  }

  // ==============================
  // SEED FATIGUE RESULTS
  // ==============================
  console.log("Seeding FatigueResult...");
  for (const leadId of LEAD_IDS) {
    await FatigueResult.create({
      leadId,
      workspaceId: workspaceOid,
      fatigueLevel: pick(["OK", "WARM", "TIRED", "BURNT_OUT"]),
      touchCount: Math.floor(rand(1, 20)),
      windowDays: 14,
      computedAt: new Date(),
    });
  }

  // ==============================
  // SEED RECOMMENDATIONS
  // ==============================
  console.log("Seeding Recommendations...");
  for (const leadId of LEAD_IDS) {
    await Recommendation.create({
      workspaceId: workspaceOid,
      leadId,
      currentStage: pick(["MQL", "SQL", "Opportunity"]),
      recommendationType: pick([
        "CALL_NOW",
        "PAUSE_CAMPAIGNS",
        "MOVE_TO_NURTURE",
        "REDUCE_FREQUENCY",
      ]),
      actionLabel: pick([
        "Call Now",
        "Pause Outreach",
        "Move to Nurture",
        "Reduce Frequency",
      ]),
      impactScore: Math.floor(rand(40, 100)),
      leakageProbability: rand(0.2, 0.9),
      leakageLevel: pick(["LOW", "MEDIUM", "HIGH"]),
      fatigueLevel: pick(["OK", "WARM", "TIRED", "BURNT_OUT"]),
      shortExplanation: pick([
        "High leakage + moderate fatigue.",
        "Fatigue spike detected.",
        "Lead inactive for 10+ days.",
        "Poor stage progression.",
        "Campaign overload detected.",
      ]),
      status: pick(["OPEN", "DONE", "DISMISSED"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log("🎉 DONE — Module 7 test data seeded successfully!");
  process.exit();
}

seed().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
