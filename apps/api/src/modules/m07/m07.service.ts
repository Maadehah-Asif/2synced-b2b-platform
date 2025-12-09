import mongoose from 'mongoose';
import FunnelStageHistory from './models/FunnelStageHistory.js';
import { Deal } from '../m06/models/Deal.js';
import Lead from '../m01/models/Lead.js';
import type { FunnelHealthResponse } from './m07.types.js';

type QueryOpts = { workspace: string; from?: Date | null; to?: Date | null; stages?: string[] | undefined | null };

/**
 * Build a basic FunnelHealthResponse using FunnelStageHistory and Deal collections.
 * This is deliberately conservative: if data is missing we return empty arrays/defaults.
 */
export async function getFunnelHealth(opts: QueryOpts): Promise<FunnelHealthResponse> {
  const { workspace, from, to, stages } = opts;
  const workspaceOid = new mongoose.Types.ObjectId(workspace);

  // Match for timeframe and workspace
  const match: any = { workspace: workspaceOid };
  if (from || to) {
    match.timestamp = {} as any;
    if (from) match.timestamp.$gte = from;
    if (to) match.timestamp.$lte = to;
  }

  // Get transition counts between stages (sankey links)
  const linksAgg = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $group: { _id: { from: '$from_stage', to: '$to_stage' }, value: { $sum: 1 } } },
  ]).exec()) || [];

  // Unique stage set
  const stageSet = new Set<string>();
  for (const r of linksAgg) {
    if (!r || !r._id) continue;
    if (r._id.from) stageSet.add(r._id.from);
    if (r._id.to) stageSet.add(r._id.to);
  }

  // Fallback: if stages explicitly provided use them, otherwise use detected or a simple default
  const stageList = stages && stages.length ? stages : (Array.from(stageSet).length ? Array.from(stageSet) : ['Prospect', 'Qualified', 'Demo', 'Proposal', 'Closed']);

  // Nodes
  const sankeyNodes = stageList.map((s: string, idx: number) => ({ id: String(idx), name: s, value: 0 }));

  // Links mapping using indexes
  const sankeyLinks: Array<{ source: string; target: string; value: number }> = [];
  for (const r of linksAgg) {
    if (!r || !r._id) continue;
    const from = r._id.from || 'unknown';
    const to = r._id.to || 'unknown';
    const sourceIndex = stageList.indexOf(from) >= 0 ? stageList.indexOf(from) : Math.max(0, stageList.indexOf('Prospect'));
    const targetIndex = stageList.indexOf(to) >= 0 ? stageList.indexOf(to) : Math.max(0, stageList.indexOf('Qualified'));
    sankeyLinks.push({ source: String(sourceIndex), target: String(targetIndex), value: r.value || 0 });
  }

  // Funnel stage counts: latest state per lead (within timeframe if provided, otherwise overall latest)
  // We'll compute latest transition per lead and count by to_stage
  const latestPerLeadAgg = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $sort: { lead_id: 1, timestamp: -1 } },
    {
      $group: {
        _id: '$lead_id',
        stage: { $first: '$to_stage' },
        ts: { $first: '$timestamp' },
      },
    },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]).exec()) || [];

  const funnelStages = stageList.map(s => ({ name: s, count: 0 }));
  for (const r of latestPerLeadAgg) {
    if (!r) continue;
    const idx = funnelStages.findIndex(f => f.name === r._id);
    if (idx >= 0 && funnelStages[idx]) funnelStages[idx].count = r.count || 0;
  }

  // KPIs: totalActiveLeads = distinct lead count in timeframe (from FunnelStageHistory)
  const distinctLeadsAgg = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $group: { _id: '$lead_id' } },
    { $count: 'total' },
  ]).exec()) || [];
  const totalActiveLeads = (distinctLeadsAgg[0] && distinctLeadsAgg[0].total) || 0;

  // totalEngagedLeads = leads with >1 transition in range
  const engagedAgg = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $group: { _id: '$lead_id', c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } },
    { $count: 'total' },
  ]).exec()) || [];
  const totalEngagedLeads = (engagedAgg[0] && engagedAgg[0].total) || 0;

  // totalDeals: deals linked to this workspace (using project_id/workspace mapping may vary)
  // We'll look for deals that have a matching project_id == workspaceOid OR deals whose lead appears in this workspace's funnel history
  let totalDeals = 0;
  try {
    const dealAgg = await Deal.aggregate([
      { $match: {} },
      { $limit: 0 },
    ]).exec();
    // conservative: do a count by joining lead ids from transition set
    const leadIds = (await FunnelStageHistory.distinct('lead_id', { workspace: workspaceOid })) || [];
    if (Array.isArray(leadIds) && leadIds.length) {
      totalDeals = await Deal.countDocuments({ lead_id: { $in: leadIds } }).exec();
    } else {
      totalDeals = 0;
    }
  } catch (e) {
    totalDeals = 0;
  }

  const winRate = totalActiveLeads > 0 ? (totalDeals / totalActiveLeads) : 0;

  // Stage metrics: average time spent in stage (approx): compute time between entry and next transition per lead
  // We'll compute for each lead its ordered transitions and take diffs. This is heavier but constrained to workspace and timeframe.
  const stageDurations: Record<string, { totalMs: number; count: number }> = {};

  // Fetch transitions grouped by lead
  const transitions = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $sort: { lead_id: 1, timestamp: 1 } },
    { $group: { _id: '$lead_id', trans: { $push: { stage: '$to_stage', ts: '$timestamp' } } } },
  ]).exec()) || [];

  for (const row of transitions) {
    if (!row || !Array.isArray(row.trans) || row.trans.length <= 1) continue;
    const arr = row.trans as Array<{ stage?: string; ts?: Date }>;
    for (let i = 0; i < arr.length - 1; i++) {
      const cur = arr[i];
      const nxt = arr[i + 1];
      if (!cur || !cur.ts || !nxt || !nxt.ts) continue;
      const s = cur.stage || 'unknown';
      const dt = new Date(nxt.ts).getTime() - new Date(cur.ts).getTime();
      if (!stageDurations[s]) stageDurations[s] = { totalMs: 0, count: 0 };
      if (dt > 0) {
        stageDurations[s].totalMs += dt;
        stageDurations[s].count += 1;
      }
    }
  }

  const stageMetrics = stageList.map(s => {
    const stat = stageDurations[s];
    return {
      stage: s,
      avgTimeDays: stat && stat.count > 0 ? (stat.totalMs / stat.count) / (1000 * 60 * 60 * 24) : null,
      conversions: 0,
      velocity: null,
    };
  });

  // Fill conversions roughly by counting transitions from this stage to any other
  const convAgg = (await FunnelStageHistory.aggregate([
    { $match: match },
    { $group: { _id: '$from_stage', conversions: { $sum: 1 } } },
  ]).exec()) || [];
  for (const r of convAgg) {
    if (!r) continue;
    const row = stageMetrics.find((m: any) => m.stage === r._id);
    if (row) row.conversions = r.conversions || 0;
  }

  // Leakage matrix: NxN zeros or transition counts between stage indices
  const n = stageList.length;
  const leakageMatrix: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (const r of linksAgg) {
    if (!r || !r._id) continue;
    const from = r._id.from || 'unknown';
    const to = r._id.to || 'unknown';
    const i = stageList.indexOf(from) >= 0 ? stageList.indexOf(from) : 0;
    const j = stageList.indexOf(to) >= 0 ? stageList.indexOf(to) : 0;
    if (Array.isArray(leakageMatrix[i]) && typeof leakageMatrix[i][j] !== 'undefined') {
      leakageMatrix[i][j] = r.value || 0;
    }
  }

  const response: FunnelHealthResponse = {
    ok: true,
    kpis: {
      totalActiveLeads,
      totalEngagedLeads,
      totalDeals,
      winRate,
      avgTimeToCloseDays: null,
    },
    funnelStages,
    sankeyNodes,
    sankeyLinks,
    stageMetrics,
    leakageMatrix,
    exportUrls: {},
  };

  return response;
}

export default { getFunnelHealth };
