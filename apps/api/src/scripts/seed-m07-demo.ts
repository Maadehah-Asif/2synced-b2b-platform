#!/usr/bin/env tsx
import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import Lead from '../modules/m01/models/Lead.js';
import { Campaign } from '../modules/m06/models/Campaign.js';
import { CampaignTouch } from '../modules/m06/models/CampaignTouch.js';
import { LeakagePrediction } from '../modules/m07/models/LeakagePrediction.js';
import { FatigueResult } from '../modules/m07/models/FatigueResult.js';
import { FunnelStageHistory } from '../modules/m07/models/FunnelStageHistory.js';
import Recommendation from '../modules/m07/models/Recommendation.js';
import { runRecommendations } from '../modules/m07/recommendations/recommendations.service.js';

async function seed() {
  await connectDB();
  const workspaceId = new mongoose.Types.ObjectId();
  console.log('Using demo workspaceId:', String(workspaceId));

  // create a lead
  const lead = await Lead.create({ First_Name: 'Demo', Last_Name: 'Lead', Company: 'Acme Inc.' });
  console.log('Created lead', String((lead as any)._id));

  // create a campaign
  const campaign = await Campaign.create({ project_id: workspaceId, campaign_id: `demo-camp-1-${Date.now()}`, channel: 'email', name: 'Demo Campaign', spend: 0 });
  console.log('Created campaign', String((campaign as any)._id));

  // create a campaign touch
  await CampaignTouch.create({ project_id: workspaceId, lead_id: (lead as any)._id, campaign_id: (campaign as any)._id, channel: 'email', touched_at: new Date(), type: 'email_open', status: 'active' });

  // create leakage prediction
  await LeakagePrediction.create({ leadId: (lead as any)._id, workspaceId, leakageProbability: 0.85, riskBucket: 'HIGH', currentStage: 'MQL', timeInStageDays: 10, lastTouchAt: new Date() });

  // create fatigue result
  await FatigueResult.create({ leadId: (lead as any)._id, workspaceId, touchCount: 5, fatigueLevel: 'OK', windowDays: 14, lastTouchAt: new Date(), campaignId: (campaign as any)._id });

  // funnel stage history
  await FunnelStageHistory.create({ lead_id: (lead as any)._id, workspace: workspaceId, to_stage: 'MQL', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10) });

  console.log('Seeding complete — running recommendations engine (background)');
  // run recommendations engine to populate Recommendation collection
  try {
    await runRecommendations(String(workspaceId), {});
    console.log('Recommendations run complete.');
  } catch (e) {
    console.error('Error running recommendations:', e);
  }

  // show a sample recommendation
  const recs = await Recommendation.find({ workspaceId }).lean();
  console.log('Recommendations for workspace:', recs);

  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
