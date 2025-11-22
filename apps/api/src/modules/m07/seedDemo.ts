import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Dynamic import helper: attempt .js then .ts so both tsx and ts-node work
async function tryImport(base: string) {
  try {
    return await import(base + '.js');
  } catch (e) {
    try {
      return await import(base + '.ts');
    } catch (e2) {
      throw e;
    }
  }
}

async function run() {
  console.log('[m07/seed] Preparing to connect to DB...');

  // load modules dynamically
  const dbMod = await tryImport('../../config/db');
  const envMod = await tryImport('../../config/env');
  const modelsCampaign = await tryImport('./models/Campaign');
  const modelsDeal = await tryImport('./models/Deal');
  const modelsRun = await tryImport('./models/AttributionRun');
  const modelsResult = await tryImport('./models/AttributionResult');
  const modelsTouch = await tryImport('./models/CampaignTouch');

  const connectDB = dbMod.connectDB;
  const ENV = envMod.ENV;
  const Campaign = modelsCampaign.Campaign;
  const Deal = modelsDeal.Deal;
  const AttributionRun = modelsRun.AttributionRun;
  const AttributionResult = modelsResult.AttributionResult;
  const CampaignTouch = modelsTouch.CampaignTouch;

  console.log('[m07/seed] Connecting to DB...');
  await connectDB();

  const workspaceId = process.argv[2] || process.env.WORKSPACE_ID || '691d42a6f7055cb3eb370bc6';
  const seedFile = process.argv[3] || process.env.SEED_FILE || null;
  if (!mongoose.isValidObjectId(workspaceId)) {
    console.error('Invalid workspaceId:', workspaceId);
    process.exit(1);
  }
  const projectId = new mongoose.Types.ObjectId(workspaceId);

  console.log('[m07/seed] Seeding demo data for workspace', workspaceId);
  // If a seed file is provided, load data from it. Otherwise generate sample data.
  let campaignsData: any[] = [];
  let dealsData: any[] = [];
  if (seedFile) {
    const p = path.isAbsolute(seedFile) ? seedFile : path.join(process.cwd(), seedFile);
    console.log('[m07/seed] Loading seed file:', p);
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    campaignsData = (parsed.campaigns || []).map((c: any) => ({ ...c, project_id: projectId }));
    dealsData = (parsed.deals || []).map((d: any) => ({ ...d, project_id: projectId }));
  } else {
    // Create campaigns
    campaignsData = [
      { campaign_id: `demo-camp-1-${Date.now()}`, project_id: projectId, channel: 'ads', spend: 5000, name: 'Demo Campaign A' },
      { campaign_id: `demo-camp-2-${Date.now()}`, project_id: projectId, channel: 'email', spend: 3000, name: 'Demo Campaign B' },
      { campaign_id: `demo-camp-3-${Date.now()}`, project_id: projectId, channel: 'linkedin', spend: 2000, name: 'Demo Campaign C' },
    ];

    // Create deals across recent months
    const now = new Date();
    const monthBack = (n: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - n);
      return d;
    };

    const revenues = [12000, 45000, 8000, 23000, 15000, 6000];
    for (let i = 0; i < revenues.length; i++) {
      dealsData.push({
        deal_id: `demo-deal-${i + 1}-${Date.now()}`,
        lead_id: new mongoose.Types.ObjectId(),
        project_id: projectId,
        revenue: revenues[i],
        closed_won: true,
        closed_at: monthBack(i),
      });
    }
  }

  const createdCampaigns = await Campaign.insertMany(campaignsData);
  console.log('[m07/seed] Created campaigns:', createdCampaigns.map((c:any) => ({ id: String(c._id), name: c.name })));

  const createdDeals = await Deal.insertMany(dealsData);
  console.log('[m07/seed] Created deals:', createdDeals.map((d:any) => ({ id: String(d._id), revenue: d.revenue })));

  // Create an attribution run
  const run = await AttributionRun.create({
    run_id: `demo-run-${Date.now()}`,
    project_id: projectId,
    model_type: 'linear',
    timestamp: new Date(),
    status: 'success',
    meta: { demo: true },
  });

  console.log('[m07/seed] Created run:', { id: String(run._id), run_id: run.run_id });

  // For each deal, assign revenue across 1-2 campaigns
  const results: any[] = [];
  for (const deal of createdDeals) {
    const assignTwo = Math.random() > 0.4; // 60% single, 40% split
    if (!assignTwo) {
      // single campaign gets full revenue
      const camp = createdCampaigns[Math.floor(Math.random() * createdCampaigns.length)] || createdCampaigns[0];
      results.push({ run_id: run._id, project_id: projectId, deal_id: deal._id, campaign_id: (camp as any)._id, revenue_share: deal.revenue });
    } else {
      // split between two campaigns
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

  const createdResults = await AttributionResult.insertMany(results);
  console.log('[m07/seed] Created attribution results:', createdResults.length);

  // Create CampaignTouch entries that correspond to attribution results (one touch per attribution row)
  const touchesToCreate: any[] = [];
  for (const r of createdResults) {
    // find deal closed_at
    const deal = (createdDeals as any[]).find(d => String(d._id) === String(r.deal_id));
    const closedAt = deal?.closed_at || new Date();
    // touched_at before closedAt
    const touchedAt = new Date(new Date(closedAt).getTime() - (1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 10) + 1)));
    touchesToCreate.push({ lead_id: deal.lead_id, campaign_id: r.campaign_id, touched_at: touchedAt, type: 'other', metadata: { demo: true } });
  }
  if (touchesToCreate.length > 0) {
    const createdTouches = await CampaignTouch.insertMany(touchesToCreate);
    console.log('[m07/seed] Created campaign touches:', createdTouches.length);
  }

  // Summary
  const totalRevenue = createdDeals.reduce((s: number, d: any) => s + (d.revenue || 0), 0);
  const totalAttributed = createdResults.reduce((s: number, r: any) => s + (r.revenue_share || 0), 0);

  console.log('[m07/seed] Summary: totalRevenue=', totalRevenue, ' totalAttributed=', totalAttributed, ' unattributed=', totalRevenue - totalAttributed);

  console.log('[m07/seed] Done.');
  process.exit(0);
}

run().catch(err => {
  console.error('[m07/seed] Error:', err);
  process.exit(1);
});
