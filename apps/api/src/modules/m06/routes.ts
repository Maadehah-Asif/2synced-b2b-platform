import { Router } from 'express';
import {
 	/* stats (already exported below) */
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
	validateCampaignsCSV,
	deleteDeal,
	createCampaignTouch,
	listCampaignTouchesByCampaign,
	listCampaignTouchesByLead,
	updateCampaignTouch,
	archiveCampaignTouch,
	deleteCampaignTouchPermanent,
	importCampaignTouches,
	validateCampaignTouchesImport,
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
	forecastViaAgent,
	latestRun,
	runList,
	stats,
	journeyDetail,
	listModule6Leads,
	createModule6Lead,
	updateModule6Lead,
	archiveModule6Lead,
	validateModule6LeadsCSV,
	importModule6LeadsCSV,
	searchModule6Leads,
	listTouchesDebug,
} from './controllers.js';
import { seedHttp, demoProjects } from './seedController.js';
import { createDeal, listDeals, updateDeal, archiveDeal, deleteDealPermanent, importDealsCSV } from './controllers.js';
import { validateDealsCSV } from './controllers.js';

const router = Router();

// Basic module routes
router.get('/', (_req, res) => res.json({ ok: true, module: 'm06' }));
// GET /m06/stats?projectId=...  (projectId may be workspaceId)
 // stats already declared earlier; keep route as is
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
router.post('/forecast', forecast);
router.post('/forecast-agent', forecastViaAgent);
router.get('/latest-run', latestRun);
router.get('/run-list', runList);
// Campaign management
router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.post('/campaigns/:id/archive', archiveCampaign);
router.post('/campaigns/import/validate', validateCampaignsCSV);
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
router.post('/deals/import/validate', validateDealsCSV);
router.post('/deals/import/csv', importDealsCSV);

// Campaign Touch management (Screen 2)
router.post('/campaign-touches', createCampaignTouch);
router.get('/campaign-touches/by-campaign', listCampaignTouchesByCampaign);
router.get('/campaign-touches/by-lead', listCampaignTouchesByLead);
router.put('/campaign-touches/:id', updateCampaignTouch);
router.post('/campaign-touches/:id/archive', archiveCampaignTouch);
router.delete('/campaign-touches/:id/permanent', deleteCampaignTouchPermanent);
router.post('/campaign-touches/import/validate', validateCampaignTouchesImport);
router.post('/campaign-touches/import/csv', importCampaignTouches);

// Debug: touch counts and sample rows
router.get('/debug/touches', listTouchesDebug);

router.get('/leads', listModule6Leads);
router.post('/leads', createModule6Lead);
router.put('/leads/:id', updateModule6Lead);
router.post('/leads/:id/archive', archiveModule6Lead);
router.post('/leads/import/validate', validateModule6LeadsCSV);
router.post('/leads/import/csv', importModule6LeadsCSV);
router.get('/leads/search', searchModule6Leads);

export default router;
