import mongoose from 'mongoose';
import { CampaignTouch } from '../m06/models/CampaignTouch.js';
import { Campaign } from '../m06/models/Campaign.js';
import Lead from '../m01/models/Lead.js';
import FatigueResult from './models/FatigueResult.js';
import { runFatigueAgent } from './m07.fatigue.agent.js';
import type { FatigueDashboard, FatigueRunOptions } from './m07.fatigue.types.js';

export async function getFatigueDashboard(workspaceId: string, filters: any = {}): Promise<FatigueDashboard> {
  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);

  // Read latest FatigueResult rows for this workspace (limit recent computed)
  const recent = await FatigueResult.find({ workspaceId: workspaceOid }).sort({ computedAt: -1 }).limit(1000).lean();

  // Build fatiguedLeads array
  const leadIds = recent.map((r: any) => r.leadId);
  const leads = await Lead.find({ _id: { $in: leadIds } }).lean();
  const leadMap: Record<string, any> = {};
  for (const l of leads) leadMap[String(l._id)] = l;

  const fatiguedLeads = (recent || []).map((r: any) => ({
    leadId: String(r.leadId),
    leadName: leadMap[String(r.leadId)] ? `${leadMap[String(r.leadId)].First_Name || ''} ${leadMap[String(r.leadId)].Last_Name || ''}`.trim() : null,
    fatigueLevel: r.fatigueLevel,
    touchCount: r.touchCount,
    lastTouchAt: r.lastTouchAt ? new Date(r.lastTouchAt).toISOString() : null,
    lastCampaignName: null,
    ownerName: (leadMap[String(r.leadId)] as any)?.ownerName || null,
  }));

  // Campaign stats: aggregate recent touches for workspace
  const campAgg = await CampaignTouch.aggregate([
    { $match: { project_id: workspaceOid } },
    { $group: { _id: '$campaign_id', leadsTouched: { $addToSet: '$lead_id' }, touches: { $sum: 1 } } },
    { $project: { campaignId: '$_id', leadsTouched: { $size: '$leadsTouched' }, avgTouches: { $divide: ['$touches', { $size: '$leadsTouched' }] } } }
  ]).exec();

  const campaignStats: any[] = [];
  for (const c of campAgg || []) {
    const campaign = await Campaign.findById(c.campaignId).lean();
    // percentFatigued approximate using FatigueResult
    const fatiguedCount = await FatigueResult.countDocuments({ workspaceId: workspaceOid, campaignId: c.campaignId, fatigueLevel: { $in: ['TIRED', 'BURNT_OUT'] } }).exec();
    const percentFatigued = Math.round((fatiguedCount / Math.max(1, c.leadsTouched)) * 100);
    campaignStats.push({
      campaignId: String(c.campaignId),
      campaignName: campaign?.name || null,
      channel: campaign?.channel || null,
      leadsTouched: c.leadsTouched || 0,
      avgTouches: Math.round((c.avgTouches || 0) * 10) / 10,
      percentFatigued,
      recommendedAction: percentFatigued > 40 ? 'pause' : (c.avgTouches > 8 ? 'slow_down' : 'none')
    });
  }

  // summary counts
  const summaryAgg = await FatigueResult.aggregate([
    { $match: { workspaceId: workspaceOid } },
    { $group: { _id: '$fatigueLevel', count: { $sum: 1 } } }
  ]).exec();
  const summaryMap: Record<string, number> = { OK: 0, WARM: 0, TIRED: 0, BURNT_OUT: 0 };
  for (const s of summaryAgg) summaryMap[s._id] = s.count || 0;

  // most fatiguing campaign by percent fatigued
  let mostFatiguingCampaign: string | null = null;
  if (campaignStats.length) {
    campaignStats.sort((a,b) => b.percentFatigued - a.percentFatigued);
    mostFatiguingCampaign = campaignStats[0].campaignName || null;
  }

  // alerts: return simple recent alert info (not implemented: use stored alerts)
  const alerts = [] as any[];

  const dashboard: FatigueDashboard = {
    summary: { ok: summaryMap.OK || 0, warm: summaryMap.WARM || 0, tired: summaryMap.TIRED || 0, burntOut: summaryMap.BURNT_OUT || 0, mostFatiguingCampaign },
    campaignStats,
    fatiguedLeads,
    alerts,
  };

  return dashboard;
}

export async function runFatigueDetection(workspaceId: string, opts: FatigueRunOptions) {
  if (!['7','14','30'].includes(String(opts.windowDays))) throw new Error('invalid_window_days');
  if (!opts.threshold || typeof opts.threshold !== 'number' || opts.threshold <= 0) throw new Error('invalid_threshold');

  const workspaceOid = new mongoose.Types.ObjectId(workspaceId);

  // fetch touches within window
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - opts.windowDays);

  const touches = await CampaignTouch.find({ project_id: workspaceOid, touched_at: { $gte: windowStart }, channel: { $in: opts.channels && opts.channels.length ? opts.channels : ['email','ads','linkedin','webinar','other'] } }).lean();

  const agentResult = await runFatigueAgent(touches, opts as FatigueRunOptions);

  // persist per-lead results to FatigueResult
  for (const l of agentResult.leads || []) {
    try {
      await FatigueResult.updateOne({ leadId: l.leadId, workspaceId: workspaceOid }, { $set: { leadId: l.leadId, workspaceId: workspaceOid, touchCount: l.touchCount, fatigueLevel: l.fatigueLevel, windowDays: opts.windowDays, lastTouchAt: l.lastTouch, campaignId: l.lastCampaignId || null, computedAt: new Date() } }, { upsert: true }).exec();
    } catch (e) {
      // ignore single failures
    }
  }

  return agentResult;
}

export default { getFatigueDashboard, runFatigueDetection };
