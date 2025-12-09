import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getLeakageDashboard, runLeakagePrediction } from './m07.leakage.service.js';
import { LeakageModelRun } from './models/LeakageModelRun.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';

export async function getLeakage(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || (req.query.workspaceId as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });

    // membership check: if user present, ensure they belong to workspace
    const userId = (req as any).user?.id ?? null;
    if (userId) {
      const member = await WorkspaceMember.findOne({ workspaceId: workspace, userId: userId as any }).lean();
      if (!member) return res.status(403).json({ error: 'forbidden' });
    }

    const dashboard = await getLeakageDashboard(workspace, req.query || {});
    return res.json(dashboard);
  } catch (e) {
    console.error('[m07/getLeakage]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function postRunLeakage(req: Request, res: Response) {
  try {
    const workspace = (req.body.workspace as string) || (req.query.workspace as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });

    const userId = (req as any).user?.id ?? null;
    if (userId) {
      const member = await WorkspaceMember.findOne({ workspaceId: workspace, userId: userId as any }).lean();
      if (!member) return res.status(403).json({ error: 'forbidden' });
    }

    // Create a run record and start processing in background
    const run = await LeakageModelRun.create({ workspaceId: workspace, modelVersion: req.body.modelVersion || 'v1', startedAt: new Date(), status: 'PENDING' });
    // fire-and-forget background processing
    runLeakagePrediction(workspace, { modelVersion: req.body.modelVersion || 'v1' }, run._id).catch((err) => {
      console.error('[m07/postRunLeakage background error]', err);
    });

    return res.json({ ok: true, runId: String(run._id) });
  } catch (e: any) {
    console.error('[m07/postRunLeakage]', e);
    return res.status(500).json({ error: e?.message || 'internal' });
  }
}

export default { getLeakage, postRunLeakage };
