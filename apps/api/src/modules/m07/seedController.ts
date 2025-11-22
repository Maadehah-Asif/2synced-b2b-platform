import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db.js';
import { Campaign } from './models/Campaign.js';
import { Deal } from './models/Deal.js';
import { AttributionRun } from './models/AttributionRun.js';
import { AttributionResult } from './models/AttributionResult.js';

// This controller wraps the seed logic so it can be called via HTTP.
// It is idempotent when `clean=true` is passed; otherwise it appends demo data.
export async function seedHttp(req: Request, res: Response) {
  try {
    // ensure DB connected
    await connectDB();

    const workspaceId = (req.body.workspaceId as string) || (req.query.workspaceId as string) || null;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({ ok: false, error: 'workspaceId_required' });
    }
    const projectId = new mongoose.Types.ObjectId(workspaceId);

    const clean = req.body.clean === true || req.query.clean === 'true';

    if (clean) {
      // remove previous demo entries for this workspace (based on campaign_id/deal_id prefix used by the seeder)
      await AttributionResult.deleteMany({ project_id: projectId, run_id: { $exists: true } }).exec();
      await AttributionRun.deleteMany({ project_id: projectId, 'meta.demo': true }).exec();
      await Campaign.deleteMany({ project_id: projectId, campaign_id: /^demo-camp-/ }).exec();
      await Deal.deleteMany({ project_id: projectId, deal_id: /^demo-deal-/ }).exec();
    }

    // create campaigns
    const now = Date.now();
    const campaignsData = [
      { campaign_id: `demo-camp-1-${now}`, project_id: projectId, channel: 'ads', spend: 5000, name: 'Demo Campaign A' },
      { campaign_id: `demo-camp-2-${now}`, project_id: projectId, channel: 'email', spend: 3000, name: 'Demo Campaign B' },
      { campaign_id: `demo-camp-3-${now}`, project_id: projectId, channel: 'linkedin', spend: 2000, name: 'Demo Campaign C' },
    ];
    const createdCampaigns = await Campaign.insertMany(campaignsData);

    // create deals
    const nowDate = new Date();
    const monthBack = (n: number) => { const d = new Date(nowDate); d.setMonth(d.getMonth() - n); return d; };
    const revenues = [12000, 45000, 8000, 23000, 15000, 6000];
    const dealsData: any[] = revenues.map((r, i) => ({ deal_id: `demo-deal-${i + 1}-${now}`, lead_id: new mongoose.Types.ObjectId(), project_id: projectId, revenue: r, closed_won: true, closed_at: monthBack(i) }));
    const createdDeals = await Deal.insertMany(dealsData);

    // attribution run
    const run = await AttributionRun.create({ run_id: `demo-run-${now}`, project_id: projectId, model_type: 'linear', timestamp: new Date(), status: 'success', meta: { demo: true } });

    // attribution results
    const results: any[] = [];
    for (const deal of createdDeals) {
      const assignTwo = Math.random() > 0.4;
      if (!assignTwo) {
        const camp = createdCampaigns[Math.floor(Math.random() * createdCampaigns.length)] || createdCampaigns[0];
        results.push({ run_id: run._id, project_id: projectId, deal_id: deal._id, campaign_id: (camp as any)._id, revenue_share: deal.revenue });
      } else {
        const aIndex = Math.floor(Math.random() * createdCampaigns.length);
        let bIndex = Math.floor(Math.random() * createdCampaigns.length);
        while (bIndex === aIndex) bIndex = Math.floor(Math.random() * createdCampaigns.length);
        const a = createdCampaigns[aIndex] || createdCampaigns[0];
        const b = createdCampaigns[bIndex] || createdCampaigns[0];
        const r1 = Math.round(deal.revenue * 0.6);
        const r2 = deal.revenue - r1;
        results.push({ run_id: run._id, project_id: projectId, deal_id: deal._id, campaign_id: (a as any)._id, revenue_share: r1 });
        results.push({ run_id: run._id, project_id: projectId, deal_id: deal._id, campaign_id: (b as any)._id, revenue_share: r2 });
      }
    }

    await AttributionResult.insertMany(results);

    const totalRevenue = createdDeals.reduce((s: number, d: any) => s + (d.revenue || 0), 0);
    const totalAttributed = results.reduce((s: number, r: any) => s + (r.revenue_share || 0), 0);

    return res.json({ ok: true, inserted: { campaigns: createdCampaigns.length, deals: createdDeals.length, results: results.length }, totalRevenue, totalAttributed, unattributed: totalRevenue - totalAttributed });
  } catch (e) {
    console.error('[m07/seedHttp]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

// Returns a list of project/workspace ids that contain demo campaign rows
export async function demoProjects(_req: Request, res: Response) {
  try {
    await connectDB();
    // find distinct project_ids that have demo campaigns
    const projects = await Campaign.distinct('project_id', { campaign_id: /^demo-camp-/ });
    const ids = (projects || []).map((p: any) => String(p));
    return res.json({ ok: true, projects: ids });
  } catch (e) {
    console.error('[m07/demoProjects]', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}
