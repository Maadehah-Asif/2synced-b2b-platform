import { Router } from 'express';
import {
	stats,
	listCampaigns,
	createCampaign,
	updateCampaign,
	archiveCampaign,
	addSpendEntry,
	uploadSpendCSV,
	uploadSpendCSVMulti,
	listSpendEntries,
	deleteCampaign,
	deleteCampaignPermanent,
	importCampaignsCSV,
	deleteDeal,
	createCampaignTouch,
	listCampaignTouchesByCampaign,
	listCampaignTouchesByLead,
	updateCampaignTouch,
	archiveCampaignTouch,
	deleteCampaignTouchPermanent,
	importCampaignTouches,
	runAttribution,
	previewDeals,
	allocationByCampaign,
	allocationByDeal,
	allocationDealsForCampaign,
	allocationCampaignsForDeal,
	listAttributionRuns,
	getAttributionRunSummary,
	getRunResults,
	roiDashboard,
	roiByRun,
	forecast,
	journeyDetail,
} from './controllers.js';
import mongoose from 'mongoose';
import Lead from '../m01/models/Lead.js';
import { seedHttp, demoProjects } from './seedController.js';
import { createDeal, listDeals, updateDeal, archiveDeal, deleteDealPermanent, importDealsCSV } from './controllers.js';

const router = Router();

// Basic module routes
router.get('/', (_req, res) => res.json({ ok: true, module: 'm06' }));
// GET /m06/stats?projectId=...  (projectId may be workspaceId)
router.get('/stats', stats);
// POST /m06/seed  -> run demo seeder (safe, non-destructive by default)
router.post('/seed', seedHttp);
// GET /m06/demo-projects -> list projects with demo data
router.get('/demo-projects', demoProjects);
// POST /m06/run -> run attribution for a project (body: { projectId, modelType })
router.post('/run', runAttribution);
router.get('/runs', listAttributionRuns);
router.get('/preview', previewDeals);
router.get('/allocation/campaigns', allocationByCampaign);
router.get('/allocation/deals', allocationByDeal);
router.get('/allocation/campaign-deals', allocationDealsForCampaign);
router.get('/allocation/deal-campaigns', allocationCampaignsForDeal);
router.get('/run/:id/summary', getAttributionRunSummary);
router.get('/journey/:id', journeyDetail);
router.get('/run/:id/results', getRunResults);
router.get('/roi', roiDashboard);
router.get('/roi-by-run', roiByRun);
router.get('/forecast', forecast);
// Campaign management
router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.post('/campaigns/:id/archive', archiveCampaign);
router.post('/campaigns/:id/spend', addSpendEntry);
router.post('/campaigns/:id/spend/csv', uploadSpendCSV);
router.post('/campaigns/spend/csv', uploadSpendCSVMulti);
router.get('/campaigns/:id/spend', listSpendEntries);
// Bulk campaign import
router.post('/campaigns/import/csv', importCampaignsCSV);
// Protected deletions (workspace query param expected for role scoping)
router.delete('/campaigns/:id', deleteCampaign);
router.delete('/campaigns/:id/permanent', deleteCampaignPermanent);
router.delete('/deals/:id', deleteDeal);
// Deals management (Screen 3)
router.get('/deals', listDeals);
router.post('/deals', createDeal);
router.put('/deals/:id', updateDeal);
router.post('/deals/:id/archive', archiveDeal);
router.delete('/deals/:id/permanent', deleteDealPermanent);
router.post('/deals/import/csv', importDealsCSV);

// Campaign Touch management (Screen 2)
router.post('/campaign-touches', createCampaignTouch);
router.get('/campaign-touches/by-campaign', listCampaignTouchesByCampaign);
router.get('/campaign-touches/by-lead', listCampaignTouchesByLead);
router.put('/campaign-touches/:id', updateCampaignTouch);
router.post('/campaign-touches/:id/archive', archiveCampaignTouch);
router.delete('/campaign-touches/:id/permanent', deleteCampaignTouchPermanent);
router.post('/campaign-touches/import/csv', importCampaignTouches);

// Lightweight lead search for autocomplete (by numeric id or partial company/email fields)
router.get('/leads/search', async (req, res) => {
	try {
		const { projectId, q } = req.query as { projectId?: string; q?: string };
		// projectId currently unused; placeholder for future multi-tenancy filter
		const query = (q || '').trim();
		if (!query) return res.json({ leads: [] });
		let mongoQuery: any = {};
		if (/^\d+$/.test(query)) {
			// numeric search by lead_id
			mongoQuery.lead_id = Number(query);
		} else {
			// partial match across First_Name, Last_Name, Company
			const regex = new RegExp(query.replace(/[-/\\^$*+?.()|[\]{}]/g, ''), 'i');
			mongoQuery.$or = [
				{ First_Name: regex },
				{ Last_Name: regex },
				{ Company: regex },
			];
		}
		const leads = await Lead.find(mongoQuery).limit(15).select('lead_id First_Name Last_Name Company').lean();
		return res.json({ leads });
	} catch (err:any) {
		return res.status(500).json({ error: 'lead_search_failed', message: err.message });
	}
});

export default router;
