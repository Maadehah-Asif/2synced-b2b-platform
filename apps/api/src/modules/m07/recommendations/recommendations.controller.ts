import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRecommendations, runRecommendations, markDone, markDismissed } from './recommendations.service.js';

export async function getRecs(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || (req.query.workspaceId as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });
    const filters: any = {};
    if (req.query.stage) filters.stage = String(req.query.stage);
    if (req.query.leakage) filters.leakage = String(req.query.leakage);
    if (req.query.fatigue) filters.fatigue = String(req.query.fatigue);
    if (req.query.campaign) filters.campaign = String(req.query.campaign);
    if (req.query.owner) filters.owner = String(req.query.owner);
    if (req.query.status) filters.status = String(req.query.status);

    const out = await getRecommendations(workspace, filters);
    return res.json(out);
  } catch (e:any) {
    console.error('[m07/recommendations/get]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export async function postRunRecs(req: Request, res: Response) {
  try {
    const workspace = (req.body.workspace as string) || (req.query.workspace as string) || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace_required' });
    res.json({ ok: true, started: true });
    // kick off background recompute
    runRecommendations(workspace, req.body || {}).catch(err => console.error('[m07/recommendations/run] background', err?.stack || err));
  } catch (e:any) {
    console.error('[m07/recommendations/postRun]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export async function postMarkDone(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'id_required' });
    const userId = (req as any).user?.id || null;
    await markDone(id, userId);
    return res.json({ ok: true });
  } catch (e:any) {
    console.error('[m07/recommendations/done]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export async function postMarkDismiss(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'id_required' });
    const userId = (req as any).user?.id || null;
    const note = (req.body && (req.body.note as string)) || (req.query.note as string) || null;
    await markDismissed(id, userId, note);
    return res.json({ ok: true });
  } catch (e:any) {
    console.error('[m07/recommendations/dismiss]', e?.stack || e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

export default { getRecs, postRunRecs, postMarkDone, postMarkDismiss };
