import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Deal } from './models/Deal.js';
import { Campaign } from './models/Campaign.js';
import { CampaignTouch } from './models/CampaignTouch.js';
import { AttributionRun } from './models/AttributionRun.js';
import { AttributionResult } from './models/AttributionResult.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';

// Helper: get project id from query (accept projectId or workspaceId)
function getProjectId(req: Request) {
  const q = (req.query.projectId as string) || (req.query.workspaceId as string) || (req.body && req.body.projectId) || null;
  return q;
}

export async function stats(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // Total revenue from deals (closed_won = true)
    const totalRevenueRes = await Deal.aggregate([
      { $match: { project_id: projectOid, closed_won: true } },
      { $group: { _id: null, total: { $sum: '$revenue' } } },
    ]).exec();
    const totalRevenue = (totalRevenueRes[0] && totalRevenueRes[0].total) || 0;

    // Find latest successful attribution run for this project
    const latestRun = await AttributionRun.findOne({ project_id: projectOid, status: 'success' }).sort({ timestamp: -1 }).lean();

    let attributedTotal = 0;
    let campaignRevenue: Array<{ campaign_id: string; revenue: number; }> = [];
    let channelRevenue: Array<{ channel: string; revenue: number; }> = [];

    if (latestRun) {
      const results = await AttributionResult.aggregate([
        { $match: { run_id: latestRun._id, project_id: projectOid } },
        { $group: { _id: '$campaign_id', revenue: { $sum: '$revenue_share' } } },
      ]).exec();
      attributedTotal = results.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
      // Map campaign revenue and channel aggregation
      campaignRevenue = await Promise.all(results.map(async (r: any) => {
        const camp = await Campaign.findById(r._id).lean();
        return { campaign_id: String(r._id), revenue: r.revenue || 0, name: camp?.name || null, channel: (camp as any)?.channel || 'other' } as any;
      }));

      // aggregate by channel
      const channelMap: Record<string, number> = {};
      for (const c of campaignRevenue) {
        const ch = (c as any).channel || 'other';
        channelMap[ch] = (channelMap[ch] || 0) + (c as any).revenue;
      }
      channelRevenue = Object.keys(channelMap).map(k => ({ channel: k, revenue: channelMap[k] || 0 }));
    }

    // Campaign count and spend
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignCount = campaigns.length;
    const totalSpend = campaigns.reduce((s, c: any) => s + (c.spend || 0), 0);

    // Monthly totals (deals) - group by year-month
    const monthlyDealsAgg = await Deal.aggregate([
      { $match: { project_id: projectOid, closed_won: true } },
      { $project: { revenue: 1, ym: { $dateToString: { format: "%Y-%m", date: "$closed_at" } } } },
      { $group: { _id: "$ym", total: { $sum: "$revenue" } } },
      { $sort: { _id: 1 } }
    ]).exec();
    const monthlyDeals = monthlyDealsAgg.map((r: any) => ({ month: r._id, total: r.total }));

    // Monthly attributed totals: join AttributionResult -> Deal to get deal closed_at
    let monthlyAttributed: Array<{ month: string; total: number }> = [];
    if (latestRun) {
      const attribAgg = await AttributionResult.aggregate([
        { $match: { run_id: latestRun._id, project_id: projectOid } },
        { $lookup: { from: 'deals', localField: 'deal_id', foreignField: '_id', as: 'deal' } },
        { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
        { $project: { revenue_share: 1, ym: { $dateToString: { format: "%Y-%m", date: "$deal.closed_at" } } } },
        { $group: { _id: '$ym', total: { $sum: '$revenue_share' } } },
        { $sort: { _id: 1 } }
      ]).exec();
      monthlyAttributed = attribAgg.map((r: any) => ({ month: r._id, total: r.total }));
    }

    return res.json({
      ok: true,
      totalRevenue,
      attributedTotal,
      unattributed: Math.max(0, totalRevenue - attributedTotal),
      campaignCount,
      totalSpend,
      latestRun: latestRun ? { id: String(latestRun._id), run_id: latestRun.run_id, model_type: latestRun.model_type, timestamp: latestRun.timestamp, status: latestRun.status } : null,
      campaignRevenue,
      channelRevenue,
      monthlyDeals,
      monthlyAttributed,
    });
  } catch (e) {
    console.error('[m07/stats]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Helper: ensure the user (from Authorization header) is an active sales_manager or marketing_manager in workspace
async function ensureDeletePermission(req: Request, workspaceId: string | null) {
  try {
    const auth = req.header('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return false;
    const { verifyToken } = await import('../core/auth/utils/jwt.js');
    const payload = verifyToken(token as string);
    const userId = payload?.sub;
    if (!userId) return false;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return false;
    const member = await WorkspaceMember.findOne({ workspaceId, userId, status: 'active' }).lean();
    if (!member) return false;
    // only head_manager and sales_manager allowed to delete per requirements
    return member.role === 'sales_manager' || member.role === 'head_manager';
  } catch (e) {
    return false;
  }
}

export async function getRunResults(req: Request, res: Response) {
  try {
    const runId = (req.params.id as string) || (req.query.runId as string) || null;
    const projectId = getProjectId(req);
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const runOid = new mongoose.Types.ObjectId(runId);
    const projectOid = new mongoose.Types.ObjectId(projectId);

    const rows = await AttributionResult.find({ run_id: runOid, project_id: projectOid }).lean();
    const campaignIds = Array.from(new Set(rows.map(r => String(r.campaign_id))));
    const dealIds = Array.from(new Set(rows.map(r => String(r.deal_id))));

    const campaigns = await Campaign.find({ _id: { $in: campaignIds } }).lean();
    const deals = await Deal.find({ _id: { $in: dealIds } }).lean();

    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c._id)] = c;
    const dealMap: Record<string, any> = {};
    for (const d of deals) dealMap[String(d._id)] = d;

    const out = rows.map(r => ({ deal_id: String(r.deal_id), deal_external_id: dealMap[String(r.deal_id)]?.deal_id || null, campaign_id: String(r.campaign_id), campaignName: campaignMap[String(r.campaign_id)]?.name || null, revenue_share: r.revenue_share }));
    return res.json({ ok: true, results: out });
  } catch (e) {
    console.error('[m07/getRunResults]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    await Campaign.deleteOne({ _id: id }).exec();
    // Optionally remove touches and attribution results referencing this campaign
    await CampaignTouch.deleteMany({ campaign_id: id }).exec();
    await AttributionResult.deleteMany({ campaign_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m07/deleteCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    await Deal.deleteOne({ _id: id }).exec();
    await AttributionResult.deleteMany({ deal_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m07/deleteDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function runAttribution(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const modelType = (req.body && req.body.modelType) || (req.query.modelType as string) || 'linear';
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    const allowed = ['first_touch', 'last_touch', 'linear'];
    const model = allowed.includes(modelType) ? modelType : 'linear';

    // create a run stub
    const run = await AttributionRun.create({ run_id: `run-${Date.now()}`, project_id: projectOid, model_type: model as any, timestamp: new Date(), status: 'running', meta: { initiatedBy: 'api' } });

    // Gather campaigns for this project
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignIdSet = new Set(campaigns.map((c: any) => String(c._id)));

    // Gather deals (closed_won)
    const deals = await Deal.find({ project_id: projectOid, closed_won: true }).lean();
    const dealIds = deals.map(d => String(d._id));
    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));

    // Gather touches for these leads that reference campaigns in this project
    const touches = await CampaignTouch.find({ lead_id: { $in: leadIds }, campaign_id: { $in: Array.from(campaignIdSet) } }).sort({ touched_at: 1 }).lean();

    // Group touches by lead
    const touchesByLead: Record<string, Array<any>> = {};
    for (const t of touches) {
      const lid = String(t.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push(t);
    }

    const results: Array<any> = [];
    let dealsProcessed = 0;
    let totalRevenue = 0;
    let totalAttributed = 0;
    let validationErrors = 0;

    for (const deal of deals) {
      dealsProcessed++;
      const revenue = Number(deal.revenue) || 0;
      totalRevenue += revenue;
      const leadId = String(deal.lead_id);
      let touchesForLead = touchesByLead[leadId] || [];

      // If there are no campaign touches for this lead, try to fall back to any existing AttributionResult rows for the deal
      if (!touchesForLead || touchesForLead.length === 0) {
        const prev = await AttributionResult.find({ project_id: projectOid, deal_id: deal._id }).lean();
        if (prev && prev.length > 0) {
          // build touchesForLead from previous attribution rows (use deal.closed_at as touched_at)
          const seqPrev = Array.from(new Set(prev.map(p => String(p.campaign_id))));
          touchesForLead = seqPrev.map((cid: string) => ({ campaign_id: cid, touched_at: deal.closed_at || new Date(), type: 'other' }));
        } else {
          // still no touches -> unattributed
          continue;
        }
      }

      // derive ordered unique campaign sequence
      const seq: string[] = [];
      for (const t of touchesForLead) {
        const cid = String(t.campaign_id);
        if (seq.length === 0 || seq[seq.length - 1] !== cid) seq.push(cid);
      }

      if (seq.length === 0) continue;

      if (model === 'first_touch') {
        const cid = seq[0];
        const campRef = mongoose.isValidObjectId(cid) ? new mongoose.Types.ObjectId(cid) : cid;
        results.push({ run_id: run._id, project_id: projectOid, deal_id: deal._id, campaign_id: campRef, revenue_share: revenue });
        totalAttributed += revenue;
      } else if (model === 'last_touch') {
        const cid = seq[seq.length - 1];
        const campRef = mongoose.isValidObjectId(cid) ? new mongoose.Types.ObjectId(cid) : cid;
        results.push({ run_id: run._id, project_id: projectOid, deal_id: deal._id, campaign_id: campRef, revenue_share: revenue });
        totalAttributed += revenue;
      } else {
        // linear
        const n = seq.length;
        const per = n > 0 ? (revenue / n) : 0;
        // accumulate and correct rounding on last
        let acc = 0;
        for (let i = 0; i < seq.length; i++) {
          const cid = seq[i];
          const share = i === seq.length - 1 ? Number((revenue - acc).toFixed(2)) : Number(per.toFixed(2));
          acc += share;
          const campRef = mongoose.isValidObjectId(cid) ? new mongoose.Types.ObjectId(cid) : cid;
          results.push({ run_id: run._id, project_id: projectOid, deal_id: deal._id, campaign_id: campRef, revenue_share: share });
          totalAttributed += share;
        }
        // validate per-deal rounding
        const assigned = results.filter(r => String(r.deal_id) === String(deal._id)).reduce((s, r) => s + (r.revenue_share || 0), 0);
        if (Math.abs(assigned - revenue) > 0.5) {
          validationErrors++;
        }
      }
    }

    // Bulk insert results
    if (results.length > 0) {
      try {
        await AttributionResult.insertMany(results);
      } catch (ie) {
        console.error('[m07/runAttribution] insertMany error', ie);
      }
    }

    // update run status
    const finalStatus = validationErrors > 0 ? 'error' : 'success';
    run.status = finalStatus as any;
    run.meta = { dealsProcessed, totalRevenue, totalAttributed, resultCount: results.length, validationErrors };
    await run.save();

    return res.json({ ok: true, runId: String(run._id), runName: run.run_id, dealsProcessed, totalRevenue, totalAttributed, resultCount: results.length, validationErrors });
  } catch (e) {
    console.error('[m07/runAttribution]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function previewDeals(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // find recent closed deals
    const deals = await Deal.find({ project_id: projectOid, closed_won: true }).sort({ closed_at: -1 }).limit(10).lean();
    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));

    // get campaigns for project
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c._id)] = c;

    // touches for these leads (filter by campaign ids belonging to project)
    const campaignIds = Object.keys(campaignMap);
    const touches = await CampaignTouch.find({ lead_id: { $in: leadIds }, campaign_id: { $in: campaignIds } }).sort({ touched_at: 1 }).lean();

    const touchesByLead: Record<string, any[]> = {};
    for (const t of touches) {
      const lid = String(t.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push({ campaign_id: String(t.campaign_id), touched_at: t.touched_at, type: t.type, campaignName: campaignMap[String(t.campaign_id)]?.name || null });
    }

    // For leads without CampaignTouch rows, try to build a minimal journey using existing AttributionResult rows
    const leadsMissing = leadIds.filter(lid => !(touchesByLead[lid] && touchesByLead[lid].length > 0));
    if (leadsMissing.length > 0) {
      // find attribution results for deals in this preview
      const dealIds = deals.map(d => d._id);
      const prevRows = await AttributionResult.find({ project_id: projectOid, deal_id: { $in: dealIds } }).lean();
      for (const r of prevRows) {
        const dealIdStr = String(r.deal_id);
        const deal = deals.find(d => String(d._id) === dealIdStr);
        if (!deal) continue;
        const lid = String(deal.lead_id);
        touchesByLead[lid] = touchesByLead[lid] || [];
        const cid = String(r.campaign_id);
        if (!touchesByLead[lid].some(t => String(t.campaign_id) === cid)) {
          touchesByLead[lid].push({ campaign_id: cid, touched_at: deal.closed_at || new Date(), type: 'other', campaignName: campaignMap[cid]?.name || null });
        }
      }
      // sort each lead's touches by date
      for (const k of Object.keys(touchesByLead)) {
        if (!touchesByLead[k]) continue;
        touchesByLead[k].sort((a,b) => new Date(a.touched_at).getTime() - new Date(b.touched_at).getTime());
      }
    }

    const out = deals.map(d => ({ dealId: String(d._id), deal_external_id: (d as any).deal_id, revenue: d.revenue, lead_id: String(d.lead_id), closed_at: d.closed_at, journey: touchesByLead[String(d.lead_id)] || [] }));
    return res.json({ ok: true, deals: out });
  } catch (e) {
    console.error('[m07/previewDeals]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
