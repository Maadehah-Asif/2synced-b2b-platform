import { Router } from 'express';
import multer from 'multer';
import {
  createInteraction,
  previewInteractionUpload,
  commitInteractionUpload,
  listInteractions,
  getInteraction,
  updateInteraction,
  archiveInteraction,
  deleteInteractionPermanent,
} from './controllers.js';
import {
  createStage,
  previewStageUpload,
  validateStageUpload,
  commitStageUpload,
  listStages,
  getStage,
  updateStage,
  archiveStage,
  deleteStagePermanent,
} from './controllers.js';

const router = Router();
const upload = multer();

router.get('/', (_req, res) => res.json({ ok: true, module: 'm07' }));

// Stage history routes
router.post('/stages', createStage);
router.post('/stages/upload/preview', upload.single('file'), previewStageUpload);
router.post('/stages/upload/validate', validateStageUpload);
router.post('/stages/upload/commit', commitStageUpload);

router.get('/stages', listStages);
router.get('/stages/:id', getStage);
router.put('/stages/:id', updateStage);
router.post('/stages/:id/archive', archiveStage);
router.delete('/stages/:id/permanent', deleteStagePermanent);

// Interaction routes
router.post('/interactions', createInteraction);
router.post('/interactions/upload/preview', upload.single('file'), previewInteractionUpload);
router.post('/interactions/upload/commit', commitInteractionUpload);

router.get('/interactions', listInteractions);
router.get('/interactions/:id', getInteraction);
router.put('/interactions/:id', updateInteraction);
router.post('/interactions/:id/archive', archiveInteraction);
router.delete('/interactions/:id/permanent', deleteInteractionPermanent);

export default router;
