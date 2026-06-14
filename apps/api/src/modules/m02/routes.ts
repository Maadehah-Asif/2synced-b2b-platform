/**
 * Module: Intent Signals (m02)
 * Layer: Backend
 * File: routes.ts
 * Purpose: Supports the r ou te s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import express from 'express';
import { listLeadScoreFiles, generateIntent, previewIntentRun, listIntentRuns, getRunData, downloadRunCsv, getLeadFromRun, getSegmentBehavior, intentForecast, seedDemo, uploadLeadsIntent, uploadBehaviors, getPrioritization, getBehaviorTimeline, getBehaviorTimelineByLead, getForecastDatasetOptions, intentForecastDataset, getIntentDashboardData, listIntentDashboardFiles } from './controllers.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/lead-score-files', listLeadScoreFiles);
router.post('/generate-intent', generateIntent);
router.get('/intent-runs/:id/preview', previewIntentRun);
router.get('/intent-runs', listIntentRuns);
router.get('/run-data/:id', getRunData);
router.get('/dashboard-files', listIntentDashboardFiles);
router.get('/dashboard/:id', getIntentDashboardData);
router.get('/intent-runs/:id/download', downloadRunCsv);
router.get('/run-lead/:runId/:leadId', getLeadFromRun);
router.get('/segment-behavior', getSegmentBehavior);
router.post('/intent-forecast', intentForecast);
router.get('/forecast/options', getForecastDatasetOptions);
router.post('/forecast', intentForecastDataset);
router.post('/seed-demo', seedDemo);
router.post('/upload/leads-intent', upload.single('file'), uploadLeadsIntent);
router.post('/upload/behaviors', upload.single('file'), uploadBehaviors);
router.get('/prioritization', getPrioritization);
router.get('/behaviors/timeline', getBehaviorTimeline);
router.get('/leads/:leadId/behavior-timeline', getBehaviorTimelineByLead);

export default router;
