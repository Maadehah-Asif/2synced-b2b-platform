import { Router } from 'express';
import { stats, deleteCampaign, deleteDeal } from './controllers.js';
import { runAttribution } from './controllers.js';
import { previewDeals } from './controllers.js';
import { getRunResults } from './controllers.js';
import { seedHttp, demoProjects } from './seedController.js';

const router = Router();

// Basic module routes
router.get('/', (_req, res) => res.json({ ok: true, module: 'm07' }));
// GET /m07/stats?projectId=...  (projectId may be workspaceId)
router.get('/stats', stats);
// POST /m07/seed  -> run demo seeder (safe, non-destructive by default)
router.post('/seed', seedHttp);
// GET /m07/demo-projects -> list projects with demo data
router.get('/demo-projects', demoProjects);
// POST /m07/run -> run attribution for a project (body: { projectId, modelType })
router.post('/run', runAttribution);
router.get('/preview', previewDeals);
router.get('/run/:id/results', getRunResults);
// Protected deletions (workspace query param expected for role scoping)
router.delete('/campaigns/:id', deleteCampaign);
router.delete('/deals/:id', deleteDeal);

export default router;
