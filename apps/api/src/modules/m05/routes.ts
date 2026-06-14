/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Backend
 * File: routes.ts
 * Purpose: Supports the r ou te s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { Router } from 'express';
import { attachOptionalUser } from '../core/auth/middleware.js';
import {
  addCommunicationReply,
  archiveCommunicationThread,
  createCommunicationThread,
  deleteCommunicationThread,
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
router.patch('/communication/threads/:threadId/archive', archiveCommunicationThread);
router.delete('/communication/threads/:threadId', deleteCommunicationThread);

export default router;
