import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Deal } from './models/Deal.js';
import { Campaign } from './models/Campaign.js';
import { CampaignTouch } from './models/CampaignTouch.js';
import { importCampaignTouchesCSV } from './touchImportUtils.js';
import { AttributionRun } from './models/AttributionRun.js';
import { AttributionResult } from './models/AttributionResult.js';
import { CampaignSpend } from './models/CampaignSpend.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';
import Lead from '../m01/models/Lead.js';
import { CHANNEL_SET } from './constants.js';

// Helper: get project id from query (accept projectId or workspaceId)
function getProjectId(req: Request) {
  const q = (req.query.projectId as string) || (req.query.workspaceId as string) || (req.body && req.body.projectId) || null;
  return q;
}

const MAX_ALLOCATIONS_LIMIT = 100;

function sanitizeRegex(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function parseDateInput(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

type AllocationPipelineOptions = {
  projectOid: mongoose.Types.ObjectId;
  runOid: mongoose.Types.ObjectId;
  minShare?: number;
  channel?: string | null;
  closedFrom?: Date;
  closedTo?: Date;
  leadRegex?: RegExp | null;
  minDealAmount?: number;
  maxDealAmount?: number;
  status?: 'closed_won' | 'all' | 'open';
};

function buildAllocationBasePipeline(options: AllocationPipelineOptions, initialMatch: Record<string, any> = {}) {
  const baseMatch: Record<string, any> = {
    project_id: options.projectOid,
    run_id: options.runOid,
    ...initialMatch,
  };

  if (options.minShare !== undefined && !Number.isNaN(options.minShare)) {
    baseMatch.revenue_share = { $gte: options.minShare };
  }

  const pipeline: any[] = [
    { $match: baseMatch },
    { $lookup: { from: 'deals', localField: 'deal_id', foreignField: '_id', as: 'deal' } },
    { $unwind: '$deal' },
    { $lookup: { from: 'campaigns', localField: 'campaign_id', foreignField: '_id', as: 'campaign' } },
    { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        campaign_channel: {
          $toLower: {
            $ifNull: ['$campaign.channel', 'other']
          }
        }
      }
    }
  ];

  if (options.closedFrom || options.closedTo) {
    const closedMatch: Record<string, Date> = {};
    if (options.closedFrom) closedMatch.$gte = options.closedFrom;
    if (options.closedTo) closedMatch.$lte = options.closedTo;
    pipeline.push({ $match: { 'deal.closed_at': closedMatch } });
  }

  if (options.minDealAmount !== undefined && !Number.isNaN(options.minDealAmount)) {
    pipeline.push({ $match: { 'deal.revenue': { $gte: options.minDealAmount } } });
  }

  if (options.maxDealAmount !== undefined && !Number.isNaN(options.maxDealAmount)) {
    pipeline.push({ $match: { 'deal.revenue': { $lte: options.maxDealAmount } } });
  }

  if (options.status && options.status !== 'all') {
    if (options.status === 'closed_won') pipeline.push({ $match: { 'deal.closed_won': true } });
    else if (options.status === 'open') pipeline.push({ $match: { 'deal.closed_won': false } });
  }

  if (options.channel) {
    pipeline.push({ $match: { campaign_channel: options.channel } });
  }

  pipeline.push(
    { $lookup: { from: 'leads', localField: 'deal.lead_id', foreignField: '_id', as: 'lead' } },
    { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } }
  );

  if (options.leadRegex) {
    pipeline.push({
      $match: {
        $or: [
          { 'lead.First_Name': options.leadRegex },
          { 'lead.Last_Name': options.leadRegex },
          { 'lead.Email': options.leadRegex },
          { 'lead.Company': options.leadRegex }
        ]
      }
    });
  }

  return pipeline;
}

