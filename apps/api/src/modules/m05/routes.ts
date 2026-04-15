import { Router } from 'express';
import { attachOptionalUser } from '../core/auth/middleware.js';
import {
  addCommunicationReply,
  createCommunicationThread,
  getCommunicationThreadDetail,
  getWebEngagementAnalytics,
  listCommunicationThreads,
  updateCommunicationThreadPriority,
  updateCommunicationThreadStatus,
} from './controllers.js';

const router = Router();

router.use(attachOptionalUser);

router.get('/web-engagement/:uploadId/analytics', getWebEngagementAnalytics);
router.get('/communication/threads', listCommunicationThreads);
router.get('/communication/threads/:threadId', getCommunicationThreadDetail);
router.post('/communication/threads', createCommunicationThread);
router.post('/communication/threads/:threadId/messages', addCommunicationReply);
router.patch('/communication/threads/:threadId/status', updateCommunicationThreadStatus);
router.patch('/communication/threads/:threadId/priority', updateCommunicationThreadPriority);

export default router;
