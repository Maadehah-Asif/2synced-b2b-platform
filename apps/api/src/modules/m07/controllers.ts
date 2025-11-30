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
    console.error('[m07/createCampaignTouch]', e);
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
    console.error('[m07/listCampaignTouchesByCampaign]', e);
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
    console.error('[m07/listCampaignTouchesByLead]', e);
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
    console.error('[m07/updateCampaignTouch]', e);
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
    console.error('[m07/archiveCampaignTouch]', e);
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
    console.error('[m07/deleteCampaignTouchPermanent]', e);
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
    console.error('[m07/importCampaignTouches]', e);
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
    console.error('[m07/listCampaigns]', e);
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
    const campaign = await Campaign.create({ campaign_id: `camp-${Date.now()}`, project_id: projectOid, channel, name: name.trim(), description: description || null, tags: Array.isArray(tags) ? tags : [], start_date: startDate ? new Date(startDate) : undefined, end_date: endDate ? new Date(endDate) : undefined, spend: Number(spend) || 0 });
    return res.status(201).json({ ok: true, campaign: { id: String(campaign._id), name: campaign.name } });
  } catch (e) {
    console.error('[m07/createCampaign]', e);
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
    if (tags !== undefined) camp.tags = Array.isArray(tags) ? tags : camp.tags;
    if (startDate !== undefined) camp.start_date = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) camp.end_date = endDate ? new Date(endDate) : undefined;
    if (status) camp.status = status;
    await camp.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m07/updateCampaign]', e);
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
    console.error('[m07/archiveCampaign]', e);
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
    console.error('[m07/addSpendEntry]', e);
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
    const header = lines[0].split(',').map(h => h.trim());
    const dcol = dateColumn ? header.indexOf(dateColumn) : 0;
    const acol = amountColumn ? header.indexOf(amountColumn) : 1;
    if (dcol < 0 || acol < 0) return res.status(400).json({ error: 'columns_not_found', header });
    const camp = await Campaign.findById(id).exec();
    if (!camp) return res.status(404).json({ error: 'not_found' });
    let inserted = 0;
    const srow = startRow ? Number(startRow) : 1;
    for (let i = srow; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const d = cols[dcol];
      const a = parseFloat((cols[acol] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const date = new Date(d);
      if (isNaN(date.getTime())) continue;
      await CampaignSpend.create({ campaign_id: camp._id, project_id: camp.project_id, date, amount: a, source: 'csv' });
      camp.spend = (Number(camp.spend) || 0) + a;
      inserted++;
    }
    await camp.save();
    return res.json({ ok: true, inserted });
  } catch (e) {
    console.error('[m07/uploadSpendCSV]', e);
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
    const header = lines[0].split(',').map(h => h.trim());

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
      const cols = lines[i].split(',').map(c => c.trim());
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
    console.error('[m07/uploadSpendCSVMulti]', e);
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
    console.error('[m07/listSpendEntries]', e);
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
    console.error('[m07/deleteCampaignPermanent]', e);
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
    const header = lines[0].split(',').map(h => h.trim());

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
      const cols = lines[i].split(',').map(c => c.trim());
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
    console.error('[m07/importCampaignsCSV]', e);
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
    console.error('[m07/createDeal]', e);
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
    console.error('[m07/listDeals]', e);
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
        d.closed_at = undefined;
      }
    }
    if (stage !== undefined) (d as any).stage = stage || undefined;
    if (notes !== undefined) (d as any).notes = notes || undefined;
    await d.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[m07/updateDeal]', e);
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
    console.error('[m07/archiveDeal]', e);
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
    console.error('[m07/deleteDealPermanent]', e);
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
    const header = lines[0].split(',').map(h => h.trim());

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
      const cols = lines[i].split(',').map(c => c.trim());
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
    console.error('[m07/importDealsCSV]', e);
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

    // Parse filters
    const from = (req.query.from as string) || '';
    const to = (req.query.to as string) || '';
    const status = (req.query.status as string) || 'closed_won';
    const minAmount = req.query.minAmount !== undefined ? Number(req.query.minAmount) : undefined;
    const maxAmount = req.query.maxAmount !== undefined ? Number(req.query.maxAmount) : undefined;
    const leadQuery = (req.query.lead as string) || '';
    const channelFilter = (req.query.channel as string) || '';
    const campaignId = (req.query.campaignId as string) || '';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));

    // Build deal match
    const match: any = { project_id: projectOid };
    if (from || to) {
      match.closed_at = {};
      if (from) match.closed_at.$gte = new Date(from);
      if (to) match.closed_at.$lte = new Date(to);
    }
    if (status) {
      if (status === 'closed_won') match.closed_won = true;
      else if (status === 'open') match.closed_won = false;
      // closed_lost not explicitly tracked; treat as !closed_won
      else if (status === 'closed_lost') match.closed_won = false;
    }
    if (minAmount !== undefined) match.revenue = { ...(match.revenue || {}), $gte: minAmount };
    if (maxAmount !== undefined) match.revenue = { ...(match.revenue || {}), $lte: maxAmount };

    // Optional lead filter by numeric lead_id or by name/email (lookup leads first)
    let leadIdsFilter: string[] | null = null;
    if (leadQuery) {
      if (/^\d+$/.test(leadQuery)) {
        const lead = await (await import('../m01/models/Lead.js')).default.findOne({ lead_id: Number(leadQuery) }).select('_id').lean();
        if (lead) leadIdsFilter = [String(lead._id)]; else leadIdsFilter = [];
      } else {
        const regex = new RegExp(leadQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, ''), 'i');
        const LeadModel = (await import('../m01/models/Lead.js')).default as any;
        const leads = await LeadModel.find({ $or: [{ First_Name: regex }, { Last_Name: regex }, { Company: regex }, { Email: regex }] }).limit(200).select('_id').lean();
        leadIdsFilter = leads.map((l:any)=> String(l._id));
      }
      if (leadIdsFilter) {
        match.lead_id = { $in: leadIdsFilter.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    const skip = (page - 1) * limit;
    const total = await Deal.countDocuments(match).exec();
    const deals = await Deal.find(match).sort({ closed_at: -1, createdAt: -1 }).skip(skip).limit(limit).lean();
    const leadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));

    // get campaigns for project
    const campaigns = await Campaign.find({ project_id: projectOid }).lean();
    const campaignMap: Record<string, any> = {};
    for (const c of campaigns) campaignMap[String(c._id)] = c;

    // touches for these leads (filter by project campaigns and optional channel/campaign)
    const campaignIds = Object.keys(campaignMap);
    const touchMatch: any = { lead_id: { $in: leadIds }, campaign_id: { $in: campaignIds } };
    if (channelFilter) touchMatch.channel = channelFilter;
    if (campaignId && mongoose.isValidObjectId(campaignId)) touchMatch.campaign_id = campaignId;
    const touches = await CampaignTouch.find(touchMatch).sort({ touched_at: 1 }).lean();

    // Group touches by lead and filter by touched_at <= deal.closed_at when summarizing
    const touchesByLead: Record<string, any[]> = {};
    for (const t of touches) {
      const lid = String(t.lead_id);
      touchesByLead[lid] = touchesByLead[lid] || [];
      touchesByLead[lid].push({ campaign_id: String(t.campaign_id), touched_at: t.touched_at, type: t.type, channel: (t as any).channel || campaignMap[String(t.campaign_id)]?.channel || 'other', campaignName: campaignMap[String(t.campaign_id)]?.name || null });
    }

    // Enrich with lead summary
    let leadSummaries: Record<string, { name: string | null; email: string | null }> = {};
    try {
      const LeadModel = (await import('../m01/models/Lead.js')).default as any;
      const uniqueLeadIds = Array.from(new Set(deals.map(d => String(d.lead_id))));
      const leadDocs = await LeadModel.find({ _id: { $in: uniqueLeadIds } }).select('First_Name Last_Name Email').lean();
      for (const l of leadDocs) {
        const name = `${l.First_Name || ''} ${l.Last_Name || ''}`.trim() || null;
        leadSummaries[String(l._id)] = { name, email: l.Email || null };
      }
    } catch {}

    const summaries = deals.map(d => {
      const list = (touchesByLead[String(d.lead_id)] || []).filter(t => !d.closed_at || new Date(t.touched_at).getTime() <= new Date(d.closed_at as any).getTime());
      const touchCount = list.length;
      const firstTouchAt = touchCount > 0 ? list[0].touched_at : null;
      const lastTouchAt = touchCount > 0 ? list[list.length - 1].touched_at : null;
      const leadInfo = leadSummaries[String(d.lead_id)] || { name: null, email: null };
      return {
        deal_id: String(d._id),
        deal_external_id: (d as any).deal_id || null,
        lead_id: String(d.lead_id),
        lead_name: leadInfo.name,
        lead_email: leadInfo.email,
        amount: d.revenue,
        closed_at: d.closed_at,
        status: d.closed_won ? 'closed_won' : 'other',
        touchCount,
        firstTouchAt,
        lastTouchAt,
      };
    });

    return res.json({ ok: true, page, limit, total, rows: summaries });
  } catch (e) {
    console.error('[m07/previewDeals]', e);
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
    console.error('[m07/journeyDetail]', e);
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
