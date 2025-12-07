import express from 'express';
import { listLeadScoreFiles, generateIntent, previewIntentRun, listIntentRuns, getRunData, downloadRunCsv, getLeadFromRun, getSegmentBehavior, intentForecast, seedDemo } from './controllers.js';

const router = express.Router();

router.get('/lead-score-files', listLeadScoreFiles);
router.post('/generate-intent', generateIntent);
router.get('/intent-runs/:id/preview', previewIntentRun);
router.get('/intent-runs', listIntentRuns);
router.get('/run-data/:id', getRunData);
router.get('/intent-runs/:id/download', downloadRunCsv);
router.get('/run-lead/:runId/:leadId', getLeadFromRun);
router.get('/segment-behavior', getSegmentBehavior);
router.post('/intent-forecast', intentForecast);
router.post('/seed-demo', seedDemo);

export default router;
