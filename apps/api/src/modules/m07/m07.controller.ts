import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getFunnelHealth } from './m07.service.js';

export async function funnelHealth(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || (req.query.workspaceId as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });

    const from = req.query.from ? new Date(req.query.from as string) : null;
    const to = req.query.to ? new Date(req.query.to as string) : null;
    const stagesParam = (req.query.stages as string | undefined) || undefined;
    const stages = stagesParam ? stagesParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const result = await getFunnelHealth({ workspace, from, to, stages });
    return res.json(result);
  } catch (e) {
    console.error('[m07/funnelHealth]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export default { funnelHealth };
