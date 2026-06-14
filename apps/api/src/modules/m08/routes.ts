/**
 * Module: Report Center (m08)
 * Layer: Backend
 * File: routes.ts
 * Purpose: Supports the r ou te s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { Router } from 'express';
import { exportModuleReport, getModuleReport } from './controllers.js';

const router = Router();

router.get('/', (_req, res) => res.json({ ok: true, module: 'm08' }));
router.get('/reports/:moduleKey', getModuleReport);
router.get('/reports/:moduleKey/export', exportModuleReport);

export default router;
