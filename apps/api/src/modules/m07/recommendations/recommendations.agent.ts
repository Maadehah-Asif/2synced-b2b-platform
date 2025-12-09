import mongoose from 'mongoose';
import LeakagePrediction from '../models/LeakagePrediction.js';
import FatigueResult from '../models/FatigueResult.js';
import FunnelStageHistory from '../models/FunnelStageHistory.js';
import { CampaignTouch } from '../../m06/models/CampaignTouch.js';
import { Campaign } from '../../m06/models/Campaign.js';
import { Deal } from '../../m06/models/Deal.js';

/**
 * Recommendation agent: gathers signals and applies rules to create recommendations.
 */
export async function runRecommendationsAgent(workspaceId: string, opts: any = {}) {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);

  // Gather candidate leads: union of leakage predictions and fatigue results
  const leakRows = await LeakagePrediction.find({ workspaceId: workspaceOid }).lean();
  const fatigueRows = await FatigueResult.find({ workspaceId: workspaceOid }).lean();
  const leadSet = new Set<string>();
  for (const r of leakRows || []) leadSet.add(String(r.leadId));
  for (const r of fatigueRows || []) leadSet.add(String(r.leadId));

  const recommendations: any[] = [];
  const explainableSignals: Record<string, any> = {};

  // Precompute campaign performance placeholder: mark campaigns with many touches as 'highly_active'
  const campTouchesAgg = await CampaignTouch.aggregate([
    { $match: { project_id: workspaceOid } },
    { $group: { _id: '$campaign_id', touches: { $sum: 1 } } },
    { $sort: { touches: -1 } },
    { $limit: 10 }
  ]).exec();
  const topCampaignIds = (campTouchesAgg || []).map((c: any) => String(c._id));

  for (const lid of Array.from(leadSet)) {
    const leak = (leakRows || []).find((x: any) => String(x.leadId) === lid) || null;
    const fat = (fatigueRows || []).find((x: any) => String(x.leadId) === lid) || null;

    // funnel stage
    const trans = await FunnelStageHistory.find({ lead_id: new mongoose.Types.ObjectId(lid), workspace: workspaceOid }).sort({ timestamp: -1 }).limit(1).lean();
    const currentStage = trans && trans[0] ? (trans[0] as any).to_stage || null : null;

    // last touch
    const lastTouch = await CampaignTouch.findOne({ lead_id: new mongoose.Types.ObjectId(lid) }).sort({ touched_at: -1 }).lean();

    // deals
    const deals = await Deal.find({ lead_id: new mongoose.Types.ObjectId(lid) }).sort({ updatedAt: -1 }).lean();
    const deal = deals && deals[0] ? deals[0] : null;

    const leakageProbability = leak ? (leak.leakageProbability || 0) : 0;
    const leakageLevel = leak ? (leak.riskBucket || 'LOW') : 'LOW';
    const fatigueLevel = fat ? (fat.fatigueLevel || 'OK') : 'OK';
    const fatigueTouches = fat ? (fat.touchCount || 0) : 0;

    // signals
    const leakageSignals = { leakageProbability, leakageLevel };
    const fatigueSignals = { fatigueLevel, fatigueTouches };
    // derive campaign name from Campaign collection when possible
    let lastCampaignName: string | null = null;
    if (lastTouch && lastTouch.campaign_id) {
      try {
        const camp = await Campaign.findById(lastTouch.campaign_id).lean();
        lastCampaignName = camp ? (camp as any).name || null : null;
      } catch (_) {
        lastCampaignName = null;
      }
    }
    const campaignSignals = { lastCampaignId: lastTouch ? String(lastTouch.campaign_id) : null, lastCampaignName };
    // normalize Deal fields from m06/Deal model (revenue, closed_won, closed_at)
    let dealStatus: string | null = null;
    let dealAmount: number | null = null;
    if (deal) {
      dealAmount = (deal as any).revenue ?? null;
      if ((deal as any).closed_won === true) dealStatus = 'WON';
      else if ((deal as any).closed_at) dealStatus = 'LOST';
      else dealStatus = 'OPEN';
    }
    const dealSignals = { dealStatus, dealAmount };

    let recommendedAction = 'NONE';
    let actionLabel = 'No action';
    let impactScore = 20;
    const rulesFired: string[] = [];

    // RULE 5: Open deal (not closed) + High Leakage -> CALL_NOW
    if (deal && dealStatus === 'OPEN' && leakageProbability >= 0.7) {
      recommendedAction = 'CALL_NOW'; actionLabel = 'Call lead (open deal)'; impactScore = 85; rulesFired.push('RULE_5');
    }

    // RULE 1: High Leakage + Low Fatigue -> CALL_NOW
    if (leakageProbability >= 0.8 && ['OK','WARM'].includes(fatigueLevel)) {
      recommendedAction = 'CALL_NOW'; actionLabel = 'Call now'; impactScore = Math.max(impactScore, 92); rulesFired.push('RULE_1');
    }

    // RULE 2: High Leakage + Campaign Overload -> PAUSE_CAMPAIGNS
    if (leakageProbability >= 0.7 && ['TIRED','BURNT_OUT'].includes(fatigueLevel)) {
      recommendedAction = 'PAUSE_CAMPAIGNS'; actionLabel = 'Pause outreach'; impactScore = 90; rulesFired.push('RULE_2');
    }

    // RULE 3: Medium Leakage + Strong Campaigns -> RETARGET
    const topPerforming = campaignSignals.lastCampaignId && topCampaignIds.includes(String(campaignSignals.lastCampaignId));
    if (leakageProbability >= 0.5 && leakageProbability < 0.7 && topPerforming) {
      recommendedAction = 'RETARGET'; actionLabel = 'Retarget via top campaign'; impactScore = 75; rulesFired.push('RULE_3');
    }

    // RULE 4: Low Leakage + High Fatigue -> REDUCE_FREQUENCY
    if (leakageProbability < 0.4 && ['TIRED','BURNT_OUT'].includes(fatigueLevel)) {
      recommendedAction = 'REDUCE_FREQUENCY'; actionLabel = 'Reduce outreach frequency'; impactScore = 55; rulesFired.push('RULE_4');
    }

    // RULE 6: Deal Lost Recently -> MOVE_TO_NURTURE
    if (deal && dealStatus === 'LOST') {
      recommendedAction = 'MOVE_TO_NURTURE'; actionLabel = 'Move to nurture'; impactScore = 50; rulesFired.push('RULE_6');
    }

    // Small boost for open deal + high leakage
    if (deal && dealStatus === 'OPEN' && leakageProbability >= 0.7) {
      impactScore = Math.min(100, impactScore + 15);
    }

    // Build explanation
    const shortExplanation = (rulesFired.length ? `${rulesFired.join(', ')} triggered` : 'Signals indicate monitoring').slice(0,100);

    const rec = {
      workspaceId: workspaceId,
      leadId: lid,
      currentStage,
      recommendedAction,
      actionLabel,
      impactScore,
      leakageProbability,
      leakageLevel,
      fatigueLevel,
      fatigueTouches,
      lastCampaignId: campaignSignals.lastCampaignId,
      lastCampaignName: campaignSignals.lastCampaignName,
      lastTouchTimestamp: lastTouch ? (lastTouch as any).touched_at : null,
      dealStatus,
      dealAmount,
      shortExplanation,
      status: 'OPEN',
      signals: { leakageSignals, fatigueSignals, campaignSignals, dealSignals, rulesFired },
      explainableSignals: { leakageSignals, fatigueSignals, campaignSignals, dealSignals, rulesFired },
    };

    explainableSignals[lid] = rec.signals;
    recommendations.push(rec);
  }

  return { recommendations, explainableSignals };
}

export default { runRecommendationsAgent };
