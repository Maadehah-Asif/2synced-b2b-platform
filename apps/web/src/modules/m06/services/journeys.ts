/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: journeys.ts
 * Purpose: Supports the j ou rn ey s flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { getWorkspaceIdFromHash } from '../../../utils/workspace';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type JourneyPreviewParams = {
  from?: string
  to?: string
  status?: string
  channel?: string
  page?: number
  limit?: number
}

export async function previewJourneys(params: JourneyPreviewParams){
  const workspaceId = getWorkspaceIdFromHash();
  const usp = new URLSearchParams();
  if(workspaceId) usp.set('projectId', workspaceId);
  Object.keys(params || {}).forEach((k) => {
    const key = k as keyof JourneyPreviewParams
    const v = params[key]
    if(v!==undefined && v!==null && v!=='') usp.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/m06/preview?${usp.toString()}`);
  if(!res.ok) throw new Error('preview_failed');
  return await res.json();
}

export async function getJourney(dealId: string){
  const workspaceId = getWorkspaceIdFromHash();
  const usp = new URLSearchParams();
  if(workspaceId) usp.set('projectId', workspaceId);
  const res = await fetch(`${API_BASE}/m06/journey/${dealId}?${usp.toString()}`);
  if(!res.ok) throw new Error('journey_failed');
  return await res.json();
}