// Drill-down: deals for a specific campaign within a run
export async function allocationDealsForCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!campaignId || !mongoose.isValidObjectId(campaignId)) return res.status(400).json({ error: 'campaignId_required' });

    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);
    const campaignOid = new mongoose.Types.ObjectId(campaignId);

    const pipeline = buildAllocationBasePipeline({ projectOid, runOid }, { campaign_id: campaignOid });
    pipeline.push({ $limit: MAX_ALLOCATIONS_LIMIT });

    const rows = await AttributionResult.aggregate(pipeline).exec();
    const out = rows.map((r: any) => ({
      deal_id: String(r.deal._id),
      deal_amount: r.deal.revenue || 0,
      revenue_share: r.revenue_share || 0,
      closed_at: r.deal.closed_at,
      lead_name: r.lead ? `${r.lead.First_Name || ''} ${r.lead.Last_Name || ''}`.trim() || null : null,
      lead_email: r.lead?.Email || null,
    }));

    return res.json({ ok: true, allocations: out });
  } catch (e) {
    console.error('[m06/allocationDealsForCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Drill-down: campaigns for a specific deal within a run
export async function allocationCampaignsForDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    const dealId = req.query.dealId as string | undefined;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    if (!dealId || !mongoose.isValidObjectId(dealId)) return res.status(400).json({ error: 'dealId_required' });

    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);
    const dealOid = new mongoose.Types.ObjectId(dealId);

    const pipeline = buildAllocationBasePipeline({ projectOid, runOid }, { deal_id: dealOid });
    pipeline.push({ $limit: MAX_ALLOCATIONS_LIMIT });

    const rows = await AttributionResult.aggregate(pipeline).exec();
    const out = rows.map((r: any) => ({
      campaign_id: String(r.campaign?._id || r.campaign_id),
      campaign_name: r.campaign?.name || null,
      channel: r.campaign_channel || null,
      revenue_share: r.revenue_share || 0,
    }));

    return res.json({ ok: true, allocations: out });
  } catch (e) {
    console.error('[m06/allocationCampaignsForDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
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
    console.error('[m06/stats]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/allocation/campaigns?projectId=...&runId=...
export async function allocationByCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });

    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);

    const minShare = req.query.minShare !== undefined ? Number(req.query.minShare) : undefined;
    const channel = (req.query.channel as string | undefined) || null;
    const closedFrom = parseDateInput(req.query.closedFrom as string | undefined);
    const closedTo = parseDateInput(req.query.closedTo as string | undefined);
    const leadSearch = (req.query.lead as string | undefined) || '';
    const statusParam = (req.query.status as string | undefined) || 'all';
    const status = statusParam === 'closed_won' || statusParam === 'open' ? statusParam : 'all';

    const page = req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : 1;
    const limit = req.query.limit !== undefined ? Math.min(MAX_ALLOCATIONS_LIMIT, Math.max(1, Number(req.query.limit))) : 50;

    const leadRegex = leadSearch
      ? new RegExp(sanitizeRegex(leadSearch.trim()), 'i')
      : null;

    const options: AllocationPipelineOptions = {
      projectOid,
      runOid,
      minShare,
      channel,
      closedFrom,
      closedTo,
      leadRegex,
      status,
    };

    const basePipeline = buildAllocationBasePipeline(options);

    const summaryPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$campaign._id',
          campaign_id: { $first: '$campaign._id' },
          name: { $first: '$campaign.name' },
          channel: { $first: '$campaign_channel' },
          total_revenue: { $sum: '$revenue_share' },
          deal_ids: { $addToSet: '$deal._id' },
        },
      },
      {
        $project: {
          _id: 0,
          campaign_id: { $toString: '$campaign_id' },
          name: 1,
          channel: 1,
          total_revenue: 1,
          deal_count: { $size: '$deal_ids' },
          avg_revenue_per_deal: {
            $cond: [{ $gt: [{ $size: '$deal_ids' }, 0] }, { $divide: ['$total_revenue', { $size: '$deal_ids' }] }, 0],
          },
        },
      },
      { $sort: { total_revenue: -1 } },
      { $limit: MAX_ALLOCATIONS_LIMIT },
    ];

    const totalAgg = await AttributionResult.aggregate([
      ...basePipeline,
      { $group: { _id: '$campaign._id' } },
      { $count: 'total' },
    ]).exec();
    const total = totalAgg[0]?.total || 0;

    // Apply pagination to summary
    const pagedPipeline = [
      ...summaryPipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const summary = await AttributionResult.aggregate(pagedPipeline).exec();

    return res.json({ ok: true, campaigns: summary || [], page, limit, total });
  } catch (e) {
    console.error('[m06/allocationByCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/allocation/deals?projectId=...&runId=...
export async function allocationByDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });

    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);

    const minShare = req.query.minShare !== undefined ? Number(req.query.minShare) : undefined;
    const channel = (req.query.channel as string | undefined) || null;
    const closedFrom = parseDateInput(req.query.closedFrom as string | undefined);
    const closedTo = parseDateInput(req.query.closedTo as string | undefined);
    const leadSearch = (req.query.lead as string | undefined) || '';
    const statusParam = (req.query.status as string | undefined) || 'all';
    const status = statusParam === 'closed_won' || statusParam === 'open' ? statusParam : 'all';
    const minDealAmount = req.query.minDealAmount !== undefined ? Number(req.query.minDealAmount) : undefined;
    const maxDealAmount = req.query.maxDealAmount !== undefined ? Number(req.query.maxDealAmount) : undefined;

    const page = req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : 1;
    const limit = req.query.limit !== undefined ? Math.min(MAX_ALLOCATIONS_LIMIT, Math.max(1, Number(req.query.limit))) : 50;

    const leadRegex = leadSearch
      ? new RegExp(sanitizeRegex(leadSearch.trim()), 'i')
      : null;

    const options: AllocationPipelineOptions = {
      projectOid,
      runOid,
      minShare,
      channel,
      closedFrom,
      closedTo,
      leadRegex,
      minDealAmount,
      maxDealAmount,
      status,
    };

    const basePipeline = buildAllocationBasePipeline(options);

    const summaryPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$deal._id',
          deal_id: { $first: '$deal._id' },
          amount: { $first: '$deal.revenue' },
          closed_at: { $first: '$deal.closed_at' },
          closed_won: { $first: '$deal.closed_won' },
          lead: { $first: '$lead' },
          total_attributed: { $sum: '$revenue_share' },
          campaign_count: { $addToSet: '$campaign._id' },
        },
      },
      {
        $project: {
          _id: 0,
          deal_id: { $toString: '$deal_id' },
          amount: 1,
          closed_at: 1,
          closed_won: 1,
          lead_name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$lead.First_Name', ''] },
                  ' ',
                  { $ifNull: ['$lead.Last_Name', ''] },
                ],
              },
            },
          },
          lead_email: '$lead.Email',
          total_attributed: 1,
          unattributed: { $max: [{ $subtract: ['$amount', '$total_attributed'] }, 0] },
          campaign_count: { $size: '$campaign_count' },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: MAX_ALLOCATIONS_LIMIT },
    ];

    const totalAgg = await AttributionResult.aggregate([
      ...basePipeline,
      { $group: { _id: '$deal._id' } },
      { $count: 'total' },
    ]).exec();
    const total = totalAgg[0]?.total || 0;

    const pagedPipeline = [
      ...summaryPipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const deals = await AttributionResult.aggregate(pagedPipeline).exec();
    return res.json({ ok: true, deals, page, limit, total });
  } catch (e) {
    console.error('[m06/allocationByDeal]', e);
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
    console.error('[m06/getRunResults]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// --- Campaign management endpoints ---
// --- Campaign Touch management (Screen 2) ---
export async function createCampaignTouch(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const { leadId, campaignId, channel, type, touched_at, metadata } = req.body || {};
    if (!leadId || !mongoose.isValidObjectId(leadId)) return res.status(400).json({ error: 'leadId_required' });
    if (!campaignId || !mongoose.isValidObjectId(campaignId)) return res.status(400).json({ error: 'campaignId_required' });
    if (!touched_at) return res.status(400).json({ error: 'touched_at_required' });
    if (!type) return res.status(400).json({ error: 'type_required' });
    const dt = new Date(touched_at);
    if (isNaN(dt.getTime())) return res.status(400).json({ error: 'invalid_datetime' });

    // Resolve campaign for optional channel fallback
    let finalChannel = channel;
    if (!finalChannel && mongoose.isValidObjectId(campaignId)) {
      const camp = await Campaign.findById(campaignId).lean();
      if (camp) finalChannel = camp.channel;
    }

    const touch = await CampaignTouch.create({
      project_id: new mongoose.Types.ObjectId(projectId),
      lead_id: new mongoose.Types.ObjectId(leadId),
      campaign_id: new mongoose.Types.ObjectId(campaignId),
      channel: finalChannel,
      type,
      touched_at: dt,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      status: 'active'
    });
    return res.status(201).json({ ok: true, touch: { id: String(touch._id) } });
  } catch (e) {
    console.error('[m06/createCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listCampaignTouchesByCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const campaignId = (req.query.campaignId as string) || null;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!campaignId || !mongoose.isValidObjectId(campaignId)) return res.status(400).json({ error: 'campaignId_required' });
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const channelFilter = (req.query.channel as string) || '';
    const typeFilter = (req.query.type as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const statusFilter = (req.query.status as string) || '';
    const match: any = { campaign_id: new mongoose.Types.ObjectId(campaignId) };
    if (from || to) {
      match.touched_at = {};
      if (from) match.touched_at.$gte = new Date(from);
      if (to) match.touched_at.$lte = new Date(to);
    }
    if (channelFilter) match.channel = channelFilter;
    if (typeFilter) match.type = typeFilter;
    if (statusFilter) match.status = statusFilter; else if (!includeArchived) match.status = 'active';
    const rows = await CampaignTouch.find(match).sort({ touched_at: -1 }).limit(500).lean();
    return res.json({ ok: true, touches: rows.map(r => ({ id: String(r._id), lead_id: String(r.lead_id), campaign_id: String(r.campaign_id), channel: r.channel, type: r.type, touched_at: r.touched_at, status: r.status })) });
  } catch (e) {
    console.error('[m06/listCampaignTouchesByCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listCampaignTouchesByLead(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const leadId = (req.query.leadId as string) || null;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!leadId || !mongoose.isValidObjectId(leadId)) return res.status(400).json({ error: 'leadId_required' });
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const channelFilter = (req.query.channel as string) || '';
    const typeFilter = (req.query.type as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const statusFilter = (req.query.status as string) || '';
    const match: any = { lead_id: new mongoose.Types.ObjectId(leadId) };
    if (from || to) {
      match.touched_at = {};
      if (from) match.touched_at.$gte = new Date(from);
      if (to) match.touched_at.$lte = new Date(to);
    }
    if (channelFilter) match.channel = channelFilter;
    if (typeFilter) match.type = typeFilter;
    if (statusFilter) match.status = statusFilter; else if (!includeArchived) match.status = 'active';
    const rows = await CampaignTouch.find(match).sort({ touched_at: -1 }).limit(500).lean();
    return res.json({ ok: true, touches: rows.map(r => ({ id: String(r._id), lead_id: String(r.lead_id), campaign_id: String(r.campaign_id), channel: r.channel, type: r.type, touched_at: r.touched_at, status: r.status })) });
  } catch (e) {
    console.error('[m06/listCampaignTouchesByLead]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCampaignTouch(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).exec();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    const { channel, type, touched_at, metadata } = req.body || {};
    if (channel) touch.channel = channel;
    if (type) touch.type = type;
    if (touched_at) {
      const dt = new Date(touched_at);
      if (isNaN(dt.getTime())) return res.status(400).json({ error: 'invalid_datetime' });
      touch.touched_at = dt;
    }
    if (metadata !== undefined) touch.metadata = metadata && typeof metadata === 'object' ? metadata : undefined;
    await touch.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveCampaignTouch(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).exec();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    touch.status = 'archived';
    await touch.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveCampaignTouch]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteCampaignTouchPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const touch = await CampaignTouch.findById(id).lean();
    if (!touch) return res.status(404).json({ error: 'not_found' });
    if (touch.status !== 'archived') return res.status(400).json({ error: 'not_archived', message: 'Touch must be archived before permanent deletion.' });
    await CampaignTouch.deleteOne({ _id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteCampaignTouchPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importCampaignTouches(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const summary = await importCampaignTouchesCSV({ projectId, csv, map, startRow, endRow, campaignIdentifier, duplicatePolicy });
    return res.json({ ok: true, ...summary });
  } catch (e) {
    console.error('[m06/importCampaignTouches]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
export async function listCampaigns(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // Filters: search(name/id), channel, status, includeArchived, date ranges
    const search = (req.query.search as string) || '';
    const channel = (req.query.channel as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const status = (req.query.status as string) || '';
    const createdFrom = (req.query.createdFrom as string) || '';
    const createdTo = (req.query.createdTo as string) || '';
    const startFrom = (req.query.startFrom as string) || '';
    const startTo = (req.query.startTo as string) || '';

    const match: any = { project_id: projectOid };
    if (search) {
      const regex = new RegExp(search, 'i');
      match.$or = [{ name: regex }, { campaign_id: regex }];
    }
    if (channel) match.channel = channel;
    if (status) match.status = status;
    else if (!includeArchived) match.status = 'active';
    // created date range
    if (createdFrom || createdTo) {
      match.createdAt = {};
      if (createdFrom) match.createdAt.$gte = new Date(createdFrom);
      if (createdTo) match.createdAt.$lte = new Date(createdTo);
    }
    // start date range
    if (startFrom || startTo) {
      match.start_date = {};
      if (startFrom) match.start_date.$gte = new Date(startFrom);
      if (startTo) match.start_date.$lte = new Date(startTo);
    }

    const camps = await Campaign.find(match).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, campaigns: camps.map((c:any)=> ({ id: String(c._id), campaign_id: c.campaign_id, name: c.name, channel: c.channel, start_date: c.start_date, end_date: c.end_date, spend: c.spend || 0, status: c.status || 'active', created_at: c.createdAt, description: c.description || null, tags: c.tags || [] })) });
  } catch (e) {
    console.error('[m06/listCampaigns]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function createCampaign(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const { name, channel, startDate, endDate, description, tags, spend } = req.body || {};
    if (!name || !channel) return res.status(400).json({ error: 'name_channel_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);
    const campaign = await Campaign.create({ campaign_id: `camp-${Date.now()}`, project_id: projectOid, channel, name: name.trim(), description: description || null, tags: Array.isArray(tags) ? tags : [], start_date: startDate ? new Date(startDate) : null, end_date: endDate ? new Date(endDate) : null, spend: Number(spend) || 0 });
    return res.status(201).json({ ok: true, campaign: { id: String(campaign._id), name: campaign.name } });
  } catch (e) {
    console.error('[m06/createCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const { name, channel, startDate, endDate, description, tags, status } = req.body || {};
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    if (name) camp.name = name;
    if (channel) camp.channel = channel;
    if (description !== undefined) camp.description = description;
    if (tags !== undefined) camp.tags = Array.isArray(tags) ? (tags as string[]) : null;
    if (startDate !== undefined) camp.start_date = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) camp.end_date = endDate ? new Date(endDate) : null;
    if (status) camp.status = status;
    await camp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    camp.status = 'archived' as any;
    await camp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function addSpendEntry(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const { date, amount, source, note } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    if (!date || amount === undefined) return res.status(400).json({ error: 'date_amount_required' });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    const projectOid = camp.project_id;
    const ds = new Date(date);
    const spend = await CampaignSpend.create({ campaign_id: camp._id, project_id: projectOid, date: ds, amount: Number(amount) || 0, source: source || 'manual', note: note || null });
    // update total spend on campaign
    camp.spend = (Number(camp.spend) || 0) + Number(amount || 0);
    await camp.save();
    return res.status(201).json({ ok: true, spend: { id: String(spend._id), date: spend.date, amount: spend.amount } });
  } catch (e) {
    console.error('[m06/addSpendEntry]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Accept CSV text in body.csv. Simple parser: first row header
export async function uploadSpendCSV(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const { csv, dateColumn, amountColumn, startRow } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());
    const dcol = dateColumn ? header.indexOf(dateColumn) : 0;
    const acol = amountColumn ? header.indexOf(amountColumn) : 1;
    if (dcol < 0 || acol < 0) return res.status(400).json({ error: 'columns_not_found', header });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    let inserted = 0;
    const srow = startRow ? Number(startRow) : 1;
    for (let i = srow; i < lines.length; i++) {
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const d = cols[dcol];
      const a = parseFloat((cols[acol] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const date = new Date(String(d));
      if (isNaN(date.getTime())) continue;
      await CampaignSpend.create({ campaign_id: camp._id, project_id: camp.project_id, date, amount: a, source: 'csv' });
      camp.spend = (Number(camp.spend) || 0) + a;
      inserted++;
    }
    await camp.save();
    return res.json({ ok: true, inserted });
  } catch (e) {
    console.error('[m06/uploadSpendCSV]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Accept CSV text for multiple campaigns in a project. Body: { csv, campaignColumn?, dateColumn?, amountColumn?, startRow?, projectId? }
export async function uploadSpendCSVMulti(req: Request, res: Response) {
  try {
    const { csv, campaignColumn, dateColumn, amountColumn, startRow } = req.body || {};
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());

    // determine columns
    const ccol = typeof campaignColumn === 'string' && campaignColumn ? header.indexOf(campaignColumn) : header.findIndex(h => /campaign|campaign_id|campaign name|campaignname/i.test(h));
    const dcol = typeof dateColumn === 'string' && dateColumn ? header.indexOf(dateColumn) : header.findIndex(h => /date|day|dt/i.test(h));
    const acol = typeof amountColumn === 'string' && amountColumn ? header.indexOf(amountColumn) : header.findIndex(h => /amount|cost|spend|value|price/i.test(h));
    const campaignCol = ccol >= 0 ? ccol : 0;
    const dateCol = dcol >= 0 ? dcol : 1;
    const amountCol = acol >= 0 ? acol : 2;

    let inserted = 0;
    const srow = startRow ? Number(startRow) : 1;

    // cache campaigns found/created by identifier string
    const campaignMap: Record<string, any> = {};

    for (let i = srow; i < lines.length; i++) {
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const campVal = (cols[campaignCol] || '').trim();
      const d = cols[dateCol];
      const aRaw = cols[amountCol] || '0';
      const a = parseFloat(aRaw.replace(/[^0-9.-]/g, '')) || 0;
      if (!d) continue;
      const date = new Date(d);
      if (isNaN(date.getTime())) continue;

      const key = campVal || '__unknown__';
      let campDoc = campaignMap[key];
      if (!campDoc) {
        // try to find existing campaign by campaign_id or name within this project
        const found = await Campaign.findOne({ project_id: projectOid, $or: [{ campaign_id: key }, { name: key }] }).exec();
        if (found) campDoc = found;
        else {
          campDoc = await Campaign.create({ campaign_id: `camp-${Date.now()}-${Math.floor(Math.random()*1000)}`, project_id: projectOid, channel: 'other', name: key || `Imported ${Date.now()}`, description: null, tags: [], spend: 0 });
        }
        campaignMap[key] = campDoc;
      }

      await CampaignSpend.create({ campaign_id: campDoc._id, project_id: projectOid, date, amount: a, source: 'csv' });
      campDoc.spend = (Number(campDoc.spend) || 0) + a;
      inserted++;
    }

    // persist campaign spend totals
    for (const k of Object.keys(campaignMap)) {
      try { await campaignMap[k].save(); } catch (e) { /* ignore per-campaign save errors */ }
    }

    return res.json({ ok: true, inserted, campaigns: Object.keys(campaignMap).length });
  } catch (e) {
    console.error('[m06/uploadSpendCSVMulti]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listSpendEntries(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const rows = await CampaignSpend.find({ campaign_id: id }).sort({ date: -1 }).lean();
    return res.json({ ok: true, rows: rows.map((r:any)=> ({ id: String(r._id), date: r.date, amount: r.amount, source: r.source, note: r.note })) });
  } catch (e) {
    console.error('[m06/listSpendEntries]', e);
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
    console.error('[m06/deleteCampaign]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Permanent delete with role checks; may block if dependencies exist
export async function deleteCampaignPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });

    // Optional safeguard: block deletion if attribution results exist
    const deps = await AttributionResult.findOne({ campaign_id: new mongoose.Types.ObjectId(id) }).lean();
    if (deps) return res.status(400).json({ error: 'has_history', message: 'Campaign has attribution history; archive instead.' });

    await Campaign.deleteOne({ _id: id }).exec();
    await CampaignTouch.deleteMany({ campaign_id: id }).exec();
    await CampaignSpend.deleteMany({ campaign_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteCampaignPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Bulk CSV import for campaigns: maps headers and creates campaigns
export async function importCampaignsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);
    const { csv, map } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });

    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());

    function idx(name: string | null | undefined, fallback: number | null = null) {
      if (!name) return fallback;
      const i = header.indexOf(String(name));
      return i >= 0 ? i : fallback;
    }

    const nameIdx = idx(map.name, null);
    const channelIdx = idx(map.channel, null);
    const startIdx = idx(map.start_date, null);
    const endIdx = idx(map.end_date, null);
    const descIdx = idx(map.description, null);
    const spendIdx = idx(map.spend, null);

    if (nameIdx === null || channelIdx === null) {
      return res.status(400).json({ error: 'required_mapping_missing', required: ['name', 'channel'], header });
    }

    const startRow = Number(req.body.startRow || 1);
    const endRow = req.body.endRow ? Number(req.body.endRow) : (lines.length - 1);
    if (startRow < 1 || endRow < startRow) return res.status(400).json({ error: 'invalid_row_range' });

    const allowedChannels = new Set(['email','ads','linkedin','webinar','other']);
    let created = 0, skipped = 0;
    const errors: Array<{ row: number, reason: string }> = [];

    for (let i = startRow; i <= endRow; i++) {
      const rowNum = i + 1; // account for header
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const name = cols[nameIdx] || '';
      const channel = (cols[channelIdx] || '').toLowerCase();
      const start = startIdx !== null ? cols[startIdx] : '';
      const end = endIdx !== null ? cols[endIdx] : '';
      const desc = descIdx !== null ? cols[descIdx] : '';
      const spendRaw = spendIdx !== null ? cols[spendIdx] : '';

      if (!name) { skipped++; errors.push({ row: rowNum, reason: 'name_missing' }); continue; }
      const finalChannel = allowedChannels.has(channel) ? channel : 'other';

      // Duplicate name: optionally skip (soft rule)
      const dup = await Campaign.findOne({ project_id: projectOid, name }).lean();
      if (dup) { skipped++; errors.push({ row: rowNum, reason: 'duplicate_name' }); continue; }

      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;
      if (start) {
        const sd = new Date(start);
        if (!isNaN(sd.getTime())) startDate = sd; else errors.push({ row: rowNum, reason: 'invalid_start_date' });
      }
      if (end) {
        const ed = new Date(end);
        if (!isNaN(ed.getTime())) endDate = ed; else errors.push({ row: rowNum, reason: 'invalid_end_date' });
      }
      const spend = spendRaw ? Number(String(spendRaw).replace(/[^0-9.-]/g, '')) : 0;

      await Campaign.create({
        campaign_id: `camp-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        project_id: projectOid,
        name,
        channel: finalChannel as any,
        start_date: startDate,
        end_date: endDate,
        description: desc || undefined,
        spend: spend || 0,
        status: 'active' as any,
      });
      created++;
    }

    return res.json({ ok: true, created, skipped, errors, selected: (endRow - startRow + 1) });
  } catch (e) {
    console.error('[m06/importCampaignsCSV]', e);
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
    console.error('[m06/deleteDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// --- Deals management (Screen 3) ---
export async function createDeal(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const { deal_id, lead_id, amount, currency, closed_won, closed_at, stage, notes } = req.body || {};
    if (!lead_id || !mongoose.isValidObjectId(lead_id)) return res.status(400).json({ error: 'lead_id_required' });
    const revenue = Number(amount);
    if (isNaN(revenue) || revenue < 0) return res.status(400).json({ error: 'amount_invalid' });
    const cw = Boolean(closed_won);
    let closedAt: Date | undefined = undefined;
    if (cw) {
      if (!closed_at) return res.status(400).json({ error: 'closed_at_required' });
      const dt = new Date(closed_at);
      if (isNaN(dt.getTime())) return res.status(400).json({ error: 'closed_at_invalid' });
      closedAt = dt;
    }
    // unique deal_id if provided
    if (deal_id) {
      const dup = await Deal.findOne({ deal_id }).lean();
      if (dup) return res.status(409).json({ error: 'duplicate_deal_id' });
    }
    const doc = await Deal.create({
      deal_id: deal_id || `deal-${Date.now()}`,
      lead_id: new mongoose.Types.ObjectId(lead_id),
      project_id: new mongoose.Types.ObjectId(projectId),
      revenue,
      closed_won: cw,
      closed_at: closedAt,
    });
    return res.status(201).json({ ok: true, deal: { id: String(doc._id) } });
  } catch (e) {
    console.error('[m06/createDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listDeals(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const match: any = { project_id: new mongoose.Types.ObjectId(projectId) };
    const leadId = (req.query.leadId as string) || '';
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const status = (req.query.status as string) || '';
    const minAmount = req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined;
    const maxAmount = req.query.maxAmount !== undefined ? Number(req.query.maxAmount) : undefined;
    const stage = (req.query.stage as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    if (leadId && mongoose.isValidObjectId(leadId)) match.lead_id = new mongoose.Types.ObjectId(leadId);
    if (from || to) {
      match.closed_at = {};
      if (from) match.closed_at.$gte = new Date(from);
      if (to) match.closed_at.$lte = new Date(to);
    }
    if (status) {
      // interpret common strings; otherwise pass-through
      if (status === 'closed_won') match.closed_won = true;
      else if (status === 'open') match.closed_won = false;
    }
    if (minAmount !== undefined) match.revenue = { ...(match.revenue || {}), $gte: minAmount };
    if (maxAmount !== undefined) match.revenue = { ...(match.revenue || {}), $lte: maxAmount };
    if (stage) match.stage = stage;
    if (!includeArchived) match.status = { $ne: 'archived' };
    const rows = await Deal.find(match).sort({ closed_at: -1, createdAt: -1 }).limit(500).lean();
    return res.json(rows.map(r => ({ _id: String(r._id), deal_id: r.deal_id, lead_id: String(r.lead_id), amount: r.revenue, currency: (r as any).currency || 'USD', closed_won: r.closed_won, closed_at: r.closed_at, stage: (r as any).stage || undefined, notes: (r as any).notes || undefined, status: (r as any).status || 'active' })));
  } catch (e) {
    console.error('[m06/listDeals]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const d = await Deal.findById(id).exec();
    if (!d) return res.status(404).json({ error: 'not_found' });
    const { amount, currency, closed_won, closed_at, stage, notes } = req.body || {};
    if (amount !== undefined) {
      const v = Number(amount);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'amount_invalid' });
      d.revenue = v;
    }
    if (currency !== undefined) (d as any).currency = currency;
    if (closed_won !== undefined) d.closed_won = Boolean(closed_won);
    if (closed_at !== undefined) {
      if (closed_at) {
        const dt = new Date(closed_at);
        if (isNaN(dt.getTime())) return res.status(400).json({ error: 'closed_at_invalid' });
        d.closed_at = dt;
      } else {
        d.closed_at = null;
      }
    }
    if (stage !== undefined) (d as any).stage = stage || undefined;
    if (notes !== undefined) (d as any).notes = notes || undefined;
    await d.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/updateDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveDeal(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    const d = await Deal.findById(id).exec();
    if (!d) return res.status(404).json({ error: 'not_found' });
    (d as any).status = 'archived';
    await d.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m06/archiveDeal]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteDealPermanent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspaceId = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });
    // Enforce role-based permission similar to campaign deletion
    const ok = await ensureDeletePermission(req, workspaceId);
    if (!ok) return res.status(403).json({ error: 'not_authorized' });
    const d = await Deal.findById(id).lean();
    if (!d) return res.status(404).json({ error: 'not_found' });
    if ((d as any).status !== 'archived') return res.status(400).json({ error: 'not_archived', message: 'Deal must be archived before permanent deletion.' });
    await Deal.deleteOne({ _id: id }).exec();
    await AttributionResult.deleteMany({ deal_id: id }).exec();
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m06/deleteDealPermanent]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function importDealsCSV(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const { csv, map, startRow, endRow, duplicatePolicy } = req.body || {};
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv_required' });
    if (!map || typeof map !== 'object') return res.status(400).json({ error: 'mapping_required' });
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return res.status(400).json({ error: 'csv_no_rows' });
    const header = (lines[0] || '').split(',').map(h => h.trim());

    function idx(name: string | null | undefined, fallback: number | null = null) {
      if (!name) return fallback;
      const i = header.indexOf(String(name));
      return i >= 0 ? i : fallback;
    }
    function findByAliases(aliases: string[]): number | null {
      for (const a of aliases) {
        const i = header.findIndex(h => h.trim().toLowerCase() === a.toLowerCase());
        if (i >= 0) return i;
      }
      // loose regex match
      for (const a of aliases) {
        const re = new RegExp(a.replace(/[^a-z0-9]/gi, '').replace(/\s+/g,'').toLowerCase(), 'i');
        const i = header.findIndex(h => h.replace(/[^a-z0-9]/gi,'').toLowerCase().includes(re.source));
        if (i >= 0) return i;
      }
      return null;
    }

    const dealIdIdx = idx(map.deal_id, null) ?? findByAliases(['deal_id','id','external_id']);
    const leadIdx = idx(map.lead, null) ?? findByAliases(['lead','lead_id','email','lead_email']);
    const amountIdx = idx(map.amount, null) ?? findByAliases(['amount','value','revenue']);
    const currencyIdx = idx(map.currency, null) ?? findByAliases(['currency','curr']);
    const wonIdx = idx(map.closed_won, null) ?? findByAliases(['closed_won','won','is_won','status']);
    const closedAtIdx = idx(map.closed_at, null) ?? findByAliases(['closed_at','closed','close_date']);
    const stageIdx = idx(map.stage, null) ?? findByAliases(['stage','pipeline_stage','status']);
    const notesIdx = idx(map.notes, null) ?? findByAliases(['notes','note','comments']);

    if (leadIdx === null || amountIdx === null) {
      return res.status(400).json({ error: 'required_mapping_missing', required: ['lead','amount'], header });
    }

    const srow = Number(startRow || 1);
    const erow = endRow ? Number(endRow) : (lines.length - 1);
    if (srow < 1 || erow < srow) return res.status(400).json({ error: 'invalid_row_range' });

    let processed = 0, inserted = 0, failed = 0, duplicates = 0;
    const failedRows: Array<{ row: number; error: string }> = [];

    // cache lead lookups by id or email string
    const leadCache: Record<string, string> = {};

    for (let i = srow; i <= erow; i++) {
      processed++;
      const rowNum = i + 1;
      const cols = (lines[i] || '').split(',').map(c => c.trim());
      const dealId = dealIdIdx !== null ? (cols[dealIdIdx] || '') : '';
      const leadVal = (cols[leadIdx] || '').trim();
      const amountRaw = amountIdx !== null ? (cols[amountIdx] || '') : '';
      const currency = currencyIdx !== null ? (cols[currencyIdx] || '') : '';
      const wonVal = wonIdx !== null ? (cols[wonIdx] || '') : '';
      const closedAtVal = closedAtIdx !== null ? (cols[closedAtIdx] || '') : '';
      const stageVal = stageIdx !== null ? (cols[stageIdx] || '') : '';
      const notesVal = notesIdx !== null ? (cols[notesIdx] || '') : '';

      // resolve lead: numeric id or email
      let leadId: string | null = null;
      if (/^\d+$/.test(leadVal)) {
        // numeric lead_id from m01 Lead model
        const found = await Lead.findOne({ lead_id: Number(leadVal) }).select('_id').lean();
        if (found) leadId = String(found._id);
      } else if (leadVal) {
        const key = leadVal.toLowerCase();
        if (leadCache[key]) leadId = leadCache[key];
        else {
          const found = await Lead.findOne({ Email: leadVal }).select('_id').lean();
          if (found) { leadId = String(found._id); leadCache[key] = leadId; }
        }
      }
      if (!leadId) { failed++; failedRows.push({ row: rowNum, error: 'lead_not_found' }); continue; }

      const revenue = Number(String(amountRaw).replace(/[^0-9.-]/g, ''));
      if (isNaN(revenue) || revenue < 0) { failed++; failedRows.push({ row: rowNum, error: 'amount_invalid' }); continue; }

      const cw = /^(1|true|yes|y)$/i.test(wonVal);
      let closedAt: Date | undefined = undefined;
      if (cw) {
        const dt = new Date(closedAtVal);
        if (isNaN(dt.getTime())) { failed++; failedRows.push({ row: rowNum, error: 'closed_at_invalid' }); continue; }
        closedAt = dt;
      }

      if (dealId) {
        const dup = await Deal.findOne({ deal_id: dealId }).lean();
        if (dup) {
          duplicates++;
          if (duplicatePolicy === 'skip') { continue; }
          else { failed++; failedRows.push({ row: rowNum, error: 'duplicate_deal_id' }); continue; }
        }
      }

      try {
        await Deal.create({
          deal_id: dealId || `deal-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          lead_id: new mongoose.Types.ObjectId(leadId),
          project_id: new mongoose.Types.ObjectId(projectId),
          revenue,
          closed_won: cw,
          closed_at: closedAt,
          // optional passthrough
          ...(currency ? { currency } : {}),
          ...(stageVal ? { stage: stageVal } : {}),
          ...(notesVal ? { notes: notesVal } : {}),
        } as any);
        inserted++;
      } catch (ie:any) {
        failed++;
        failedRows.push({ row: rowNum, error: ie.message || 'insert_failed' });
      }
    }

    return res.json({ ok: true, processed, inserted, failed, duplicates, failedRows });
  } catch (e) {
    console.error('[m06/importDealsCSV]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function runAttribution(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    const toArray = (input: unknown): string[] => {
      if (Array.isArray(input)) return input.map(val => String(val));
      if (typeof input === 'string') {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    const modelType = (req.body && req.body.model_type) || req.body?.modelType || (req.query.modelType as string) || 'linear';
    const dateFromRaw = req.body?.date_from || req.query.date_from;
    const dateToRaw = req.body?.date_to || req.query.date_to;
    const closedWonOnly = req.body?.closedWonOnly === true || req.query.closedWonOnly === 'true';
    const minAmount = req.body?.minAmount !== undefined ? Number(req.body.minAmount) : (req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined);
    const includeArchived = req.body?.includeArchived === true || req.query.includeArchived === 'true';

    const channelInput = req.body?.requiredChannels
      ?? req.body?.channels
      ?? req.query.channels
      ?? req.query.channel;
    const requiredChannelSet = new Set(
      toArray(channelInput)
        .map(ch => ch.toLowerCase())
        .filter(ch => CHANNEL_SET.has(ch))
    );

    const campaignInput = req.body?.requiredCampaignIds
      ?? req.body?.campaignIds
      ?? req.query.campaignIds
      ?? req.query.campaignId;
    const rawCampaignIds = new Set(
      toArray(campaignInput)
        .map(id => id.trim())
        .filter(id => mongoose.isValidObjectId(id))
    );

    if (!dateFromRaw || !dateToRaw) return res.status(400).json({ error: 'date_range_required' });
    const dateFrom = new Date(dateFromRaw);
    const dateTo = new Date(dateToRaw);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) return res.status(400).json({ error: 'invalid_dates' });
    if (dateFrom.getTime() > dateTo.getTime()) return res.status(400).json({ error: 'start_after_end' });

    const existingRunning = await AttributionRun.findOne({ project_id: projectOid, status: 'running' }).lean();
    if (existingRunning) return res.status(409).json({ error: 'run_in_progress' });

    const allowedModels = ['first_touch', 'last_touch', 'linear'];
    const model = allowedModels.includes(modelType) ? modelType : 'linear';

    const dealMatch: any = { project_id: projectOid, closed_at: { $gte: dateFrom, $lte: dateTo } };
    if (closedWonOnly) dealMatch.closed_won = true;
    if (minAmount !== undefined && !Number.isNaN(minAmount)) dealMatch.revenue = { $gte: minAmount };
    if (!includeArchived) dealMatch.status = { $ne: 'archived' };

    const deals = await Deal.find(dealMatch).lean();
    if (!deals || deals.length === 0) return res.status(400).json({ error: 'no_deals_in_window' });

    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    const projectCampaignIds = new Set<string>();
    for (const campaign of campaigns) {
      const id = String(campaign._id);
      campaignMap[id] = campaign;
      projectCampaignIds.add(id);
    }

    const requiredCampaignIds = Array.from(rawCampaignIds).filter(id => projectCampaignIds.has(id));
    const requiredCampaignSet = new Set(requiredCampaignIds);
    const filtersApplied = requiredChannelSet.size > 0 || requiredCampaignSet.size > 0;

    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));
    const touches = await CampaignTouch.find({
      lead_id: { $in: leadIds },
      campaign_id: { $in: Array.from(projectCampaignIds) }
    }).sort({ touched_at: 1 }).lean();
    const touchesByLead: Record<string, Array<any>> = {};
    for (const touch of touches) {
      const lid = String(touch.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push(touch);
    }

    const runObjectId = new mongoose.Types.ObjectId();
    let totalRevenue = 0;
    let totalAttributed = 0;
    let dealsWithJourneys = 0;
    let dealsWithoutJourneys = 0;
    let dealsIncluded = 0;
    let excludedByChannel = 0;
    let excludedByCampaign = 0;
    let excludedNoTouches = 0;
    const results: any[] = [];

    const getTouchChannel = (touch: any): string => {
      const fromTouch = typeof touch.channel === 'string' ? touch.channel.toLowerCase() : '';
      if (fromTouch && CHANNEL_SET.has(fromTouch)) return fromTouch;
      const campaignId = String(touch.campaign_id);
      const campaignChannel = (campaignMap[campaignId]?.channel || '').toLowerCase();
      return CHANNEL_SET.has(campaignChannel) ? campaignChannel : 'other';
    };

    for (const deal of deals) {
      const revenue = Number(deal.revenue) || 0;
      const leadId = String(deal.lead_id);
      const allTouches = (touchesByLead[leadId] || []).filter(t => {
        if (!deal.closed_at) return true;
        return new Date(t.touched_at).getTime() <= new Date(deal.closed_at as any).getTime();
      });

      if (!allTouches.length) {
        if (filtersApplied) {
          excludedNoTouches++;
          continue;
        }
        totalRevenue += revenue;
        dealsWithoutJourneys++;
        continue;
      }

      const hasRequiredChannel = requiredChannelSet.size === 0
        || allTouches.some(touch => requiredChannelSet.has(getTouchChannel(touch)));
      if (!hasRequiredChannel) {
        if (filtersApplied) excludedByChannel++;
        continue;
      }

      const hasRequiredCampaign = requiredCampaignSet.size === 0
        || allTouches.some(touch => requiredCampaignSet.has(String(touch.campaign_id)));
      if (!hasRequiredCampaign) {
        if (filtersApplied) excludedByCampaign++;
        continue;
      }

      totalRevenue += revenue;
      dealsIncluded++;

      const sequence: string[] = [];
      for (const touch of allTouches) {
        const campaignId = String(touch.campaign_id);
        if (!projectCampaignIds.has(campaignId)) continue;
        if (sequence.length === 0 || sequence[sequence.length - 1] !== campaignId) {
          sequence.push(campaignId);
        }
      }

      if (!sequence.length) {
        dealsWithoutJourneys++;
        continue;
      }

      dealsWithJourneys++;

      if (model === 'first_touch') {
        const cid = sequence[0];
        results.push({ run_id: runObjectId, project_id: projectOid, deal_id: deal._id, campaign_id: new mongoose.Types.ObjectId(cid), revenue_share: revenue });
        totalAttributed += revenue;
      } else if (model === 'last_touch') {
        const cid = sequence[sequence.length - 1];
        results.push({ run_id: runObjectId, project_id: projectOid, deal_id: deal._id, campaign_id: new mongoose.Types.ObjectId(cid), revenue_share: revenue });
        totalAttributed += revenue;
      } else {
        const n = sequence.length;
        const perShare = n > 0 ? revenue / n : 0;
        let allocated = 0;
        for (let i = 0; i < sequence.length; i++) {
          const cid = sequence[i];
          const isLast = i === sequence.length - 1;
          const share = isLast ? Number((revenue - allocated).toFixed(2)) : Number(perShare.toFixed(2));
          allocated += share;
          results.push({ run_id: runObjectId, project_id: projectOid, deal_id: deal._id, campaign_id: new mongoose.Types.ObjectId(cid), revenue_share: share });
          totalAttributed += share;
        }
      }
    }

    const dealCountForRun = dealsIncluded + dealsWithoutJourneys;

    if (filtersApplied && dealCountForRun === 0) {
      return res.status(400).json({
        error: 'no_deals_after_filters',
        details: {
          excludedByFilters: {
            channels: excludedByChannel,
            campaigns: excludedByCampaign,
            noTouches: excludedNoTouches
          }
        }
      });
    }

    const touchesUsed = results.length;
    const unattributed = totalRevenue - totalAttributed;
    const campaignCount = new Set(results.map(r => String(r.campaign_id))).size;

    const runDoc = await AttributionRun.create({
      _id: runObjectId,
      run_id: `run-${Date.now()}`,
      project_id: projectOid,
      model_type: model as any,
      timestamp: new Date(),
      status: 'success',
      date_from: dateFrom,
      date_to: dateTo,
      deal_count: dealCountForRun,
      deals_with_journeys: dealsWithJourneys,
      deals_without_journeys: dealsWithoutJourneys,
      total_revenue: Number(totalRevenue.toFixed(2)),
      attributed_revenue: Number(totalAttributed.toFixed(2)),
      unattributed_revenue: Number(unattributed.toFixed(2)),
      campaign_count: campaignCount,
      meta: {
        initiatedBy: 'api',
        model,
        filters: {
          closedWonOnly,
          minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
          includeArchived,
          requiredChannels: Array.from(requiredChannelSet),
          requiredCampaignIds
        },
        excludedByFilters: filtersApplied ? {
          channels: excludedByChannel,
          campaigns: excludedByCampaign,
          noTouches: excludedNoTouches
        } : undefined,
        dealsProcessed: dealCountForRun,
        touches_used: touchesUsed
      }
    });

    if (touchesUsed > 0) {
      try {
        await AttributionResult.insertMany(results);
      } catch (insertErr) {
        console.error('[m06/runAttribution] insertMany error', insertErr);
      }
    }

    return res.json({
      ok: true,
      runId: String(runDoc._id),
      runName: runDoc.run_id,
      model,
      date_from: runDoc.date_from,
      date_to: runDoc.date_to,
      deal_count: runDoc.deal_count,
      deals_with_journeys: runDoc.deals_with_journeys,
      deals_without_journeys: runDoc.deals_without_journeys,
      total_revenue: runDoc.total_revenue,
      attributed_revenue: runDoc.attributed_revenue,
      unattributed_revenue: runDoc.unattributed_revenue,
      campaign_count: runDoc.campaign_count,
      touches_used: touchesUsed,
      filters: runDoc.meta?.filters || null,
      excluded_by_filters: (runDoc.meta as any)?.excludedByFilters || null
    });
  } catch (e) {
    console.error('[m06/runAttribution]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/runs
export async function listAttributionRuns(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runs = await AttributionRun.find({ project_id: projectOid })
      .sort({ timestamp: -1 })
      .select('run_id model_type status timestamp date_from date_to deal_count deals_with_journeys deals_without_journeys total_revenue attributed_revenue unattributed_revenue campaign_count meta')
      .lean();
    return res.json({ ok: true, runs });
  } catch (e) {
    console.error('[m06/listAttributionRuns]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/run/:id/summary
export async function getAttributionRunSummary(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.params.id;
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    if (!runId || !mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'runId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);
    const run = await AttributionRun.findOne({ _id: runOid, project_id: projectOid }).lean();
    if (!run) return res.status(404).json({ error: 'run_not_found' });

    // aggregate campaign revenue table for this run
    const campaignAgg = await AttributionResult.aggregate([
      { $match: { project_id: projectOid, run_id: runOid } },
      { $group: { _id: '$campaign_id', revenue: { $sum: '$revenue_share' }, deals: { $addToSet: '$deal_id' } } },
      { $project: { campaign_id: '$_id', revenue: 1, deal_count: { $size: '$deals' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    // touches used for this run
    const touchesUsedAgg = await AttributionResult.aggregate([
      { $match: { project_id: projectOid, run_id: runOid } },
      { $count: 'count' }
    ]);
    const touches_used = touchesUsedAgg.length ? touchesUsedAgg[0].count : 0;

    // build sample allocations: pick up to 10 deals from this run (top by total), with allocation items and deal enrichment
    const sampleDeals = await AttributionResult.aggregate([
      { $match: { project_id: projectOid, run_id: runOid } },
      { $group: { _id: '$deal_id', total: { $sum: '$revenue_share' }, items: { $push: { campaign_id: '$campaign_id', share: '$revenue_share' } } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'deals', localField: '_id', foreignField: '_id', as: 'deal' } },
      { $unwind: { path: '$deal', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, total: 1, items: 1, deal_amount: '$deal.revenue', lead_id: '$deal.lead_id' } }
    ]);

    // attempt unattributed example: find a deal in window with no result rows
    const windowDeals = await Deal.find({ project_id: projectOid, closed_at: { $gte: run.date_from, $lte: run.date_to } }).select('_id revenue lead_id closed_at').lean();
    const resultDealIds = new Set((await AttributionResult.find({ project_id: projectOid, run_id: runOid }).select('deal_id').lean()).map(r => String(r.deal_id)));
    const unattributedExample = windowDeals.find(d => !resultDealIds.has(String(d._id)));

    return res.json({
      ok: true,
      run: {
        id: String(run._id),
        run_id: run.run_id,
        model_type: run.model_type,
        status: run.status,
        timestamp: run.timestamp,
        date_from: run.date_from,
        date_to: run.date_to,
        deal_count: run.deal_count,
        deals_with_journeys: run.deals_with_journeys,
        deals_without_journeys: run.deals_without_journeys,
        total_revenue: run.total_revenue,
        attributed_revenue: run.attributed_revenue,
        unattributed_revenue: run.unattributed_revenue,
        campaign_count: run.campaign_count,
        campaigns_with_credit: campaignAgg.length,
        touches_used,
        filters: (run as any)?.meta?.filters || null,
        excluded_by_filters: (run as any)?.meta?.excludedByFilters || null
      },
      campaigns: campaignAgg,
      samples: sampleDeals,
      unattributed_sample: unattributedExample ? { deal_id: unattributedExample._id, revenue: unattributedExample.revenue, closed_at: unattributedExample.closed_at } : null
    });
  } catch (e) {
    console.error('[m06/getAttributionRunSummary]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m06/roi-by-run?projectId=...&runId=...
export async function roiByRun(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    const runId = req.query.runId as string | undefined;

    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ error: 'projectId_required' });
    }
    if (!runId || !mongoose.isValidObjectId(runId)) {
      return res.status(400).json({ error: 'runId_required' });
    }

    const projectOid = new mongoose.Types.ObjectId(projectId);
    const runOid = new mongoose.Types.ObjectId(runId);

    const match: any = { project_id: projectOid, run_id: runOid };

    const agg = await AttributionResult.aggregate([
      { $match: match },
      { $group: { _id: '$campaign_id', attributed: { $sum: '$revenue_share' } } },
      { $sort: { attributed: -1 } },
    ]).exec();

    if (!agg.length) {
      return res.status(400).json({
        error: 'no_attribution_for_run',
        message: 'No attribution results found for this run. Try another run or rerun attribution.',
      });
    }

    const campaignIds = agg.map(r => r._id);
    const campaigns = await Campaign.find({
      project_id: projectOid,
      _id: { $in: campaignIds },
    })
      .lean()
      .exec();

    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) {
      campaignMap[String(c._id)] = c;
    }

    const rows: Array<{
      campaign_id: string;
      name: string | null;
      channel: string | null;
      spend: number;
      attributed: number;
      profit: number;
      roi: number | null;
    }> = [];

    let totalAttributed = 0;
    let totalSpend = 0;
    let totalDeals = 0;

    for (const r of agg) {
      const cid = String(r._id);
      const camp = campaignMap[cid] || null;
      const attributed = Number(r.attributed) || 0;
      const spend = camp ? Number((camp as any).spend || 0) : 0;
      const profit = attributed - spend;
      const roi = spend > 0 ? (profit / spend) * 100 : null;

      totalAttributed += attributed;
      totalSpend += spend;
      totalDeals += 1;

      rows.push({
        campaign_id: cid,
        name: camp?.name || null,
        channel: (camp as any)?.channel || 'other',
        spend,
        attributed,
        profit,
        roi,
      });
    }

    const netProfit = totalAttributed - totalSpend;
    const overallROI = totalSpend > 0 ? (netProfit / totalSpend) * 100 : null;

    const warnings: string[] = [];
    if (totalSpend === 0) {
      warnings.push('Total campaign spend is 0 — ROI is not meaningful.');
    }
    if (overallROI !== null && overallROI < 0) {
      warnings.push('Overall ROI is negative — campaigns are losing money in this run.');
    }
    if (rows.length < 3) {
      warnings.push('Fewer than 3 campaigns in this run — results may be noisy.');
    }

    return res.json({
      ok: true,
      runId: String(runId),
      totalAttributed,
      totalSpend,
      totalDeals,
      netProfit,
      overallROI,
      campaigns: rows,
      warnings,
    });
  } catch (e) {
    console.error('[m06/roiByRun]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function previewDeals(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    const toArray = (input: unknown): string[] => {
      if (Array.isArray(input)) return input.map(val => String(val));
      if (typeof input === 'string') {
        return input.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [];
    };

    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const statusParam = (req.query.status as string) || 'closed_won';
    const minAmount = req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined;
    const maxAmount = req.query.maxAmount !== undefined ? Number(req.query.maxAmount) : undefined;
    const leadQuery = (req.query.lead as string) || '';
    const includeArchived = req.query.includeArchived === 'true';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));

    const channelInput = req.query.channels ?? req.query.channel;
    const requiredChannelSet = new Set(
      toArray(channelInput)
        .map(ch => ch.toLowerCase())
        .filter(ch => CHANNEL_SET.has(ch))
    );

    const campaignInput = req.query.campaignIds ?? req.query.campaignId;
    const rawCampaignIds = new Set(
      toArray(campaignInput)
        .map(id => id.trim())
        .filter(id => mongoose.isValidObjectId(id))
    );

    const match: any = { project_id: projectOid };
    if (from || to) {
      match.closed_at = {};
      if (from) match.closed_at.$gte = new Date(from);
      if (to) match.closed_at.$lte = new Date(to);
    }
    if (statusParam === 'closed_won') match.closed_won = true;
    else if (statusParam === 'closed_lost' || statusParam === 'open') match.closed_won = false;
    if (!includeArchived) match.status = { $ne: 'archived' };
    if (minAmount !== undefined) match.revenue = { ...(match.revenue || {}), $gte: minAmount };
    if (maxAmount !== undefined) match.revenue = { ...(match.revenue || {}), $lte: maxAmount };

    let leadIdsFilter: string[] | null = null;
    if (leadQuery) {
      if (/^\d+$/.test(leadQuery)) {
        const lead = await (await import('../m01/models/Lead.js')).default.findOne({ lead_id: Number(leadQuery) }).select('_id').lean();
        leadIdsFilter = lead ? [String(lead._id)] : [];
      } else {
        const regex = new RegExp(leadQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, ''), 'i');
        const LeadModel = (await import('../m01/models/Lead.js')).default as any;
        const leads = await LeadModel.find({ $or: [{ First_Name: regex }, { Last_Name: regex }, { Company: regex }, { Email: regex }] }).limit(200).select('_id').lean();
        leadIdsFilter = leads.map((l: any) => String(l._id));
      }
      if (leadIdsFilter) match.lead_id = { $in: leadIdsFilter.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const deals = await Deal.find(match).sort({ closed_at: -1, createdAt: -1 }).lean();
    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));

    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    const projectCampaignIds = new Set<string>();
    for (const campaign of campaigns) {
      const id = String(campaign._id);
      campaignMap[id] = campaign;
      projectCampaignIds.add(id);
    }

    const requiredCampaignIds = Array.from(rawCampaignIds).filter(id => projectCampaignIds.has(id));
    const requiredCampaignSet = new Set(requiredCampaignIds);
    const filtersApplied = requiredChannelSet.size > 0 || requiredCampaignSet.size > 0;

    const touches = await CampaignTouch.find({
      lead_id: { $in: leadIds },
      campaign_id: { $in: Array.from(projectCampaignIds) }
    }).sort({ touched_at: 1 }).lean();
    const touchesByLead: Record<string, any[]> = {};
    for (const touch of touches) {
      const lid = String(touch.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push(touch);
    }

    const getTouchChannel = (touch: any): string => {
      const fromTouch = typeof touch.channel === 'string' ? touch.channel.toLowerCase() : '';
      if (fromTouch && CHANNEL_SET.has(fromTouch)) return fromTouch;
      const campaignId = String(touch.campaign_id);
      const campaignChannel = (campaignMap[campaignId]?.channel || '').toLowerCase();
      return CHANNEL_SET.has(campaignChannel) ? campaignChannel : 'other';
    };

    const eligibleDeals: Array<{ deal: any; touches: any[] }> = [];
    let excludedByChannel = 0;
    let excludedByCampaign = 0;
    let excludedNoTouches = 0;

    for (const deal of deals) {
      const leadId = String(deal.lead_id);
      const list = (touchesByLead[leadId] || []).filter(t => !deal.closed_at || new Date(t.touched_at).getTime() <= new Date(deal.closed_at as any).getTime());

      if (!list.length) {
        if (filtersApplied) {
          excludedNoTouches++;
          continue;
        }
        eligibleDeals.push({ deal, touches: [] });
        continue;
      }

      const hasChannel = requiredChannelSet.size === 0
        || list.some(touch => requiredChannelSet.has(getTouchChannel(touch)));
      if (!hasChannel) {
        if (filtersApplied) excludedByChannel++;
        continue;
      }

      const hasCampaign = requiredCampaignSet.size === 0
        || list.some(touch => requiredCampaignSet.has(String(touch.campaign_id)));
      if (!hasCampaign) {
        if (filtersApplied) excludedByCampaign++;
        continue;
      }

      eligibleDeals.push({ deal, touches: list });
    }

    const total = eligibleDeals.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = eligibleDeals.slice(start, end);

    const leadSummaryIds = Array.from(new Set(pageItems.map(item => String(item.deal.lead_id))));
    const leadSummaries: Record<string, { name: string | null; email: string | null }> = {};
    if (leadSummaryIds.length) {
      try {
        const LeadModel = (await import('../m01/models/Lead.js')).default as any;
        const leadDocs = await LeadModel.find({ _id: { $in: leadSummaryIds } }).select('First_Name Last_Name Email').lean();
        for (const doc of leadDocs) {
          const name = `${doc.First_Name || ''} ${doc.Last_Name || ''}`.trim() || null;
          leadSummaries[String(doc._id)] = { name, email: doc.Email || null };
        }
      } catch (err) {
        console.error('[m06/previewDeals] lead enrichment failed', err);
      }
    }

    const rows = pageItems.map(({ deal, touches: list }) => {
      const touchCount = list.length;
      const firstTouchAt = touchCount ? list[0].touched_at : null;
      const lastTouchAt = touchCount ? list[touchCount - 1].touched_at : null;
      const leadInfo = leadSummaries[String(deal.lead_id)] || { name: null, email: null };
      return {
        deal_id: String(deal._id),
        deal_external_id: (deal as any).deal_id || null,
        lead_id: String(deal.lead_id),
        lead_name: leadInfo.name,
        lead_email: leadInfo.email,
        amount: deal.revenue,
        closed_at: deal.closed_at,
        status: deal.closed_won ? 'closed_won' : 'other',
        touchCount,
        firstTouchAt,
        lastTouchAt,
      };
    });

    return res.json({
      ok: true,
      page,
      limit,
      total,
      rows,
      excluded_by_filters: filtersApplied ? {
        channels: excludedByChannel,
        campaigns: excludedByCampaign,
        noTouches: excludedNoTouches
      } : undefined
    });
  } catch (e) {
    console.error('[m06/previewDeals]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// Journey detail for a specific deal
export async function journeyDetail(req: Request, res: Response) {
  try {
    const dealId = req.params.id;
    const projectId = getProjectId(req);
    if (!dealId || !mongoose.isValidObjectId(dealId)) return res.status(400).json({ error: 'dealId_required' });
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const d = await Deal.findOne({ _id: dealId, project_id: projectId }).lean();
    if (!d) return res.status(404).json({ error: 'deal_not_found' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    // campaigns for project
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c._id)] = c;

    // touches for lead within project campaigns, up to closed_at
    const touchMatch: any = { lead_id: d.lead_id, campaign_id: { $in: Object.keys(campaignMap) } };
    const all = await CampaignTouch.find(touchMatch).sort({ touched_at: 1 }).lean();
    const list = all.filter(t => !d.closed_at || new Date(t.touched_at).getTime() <= new Date(d.closed_at as any).getTime());
    const journey = list.map(t => ({
      touched_at: t.touched_at,
      type: t.type,
      channel: (t as any).channel || campaignMap[String(t.campaign_id)]?.channel || 'other',
      campaign_id: String(t.campaign_id),
      campaignName: campaignMap[String(t.campaign_id)]?.name || null,
      metadata: (t as any).metadata || undefined,
    }));

    // lead summary (optional)
    let lead: any = null;
    try {
      const LeadModel = (await import('../m01/models/Lead.js')).default as any;
      const l = await LeadModel.findById(d.lead_id).select('First_Name Last_Name Email Company lead_id').lean();
      if (l) lead = { id: String(l._id), lead_id: l.lead_id, name: `${l.First_Name || ''} ${l.Last_Name || ''}`.trim(), email: l.Email || null, company: l.Company || null };
    } catch {}

    return res.json({ ok: true, deal: { id: String(d._id), external_id: (d as any).deal_id || null, amount: d.revenue, closed_at: d.closed_at, status: d.closed_won ? 'closed_won' : 'other' }, lead, journey });
  } catch (e) {
    console.error('[m06/journeyDetail]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// ROI dashboard data for Page 3
// Optional: ?runId=... to scope attribution to a specific run
export async function roiDashboard(req: Request, res: Response) {
  try {
    const projectId = getProjectId(req);
    if (!projectId || !mongoose.isValidObjectId(projectId)) return res.status(400).json({ error: 'projectId_required' });
    const projectOid = new mongoose.Types.ObjectId(projectId);

    const runId = (req.query.runId as string) || null;

    // parse filters
    const channelFilter = (req.query.channel as string) || null; // single channel or comma-separated
    const startMonth = (req.query.start as string) || null; // YYYY-MM
    const endMonth = (req.query.end as string) || null; // YYYY-MM
    const minSpend = req.query.minSpend ? Number(req.query.minSpend) : null;
    const minROI = req.query.minROI ? Number(req.query.minROI) : null;

    // Precondition: ensure attribution results exist for this project (and run, if provided)
    const attribMatch: any = { project_id: projectOid };
    if (runId) {
      if (!mongoose.isValidObjectId(runId)) return res.status(400).json({ error: 'invalid_runId' });
      attribMatch.run_id = new mongoose.Types.ObjectId(runId);
    }

    const hasAttrib = await AttributionResult.findOne(attribMatch).lean();
    if (!hasAttrib) return res.status(400).json({ error: 'no_attribution', message: 'No attribution results found. Please run attribution (Page 2) first.' });

    // Precondition: ensure there are campaigns with spend (required to compute ROI)
    const campaignsWithSpend = await Campaign.find({ project_id: projectOid, spend: { $gt: 0 } }).lean();
    if (!campaignsWithSpend || campaignsWithSpend.length === 0) return res.status(400).json({ error: 'no_campaign_spend', message: 'No campaigns with spend found for this project. Add campaign spend to compute ROI.' });

    // Build attributed sums per campaign, optionally limited to a date range (by deal.closed_at)
    const matchStage: any = { ...attribMatch };
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
      { $match: attribMatch },
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
    console.error('[m06/roiDashboard]', e);
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
    console.error('[m06/forecast]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
