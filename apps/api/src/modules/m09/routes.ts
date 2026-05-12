import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    module: 'm09',
    status: 'ready',
  });
});

export default router;
