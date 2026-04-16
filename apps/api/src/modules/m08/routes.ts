import { Router } from 'express';
import { exportModuleReport, getModuleReport } from './controllers.js';

const router = Router();

router.get('/', (_req, res) => res.json({ ok: true, module: 'm08' }));
router.get('/reports/:moduleKey', getModuleReport);
router.get('/reports/:moduleKey/export', exportModuleReport);

export default router;
