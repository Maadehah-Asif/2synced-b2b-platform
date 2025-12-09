import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { getFatigueDashboard, runFatigueDetection } from './m07.fatigue.service.js';
import { WorkspaceMember } from '../core/auth/models/WorkspaceMember.js';

export async function getFatigue(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || (req.query.workspaceId as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });

    // membership check: if user present, ensure they belong to workspace
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (userId) {
      const member = await WorkspaceMember.findOne({ workspaceId: workspace, userId: userId as any }).lean();
      if (!member) return res.status(403).json({ error: 'not_a_member' });
    }

    const dashboard = await getFatigueDashboard(workspace, req.query || {});
    return res.json(dashboard);
  } catch (e: any) {
    console.error('[m07/fatigue/get]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export async function postRunFatigue(req: Request, res: Response) {
  try {
    const workspace = (req.body.workspace as string) || (req.query.workspace as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });

    const windowDays = Number(req.body.windowDays || req.query.windowDays || 7);
    const threshold = Number(req.body.threshold || req.query.threshold || 8);
    const channels = Array.isArray(req.body.channels) ? req.body.channels : (req.body.channels ? String(req.body.channels).split(',').map((s:string)=>s.trim()) : []);

    if (![7,14,30].includes(windowDays)) return res.status(400).json({ error: 'invalid_window_days' });
    if (!threshold || threshold <= 0) return res.status(400).json({ error: 'invalid_threshold' });

    // create kick-off response and run in background
    res.json({ ok: true, started: true });

    // run detection in background
    runFatigueDetection(workspace, { windowDays: windowDays as any, threshold, channels }).catch(err => {
      console.error('[m07/fatigue/run] background error', err?.stack || err);
    });
  } catch (e: any) {
    console.error('[m07/fatigue/postRun]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export default { getFatigue, postRunFatigue };
