import express from 'express';
import { funnelHealth } from './m07.controller.js';
import { getLeakage, postRunLeakage } from './m07.leakage.controller.js';
import { getFatigue, postRunFatigue } from './m07.fatigue.controller.js';
import { getRecs, postRunRecs, postMarkDone, postMarkDismiss } from './recommendations/recommendations.controller.js';

const router = express.Router();

// GET /m07/funnel-health?workspace=...&from=...&to=...&stages=stage1,stage2
router.get('/funnel-health', funnelHealth);

// Leakage prediction
router.get('/leakage-prediction', getLeakage);
router.post('/leakage-prediction/run', postRunLeakage);

// Fatigue monitor
router.get('/fatigue', getFatigue);
router.post('/fatigue/run', postRunFatigue);

// Recommendations workboard
router.get('/recommendations', getRecs);
router.post('/recommendations/run', postRunRecs);
router.post('/recommendations/:id/done', postMarkDone);
router.post('/recommendations/:id/dismiss', postMarkDismiss);

export default router;
