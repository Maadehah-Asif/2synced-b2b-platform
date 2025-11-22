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

// ROI dashboard data for Page 3
export async function roiDashboard(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // parse filters
    const channelFilter = (req.query.channel as string) || null; // single channel or comma-separated
    const startMonth = (req.query.start as string) || null; // YYYY-MM
    const endMonth = (req.query.end as string) || null; // YYYY-MM
    const minSpend = req.query.minSpend ? Number(req.query.minSpend) : null;
    const minROI = req.query.minROI ? Number(req.query.minROI) : null;

    // Precondition: ensure attribution results exist for this project
    const hasAttrib = await AttributionResult.findOne({ project_id: projectOid }).lean();
    if (!hasAttrib) return res.status(400).json({ error: 'no_attribution', message: 'No attribution results found. Please run attribution (Page 2) first.' });

    // Precondition: ensure there are campaigns with spend (required to compute ROI)
    const campaignsWithSpend = await Campaign.find({ project_id: projectOid, spend: { $gt: 0 } }).lean();
    if (!campaignsWithSpend || campaignsWithSpend.length === 0) return res.status(400).json({ error: 'no_campaign_spend', message: 'No campaigns with spend found for this project. Add campaign spend to compute ROI.' });

    // Build attributed sums per campaign, optionally limited to a date range (by deal.closed_at)
    const matchStage: any = { project_id: projectOid };
    // We'll join deals to filter by closed_at when start/end provided
    let attribByCampaign: any[] = [];
    if (startMonth || endMonth) {
      const startDate = startMonth ? new Date(startMonth + '-01') : new Date('1970-01-01');
      // set end to last day of month
      const endDate = endMonth ? new Date(new Date(endMonth + '-01').getFullYear(), new Date(endMonth + '-01').getMonth() + 1, 0, 23, 59, 59, 999) : new Date();
      attribByCampaign = await AttributionResult.aggregate([
        { $match: matchStage },
        { $lookup: { from: 'deals', localField: 'deal_id', foreignField: '_id', as: 'deal' } },
        { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
        { $match: { 'deal.closed_at': { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } }
      ]).exec();
    } else {
      attribByCampaign = await AttributionResult.aggregate([
        { $match: matchStage },
        { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } }
      ]).exec();
    }

    const campaignIds = attribByCampaign.map((r:any) => r._id).filter((id:any) => mongoose.isValidObjectId(id)).map((id:any) => new mongoose.Types.ObjectId(id));

    // 2) campaign details
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c._id)] = c;

    // Build campaign metrics array
    const campaignsMetrics = attribByCampaign.map((r:any) => {
      const cid = String(r._id);
      const camp = campaignMap[cid] || null;
      const spend = camp ? (Number(camp.spend) || 0) : 0;
      const attributed = Number(r.attributed) || 0;
      const profit = attributed - spend;
      const roi = spend === 0 ? null : ((attributed - spend) / (spend || 1)) * 100;
      return { campaign_id: cid, name: camp?.name || null, channel: camp?.channel || 'other', spend, attributed, profit, roi };
    });

    // Include campaigns with spend but zero attribution
    for (const c of campaigns) {
      const cid = String(c._id);
      if (!campaignsMetrics.find((m:any) => m.campaign_id === cid)) {
        const spend = Number(c.spend) || 0;
        campaignsMetrics.push({ campaign_id: cid, name: c.name, channel: c.channel || 'other', spend, attributed: 0, profit: -spend, roi: spend === 0 ? null : ((0 - spend) / spend) * 100 });
      }
    }

    // Apply filters: channel, minSpend, minROI
    let filteredCampaigns = campaignsMetrics;
    if (channelFilter) {
      const chans = channelFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      filteredCampaigns = filteredCampaigns.filter((c:any) => chans.includes(String(c.channel).toLowerCase()));
    }
    if (minSpend !== null) filteredCampaigns = filteredCampaigns.filter((c:any) => (c.spend||0) >= minSpend);
    if (minROI !== null) filteredCampaigns = filteredCampaigns.filter((c:any) => (c.roi === null ? -Infinity : c.roi) >= minROI);

    // Totals (after filters)
    const totalAttributed = filteredCampaigns.reduce((s:any,m:any) => s + (m.attributed||0), 0);
    const totalSpend = filteredCampaigns.reduce((s:any,m:any) => s + (m.spend||0), 0);
    const netProfit = totalAttributed - totalSpend;
    const overallROI = totalSpend === 0 ? null : ((totalAttributed - totalSpend) / (totalSpend || 1)) * 100;

    // Monthly attributed revenue series (by deal.closed_at)
    const monthlyPipeline: any[] = [
      { $match: { project_id: projectOid } },
      { $lookup: { from: 'deals', localField: 'deal_id', foreignField: '_id', as: 'deal' } },
      { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
      { $project: { revenue_share: 1, ym: { $dateToString: { format: '%Y-%m', date: '$deal.closed_at' } }, closed_at: '$deal.closed_at', campaign_id: '$campaign_id' } }
    ];
    // apply date filter if provided
    if (startMonth || endMonth) {
      const startDate = startMonth ? new Date(startMonth + '-01') : new Date('1970-01-01');
      const endDate = endMonth ? new Date(new Date(endMonth + '-01').getFullYear(), new Date(endMonth + '-01').getMonth() + 1, 0, 23, 59, 59, 999) : new Date();
      monthlyPipeline.push({ $match: { closed_at: { $gte: startDate, $lte: endDate } } });
    }
    // if channel filter provided, join campaigns and filter by channel
    if (channelFilter) {
      monthlyPipeline.push({ $lookup: { from: 'campaigns', localField: 'campaign_id', foreignField: '_id', as: 'campaign' } });
      monthlyPipeline.push({ $unwind: { path: '$campaign', preserveNullAndEmptyArrays: false } });
      const chans = channelFilter.split(',').map((s:string) => s.trim().toLowerCase()).filter(Boolean);
      monthlyPipeline.push({ $match: { 'campaign.channel': { $in: chans } } });
    }
    monthlyPipeline.push({ $group: { _id: '$ym', attributed: { $sum: '$revenue_share' } } });
    monthlyPipeline.push({ $sort: { _id: 1 } });
    const monthlyAttribAgg = await AttributionResult.aggregate(monthlyPipeline).exec();
    const monthlySeries = monthlyAttribAgg.map((r:any) => ({ month: r._id, attributed: r.attributed }));

    // Channel contribution (from filtered campaigns)
    const channelMap: Record<string, number> = {};
    for (const m of filteredCampaigns) {
      const ch = m.channel || 'other';
      channelMap[ch] = (channelMap[ch] || 0) + (m.attributed || 0);
    }
    const channelContribution = Object.keys(channelMap).map(k => ({ channel: k, attributed: channelMap[k] }));

    // Top/bottom lists
    const sortedByROI = [...filteredCampaigns].sort((a:any,b:any)=> {
      const ra = a.roi === null ? -Infinity : a.roi;
      const rb = b.roi === null ? -Infinity : b.roi;
      return rb - ra;
    });
    const top5 = sortedByROI.slice(0,5);
    const bottom5 = sortedByROI.slice(-5).reverse();

    return res.json({ ok: true, totalAttributed, totalSpend, netProfit, overallROI, campaigns: filteredCampaigns, monthlySeries, channelContribution, top5, bottom5 });
  } catch (e) {
    console.error('[m07/roiDashboard]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Forecasting endpoint for Page 4 (ROI Forecasting Dashboard)
export async function forecast(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // months ahead to forecast (default 6)
    const monthsAhead = req.query.months ? Math.max(1, Math.min(12, Number(req.query.months))) : 6;
    const targetROI = req.query.target ? Number(req.query.target) : null; // optional alert threshold (percent)

    // Get historical monthly attributed revenue (same as roiDashboard monthlySeries)
    const monthlyPipeline: any[] = [
      { $match: { project_id: projectOid } },
      { $lookup: { from: 'deals', localField: 'deal_id', foreignField: '_id', as: 'deal' } },
      { $unwind: { path: '$deal', preserveNullAndEmptyArrays: false } },
      { $project: { revenue_share: 1, ym: { $dateToString: { format: '%Y-%m', date: '$deal.closed_at' } }, closed_at: '$deal.closed_at' } },
      { $group: { _id: '$ym', attributed: { $sum: '$revenue_share' } } },
      { $sort: { _id: 1 } }
    ];
    const monthlyAttribAgg = await AttributionResult.aggregate(monthlyPipeline).exec();
    const monthlySeries = monthlyAttribAgg.map((r:any) => ({ month: r._id, attributed: Number(r.attributed || 0) }));

    if (!monthlySeries || monthlySeries.length < 6) {
      return res.status(400).json({ error: 'insufficient_history', message: 'Need at least 6 months of historical attributed revenue to forecast.' });
    }

    // Compute total spend for the project (used to approximate monthly spend)
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const totalSpend = campaigns.reduce((s:any, c:any) => s + (Number(c.spend) || 0), 0);
    const monthsCount = monthlySeries.length;
    const approxMonthlySpend = monthsCount > 0 ? (totalSpend / monthsCount) : 0;

    // Build arrays for regression: x = 0..n-1, y = attributed revenue
    const xs: number[] = monthlySeries.map((_, i) => i);
    const ys: number[] = monthlySeries.map((p:any) => p.attributed);
    const n = xs.length;
    const xMean = xs.reduce((a,b) => a+b, 0)/n;
    const yMean = ys.reduce((a,b) => a+b, 0)/n;
    const Sxx = xs.reduce((s, xi) => s + Math.pow(xi - xMean, 2), 0);
    // slope and intercept (simple linear regression)
    const slope = Sxx === 0 ? 0 : xs.reduce((s, xi, i) => s + (xi - xMean) * ((ys[i] || 0) - yMean), 0) / Sxx;
    const intercept = yMean - slope * xMean;

    // residuals & standard error
    const residuals = xs.map((xi, i) => (ys[i] || 0) - (intercept + slope * xi));
    const rss = residuals.reduce((s, r) => s + r*r, 0);
    const sigma2 = n > 2 ? rss / (n - 2) : 0;
    const sigma = Math.sqrt(Math.max(0, sigma2));

    // z for 80% CI (approx)
    const z80 = 1.28155;

    // Predict next months (month labels continue by adding months)
    const lastIdx = Math.max(0, monthlySeries.length - 1);
    const lastEntry = monthlySeries[lastIdx] || { month: '1970-01', attributed: 0 };
    const lastMonthStr = String(lastEntry.month || '1970-01'); // 'YYYY-MM'
    const parts = lastMonthStr.split('-');
    const lastYear = Number(parts[0]) || 1970;
    const lastM = Number(parts[1]) || 1;

    const predictions: any[] = [];
    for (let k = 1; k <= monthsAhead; k++) {
      const xi = n - 1 + k;
      const predY = intercept + slope * xi; // predicted attributed revenue
      // standard error for prediction
      const se_pred = Math.sqrt(sigma2 * (1 + (1/n) + Math.pow(xi - xMean, 2) / (Sxx || 1)));
      const minY = predY - z80 * se_pred;
      const maxY = predY + z80 * se_pred;

      // compute month label
      const date = new Date(lastYear, lastM -1 + k, 1);
      const mlabel = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');

      // future spend by default equals approxMonthlySpend; allow scenario param 'spendMultiplier' to scale
      const spendMultiplier = req.query.spendMultiplier ? Number(req.query.spendMultiplier) : 1;
      const futureSpend = approxMonthlySpend * (spendMultiplier || 1);

      const roi = futureSpend === 0 ? null : ((predY - futureSpend) / (futureSpend || 1)) * 100;
      const roiMin = futureSpend === 0 ? null : ((minY - futureSpend) / (futureSpend || 1)) * 100;
      const roiMax = futureSpend === 0 ? null : ((maxY - futureSpend) / (futureSpend || 1)) * 100;

      predictions.push({ month: mlabel, attributed: predY, attributed_min: minY, attributed_max: maxY, spend: futureSpend, roi, roi_min: roiMin, roi_max: roiMax });
    }

    // model accuracy metrics (on historical attribution predictions)
    const predsHistorical = xs.map(xi => intercept + slope * xi);
    const errors = ys.map((y,i)=> (y || 0) - (predsHistorical[i] || 0));
    const mae = errors.reduce((s,e)=> s + Math.abs(e), 0) / n;
    const mse = errors.reduce((s,e)=> s + e*e, 0) / n;

    // Alerts: if any future predicted ROI falls below targetROI parameter
    const alerts: string[] = [];
    if (targetROI !== null) {
      const below = predictions.filter(p => p.roi !== null && p.roi < targetROI);
      if (below.length > 0) alerts.push(`Forecasted ROI drops below target (${targetROI}%) in ${below.length} month(s).`);
    }
    // Trend indicator based on average of next 3 months vs previous 3 months
    const last3 = ys.slice(-3).reduce((s,v)=> s+v,0)/3;
    const next3 = predictions.slice(0,3).reduce((s:any,p:any)=> s + (p.attributed||0),0) / Math.min(3,predictions.length);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (next3 > last3 * 1.02) trend = 'up';
    else if (next3 < last3 * 0.98) trend = 'down';

    return res.json({ ok: true, model: { name: 'linear_regression', trained_at: new Date(), mae, mse }, historical: monthlySeries, approxMonthlySpend, totalSpend, predictions, alerts, trend });
  } catch (e) {
    console.error('[m07/forecast]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
