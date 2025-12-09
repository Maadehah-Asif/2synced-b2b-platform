import mongoose from 'mongoose';
import Recommendation from '../models/Recommendation.js';
import { runRecommendationsAgent } from './recommendations.agent.js';
import Lead from '../../m01/models/Lead.js';
import type { Request } from 'express';

export async function getRecommendations(workspaceId: string, filters: any = {}) {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);

  const q: any = { workspaceId: workspaceOid };
  // apply filters
  if (filters.status) q.status = filters.status;
  else q.status = 'OPEN';
  if (filters.stage) q.currentStage = filters.stage;
  if (filters.leakage) q.leakageLevel = filters.leakage;
  if (filters.fatigue) q.fatigueLevel = filters.fatigue;
  if (filters.campaign) q.lastCampaignId = mongoose.isValidObjectId(filters.campaign) ? new mongoose.Types.ObjectId(filters.campaign) : undefined;

  // find open/main recommendations
  const openRecs = await Recommendation.find(q).sort({ impactScore: -1, updatedAt: -1 }).lean();

  // history
  const history = await Recommendation.find({ workspaceId: workspaceOid, status: { $in: ['DONE','DISMISSED'] } }).sort({ updatedAt: -1 }).limit(200).lean();

  const summary = {
    openCount: openRecs.length,
    highUrgencyCount: openRecs.filter((r:any) => (r.impactScore||0) >= 85).length,
    completedLast7Days: await Recommendation.countDocuments({ workspaceId: workspaceOid, status: 'DONE', updatedAt: { $gte: new Date(Date.now() - 7*24*3600*1000) } }).exec(),
    avgLeakageOfOpen: openRecs.length ? (openRecs.reduce((s:any,r:any)=>s + (r.leakageProbability||0),0) / openRecs.length) : null
  };

  const explainableSignals: Record<string, any> = {};
  for (const r of openRecs) explainableSignals[String(r._id)] = r.explainableSignals || r.signals || {};

  // attach lead name and company and owner name (best-effort)
  const leadIds = Array.from(new Set(openRecs.map((r:any) => String(r.leadId))));
  const leads = await Lead.find({ _id: { $in: leadIds } }).lean();
  const leadMap: Record<string, any> = {};
  for (const l of leads) leadMap[String((l as any)._id)] = l;

  const recsOut = openRecs.map((r:any) => {
    const lead = leadMap[String(r.leadId)] || null;
    return {
      id: String(r._id),
      leadId: String(r.leadId),
      leadName: lead ? ((lead.First_Name || lead.FirstName || '') + ' ' + (lead.Last_Name || lead.LastName || '')).trim() : null,
      companyName: lead ? (lead.Company || lead.company || null) : null,
      currentStage: r.currentStage || null,
      leakageProbability: typeof r.leakageProbability === 'number' ? r.leakageProbability : null,
      leakageLevel: r.leakageLevel || 'UNKNOWN',
      fatigueLevel: r.fatigueLevel || 'UNKNOWN',
      recommendedAction: r.recommendedAction || r.recommendationType || null,
      actionLabel: r.actionLabel || null,
      impactScore: r.impactScore || 0,
      shortExplanation: r.shortExplanation || (r.explainableSignals ? JSON.stringify(r.explainableSignals).slice(0,100) : ''),
      status: r.status,
      ownerName: null,
      lastCampaignName: r.lastCampaignName || null,
      lastReplyType: (r.signals && r.signals.leakageSignals && r.signals.leakageSignals.lastReplyType) || null,
      createdAt: r.createdAt,
    };
  });

  const historyOut = (history || []).map((h:any) => ({ id: String(h._id), leadName: null, actionLabel: h.actionLabel || h.recommendedAction || h.recommendationType, status: h.status, completedByName: null, completedAt: h.completedAt || null }));

  return { summary, recommendations: recsOut, explainableSignals, history: historyOut };
}

export async function runRecommendations(workspaceId: string, opts: any = {}) {
  // run agent
  const result = await runRecommendationsAgent(workspaceId, opts);

  // upsert recommendations
  for (const r of result.recommendations || []) {
    try {
      const w = mongoose.isValidObjectId(workspaceId) ? new mongoose.Types.ObjectId(workspaceId) : workspaceId;
      // Only create actionable recommendation when both leakage & fatigue signals exist
      const hasLeak = !!(r && r.leakageProbability !== undefined && r.leakageProbability !== null);
      const hasFat = !!(r && r.fatigueLevel !== undefined && r.fatigueLevel !== null);
      const status = (hasLeak && hasFat) ? (r.status || 'OPEN') : 'INSUFFICIENT_DATA';

      const doc: any = {
        workspaceId: w,
        leadId: mongoose.isValidObjectId(String(r.leadId)) ? new mongoose.Types.ObjectId(String(r.leadId)) : r.leadId,
        recommendedAction: r.recommendedAction || r.recommendationType || null,
        recommendationType: r.recommendedAction || r.recommendationType || null,
        actionLabel: r.actionLabel || null,
        impactScore: r.impactScore || r.impact || 0,
        leakageProbability: r.leakageProbability ?? null,
        leakageLevel: r.leakageLevel || null,
        fatigueLevel: r.fatigueLevel || null,
        shortExplanation: r.shortExplanation || null,
        status,
        explainableSignals: r.explainableSignals || r.signals || null,
        signals: r.signals || r.explainableSignals || null,
        rulesFired: (r.signals && r.signals.rulesFired) || (r.rulesFired) || [],
        lastCampaignId: r.lastCampaignId ? (mongoose.isValidObjectId(String(r.lastCampaignId)) ? new mongoose.Types.ObjectId(String(r.lastCampaignId)) : r.lastCampaignId) : null,
        lastCampaignName: r.lastCampaignName || null,
        lastTouchTimestamp: r.lastTouchTimestamp || null,
        currentStage: r.currentStage || null,
        updatedAt: new Date(),
      };

      await Recommendation.updateOne({ workspaceId: w, leadId: doc.leadId }, { $set: doc }, { upsert: true }).exec();
    } catch (e) {
      // ignore individual upsert errors
    }
  }

  return result;
}

export async function markDone(id: string, userId?: string) {
  const now = new Date();
  await Recommendation.findByIdAndUpdate(id, { $set: { status: 'DONE', completedBy: userId || null, completedAt: now } }).exec();
  return { ok: true };
}

export async function markDismissed(id: string, userId?: string, note?: string) {
  const now = new Date();
  await Recommendation.findByIdAndUpdate(id, { $set: { status: 'DISMISSED', completedBy: userId || null, completedAt: now, dismissNote: note || null } }).exec();
  return { ok: true };
}

export default { getRecommendations, runRecommendations, markDone, markDismissed };
