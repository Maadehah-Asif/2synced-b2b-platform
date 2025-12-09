import mongoose from 'mongoose';
import LeakagePrediction from './models/LeakagePrediction.js';
import LeakageModelRun from './models/LeakageModelRun.js';
import Lead from '../m01/models/Lead.js';
import { CampaignTouch } from '../m06/models/CampaignTouch.js';
import FunnelStageHistory from './models/FunnelStageHistory.js';
import type { LeakageDashboard, HighRiskLeadRow, StageRiskRow, RiskBucket } from './m07.leakage.types.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';

/** Simple heuristic scoring implementation. Returns probability 0..1 */
function computeLeakageProbability({ timeInStageDays, recentTouches7, recentTouches14, recentTouches30 }: { timeInStageDays?: number | null; recentTouches7: number; recentTouches14: number; recentTouches30: number; }) {
  // Base score from time in stage (longer -> higher)
  const timeScore = Math.min(1, (timeInStageDays || 0) / 30); // 30 days => 1

  // Engagement score: more recent touches lower risk
  const engagementScore = 1 - Math.min(1, recentTouches7 / 5); // >5 touches in 7 days => engagement low risk

  // Combine weights
  const prob = Math.max(0, Math.min(1, 0.6 * timeScore + 0.4 * engagementScore));
  return prob;
}

