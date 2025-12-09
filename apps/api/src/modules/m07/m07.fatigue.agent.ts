import { CampaignTouch } from '../m06/models/CampaignTouch.js';
import type { FatigueRunOptions } from './m07.fatigue.types.js';

/**
 * Simple rule-based fatigue agent.
 * Accepts an array of touches (assumed to be CampaignTouch docs) and computes
 * per-lead counts, fatigue level and campaign aggregates.
 */
export async function runFatigueAgent(touches: any[], opts: FatigueRunOptions) {
  const { windowDays, threshold, channels } = opts;
  // filter channels if provided
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);

  const filtered = (touches || []).filter((t: any) => {
    if (!t) return false;
    if (t.touched_at && new Date(t.touched_at) < windowStart) return false;
    if (channels && channels.length) {
      const ch = (t.channel || '').toString();
      return channels.includes(ch);
    }
    return true;
  });

  // group touches by lead
  const byLead: Record<string, any[]> = {};
  for (const t of filtered) {
    const lid = String((t as any).lead_id);
    byLead[lid] = byLead[lid] || [];
    byLead[lid].push(t);
  }

  // group touches by campaign
  const byCampaign: Record<string, any[]> = {};
  for (const t of filtered) {
    const cid = String((t as any).campaign_id);
    byCampaign[cid] = byCampaign[cid] || [];
    byCampaign[cid].push(t);
  }

  // determine fatigue level using rules
  const leadsOut: any[] = [];
  for (const lid of Object.keys(byLead)) {
    const count = (byLead[lid] || []).length;
    let level: 'OK' | 'WARM' | 'TIRED' | 'BURNT_OUT' = 'OK';
    if (count <= threshold * 0.5) level = 'OK';
    else if (count <= threshold) level = 'WARM';
    else if (count <= threshold * 1.5) level = 'TIRED';
    else level = 'BURNT_OUT';

    // last touch and campaign
    const sorted = (byLead[lid] || []).slice().sort((a,b) => {
      const ta = a && a.touched_at ? new Date(a.touched_at).getTime() : 0;
      const tb = b && b.touched_at ? new Date(b.touched_at).getTime() : 0;
      return tb - ta;
    });
    const last = sorted[0];

    leadsOut.push({ leadId: lid, touchCount: count, fatigueLevel: level, lastTouch: last ? last.touched_at : null, lastCampaignId: last ? String(last.campaign_id) : null, lastCampaignName: last ? last.campaign_name || null : null });
  }

  // campaign level aggregates
  const campaignsOut: any[] = [];
  for (const cid of Object.keys(byCampaign)) {
    const arr = byCampaign[cid] || [];
    const leadsTouchedSet = new Set(arr.map(a => String(a.lead_id)));
    const leadsTouched = leadsTouchedSet.size;
    const avgTouches = (arr.length || 0) / Math.max(1, leadsTouched);

    // percent fatigued: compute how many distinct leads for this campaign exceed threshold
    let fatiguedLeads = 0;
    const byLeadForCampaign: Record<string, number> = {};
    for (const t of (arr || [])) {
      const l = String((t as any).lead_id);
      byLeadForCampaign[l] = (byLeadForCampaign[l] || 0) + 1;
    }
    for (const l of Object.keys(byLeadForCampaign)) {
      if ((byLeadForCampaign[l] || 0) > threshold) fatiguedLeads++;
    }
    const percentFatigued = Math.round((fatiguedLeads / Math.max(1, leadsTouched)) * 100);

    // recommended action simple heuristic
    let recommendedAction: 'slow_down' | 'pause' | 're_segment' | 'none' = 'none';
    if (avgTouches > threshold * 1.2) recommendedAction = 'pause';
    else if (avgTouches > threshold) recommendedAction = 'slow_down';
    else if (percentFatigued > 30) recommendedAction = 're_segment';

    campaignsOut.push({ campaignId: cid, leadsTouched, avgTouches, percentFatigued, recommendedAction });
  }

  // summary
  const summary = { ok: 0, warm: 0, tired: 0, burntOut: 0 } as any;
  for (const l of leadsOut) {
    if (l.fatigueLevel === 'OK') summary.ok++;
    else if (l.fatigueLevel === 'WARM') summary.warm++;
    else if (l.fatigueLevel === 'TIRED') summary.tired++;
    else if (l.fatigueLevel === 'BURNT_OUT') summary.burntOut++;
  }

  // most fatiguing campaign = highest avgTouches
  let mostFatiguingCampaign: string | null = null;
  if (campaignsOut.length) {
    campaignsOut.sort((a,b) => b.avgTouches - a.avgTouches);
    mostFatiguingCampaign = campaignsOut[0].campaignId;
  }

  const alerts: any[] = []; // agent could populate alerts suggestions

  return { leads: leadsOut, campaigns: campaignsOut, summary: { ...summary, mostFatiguingCampaign }, alerts };
}

export default { runFatigueAgent };