export async function getLeakageDashboard(workspaceId: string, filters: any = {}): Promise<LeakageDashboard> {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);

  // KPIs: counts by bucket
  const bucketsAgg = await LeakagePrediction.aggregate([
    { $match: { workspaceId: workspaceOid } },
    { $group: { _id: '$riskBucket', count: { $sum: 1 } } },
  ]).exec();

  const bucketMap: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const r of bucketsAgg || []) {
    if (r && r._id) bucketMap[String(r._id)] = r.count || 0;
  }

  const totalScoredLeads = (bucketMap['LOW'] ?? 0) + (bucketMap['MEDIUM'] ?? 0) + (bucketMap['HIGH'] ?? 0);

  // Most risky stage (by high risk count)
  const stageAgg = await LeakagePrediction.aggregate([
    { $match: { workspaceId: workspaceOid, riskBucket: 'HIGH' } },
    { $group: { _id: '$currentStage', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]).exec();
  const mostRiskyStage = stageAgg[0]?._id || null;

  // Last model run
  const lastRun = await LeakageModelRun.findOne({ workspaceId: workspaceOid }).sort({ startedAt: -1 }).lean();

  // High-risk leads list (join lead and last touch)
  const highRowsRaw = await LeakagePrediction.find({ workspaceId: workspaceOid, riskBucket: 'HIGH' }).sort({ leakageProbability: -1 }).limit(200).lean();
  const leadIds = highRowsRaw.map(r => r.leadId);
  const leads = await Lead.find({ _id: { $in: leadIds } }).lean();

  // map lead id to lead doc
  const leadMap: Record<string, any> = {};
  for (const l of leads) {
    leadMap[String(l._id)] = l;
  }

  // fetch last touch per lead
  const touches = await CampaignTouch.aggregate([
    { $match: { lead_id: { $in: leadIds } } },
    { $sort: { touched_at: -1 } },
    { $group: { _id: '$lead_id', lastTouchAt: { $first: '$touched_at' }, lastTouchType: { $first: '$type' } } }
  ]).exec();
  const touchMap: Record<string, any> = {};
  for (const t of touches) {
    touchMap[String(t._id)] = t;
  }

  const highRiskLeads: HighRiskLeadRow[] = (highRowsRaw || []).map((r: any) => {
    const lead = leadMap[String(r.leadId)];
    const touch = touchMap[String(r.leadId)];
    return {
      leadId: String(r.leadId),
      leadName: lead ? `${lead.First_Name || ''} ${lead.Last_Name || ''}`.trim() || null : null,
      company: lead?.Company || null,
      currentStage: r.currentStage || null,
      leakageProbability: r.leakageProbability || 0,
      timeInStageDays: r.timeInStageDays ?? null,
      lastTouchAt: touch ? new Date(touch.lastTouchAt).toISOString() : null,
      ownerName: (lead as any)?.ownerName || null,
      status: 'NEW',
    } as HighRiskLeadRow;
  });

  // Stage level summary
  const stageSummaryAgg = await LeakagePrediction.aggregate([
    { $match: { workspaceId: workspaceOid } },
    { $group: { _id: '$currentStage', avg: { $avg: '$leakageProbability' }, highRisk: { $sum: { $cond: [{ $eq: ['$riskBucket', 'HIGH'] }, 1, 0] } }, total: { $sum: 1 } } },
  ]).exec();
  const stageRiskSummary: StageRiskRow[] = (stageSummaryAgg || []).map((s: any) => ({ stage: s._id || 'unknown', avgLeakageProbability: s.avg || 0, highRiskCount: s.highRisk || 0, totalLeads: s.total || 0 }));

  const modelConfidence = lastRun ? { modelVersion: lastRun.modelVersion, auc: null, accuracy: null, totalSamples: null, topFeatures: null } : null;

  const dashboard: LeakageDashboard = {
    kpis: {
      totalScoredLeads,
      highRiskCount: bucketMap['HIGH'] ?? 0,
      mediumRiskCount: bucketMap['MEDIUM'] ?? 0,
      lowRiskCount: bucketMap['LOW'] ?? 0,
      mostRiskyStage: mostRiskyStage || null,
      lastRun: lastRun ? { id: String(lastRun._id), modelVersion: lastRun.modelVersion, status: lastRun.status, startedAt: lastRun.startedAt?.toISOString(), finishedAt: lastRun.finishedAt ? lastRun.finishedAt.toISOString() : null } : null,
    },
    riskDistribution: { buckets: [ { bucket: 'LOW', count: bucketMap['LOW'] ?? 0 }, { bucket: 'MEDIUM', count: bucketMap['MEDIUM'] ?? 0 }, { bucket: 'HIGH', count: bucketMap['HIGH'] ?? 0 } ] },
    highRiskLeads,
    stageRiskSummary,
    modelConfidence,
  };

  return dashboard;
}

export async function runLeakagePrediction(workspaceId: string, options: any = {}, providedRunId?: any) {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);
  let run: any = null;
  if (providedRunId) {
    run = await LeakageModelRun.findById(providedRunId).exec();
    if (!run) run = await LeakageModelRun.create({ workspaceId: workspaceOid, modelVersion: options.modelVersion || 'v1', startedAt: new Date(), status: 'PENDING' });
  } else {
    run = await LeakageModelRun.create({ workspaceId: workspaceOid, modelVersion: options.modelVersion || 'v1', startedAt: new Date(), status: 'PENDING' });
  }

  try {
    // Determine leads to score: leads present in FunnelStageHistory for workspace
    const leadIds = await FunnelStageHistory.distinct('lead_id', { workspace: workspaceOid }) || [];
    // If none found, fall back to leads associated by other means
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      // attempt to find leads by workspace via Lead.custom.workspaceId or similar — conservative: bail
    }

    // Load recent touches map
    const touchWindow = new Date();
    touchWindow.setDate(touchWindow.getDate() - 30);
    const touches = await CampaignTouch.find({ lead_id: { $in: leadIds }, touched_at: { $gte: touchWindow } }).lean();
    const touchByLead: Record<string, any[]> = {};
    for (const t of touches) {
      const id = String((t as any).lead_id);
      touchByLead[id] = touchByLead[id] || [];
      touchByLead[id].push(t);
    }

    // For each lead compute features and upsert prediction
    for (const lid of leadIds) {
      const leadIdStr = String(lid);
      // compute time in stage using last two transitions
      const trans = await FunnelStageHistory.find({ lead_id: lid, workspace: workspaceOid }).sort({ timestamp: -1 }).limit(2).lean();
      let timeInStageDays: number | null = null;
      let currentStage: string | null = null;
      if (trans && trans.length) {
        const t0 = trans[0];
        if (t0) currentStage = (t0 as any).to_stage || null;
        if (trans.length >= 2) {
          const t1 = trans[1];
          if (t0 && (t0 as any).timestamp && t1 && (t1 as any).timestamp) {
            const dt = new Date((t0 as any).timestamp).getTime() - new Date((t1 as any).timestamp).getTime();
            if (!Number.isNaN(dt)) timeInStageDays = dt / (1000 * 60 * 60 * 24);
          }
        }
      }

      const leadTouches = touchByLead[leadIdStr] || [];
      // counts in windows
      const now = new Date();
      const countInDays = (days: number) => leadTouches.filter((t: any) => (now.getTime() - new Date(t.touched_at).getTime()) <= days * 24 * 3600 * 1000).length;
      const recent7 = countInDays(7);
      const recent14 = countInDays(14);
      const recent30 = countInDays(30);

      const prob = computeLeakageProbability({ timeInStageDays, recentTouches7: recent7, recentTouches14: recent14, recentTouches30: recent30 });
      const bucket = prob >= 0.7 ? 'HIGH' : (prob >= 0.3 ? 'MEDIUM' : 'LOW');

      await LeakagePrediction.updateOne({ leadId: lid, workspaceId: workspaceOid }, { $set: { leadId: lid, workspaceId: workspaceOid, leakageProbability: prob, riskBucket: bucket, currentStage, timeInStageDays, lastTouchAt: leadTouches[0]?.touched_at || null, modelVersion: run.modelVersion, predictedAt: new Date() } }, { upsert: true }).exec();
    }

    run.finishedAt = new Date();
    run.status = 'SUCCESS';
    if (run.save) await run.save();
    return { ok: true };
  } catch (e: any) {
    run.finishedAt = new Date();
    run.status = 'FAILED';
    run.errorMessage = e?.message || String(e);
    if (run.save) await run.save();
    throw e;
  }
}

export default { getLeakageDashboard, runLeakagePrediction };
