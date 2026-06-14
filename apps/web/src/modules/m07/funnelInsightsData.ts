/**
 * Module: Funnel Insight (m07)
 * Layer: Frontend
 * File: funnelInsightsData.ts
 * Purpose: Supports the f un ne lI ns ig ht sD at a flow for this module.
 * Notes: Documentation header added for maintainability.
 */

export type M07Lead = {
  lead_id: string;
  full_name: string;
  company: string;
  source: string;
  owner: string;
  industry: string;
  segment: string;
  lead_score: number;
  intent_score: number;
};

export type M07StageEvent = {
  id: string;
  lead_id: string;
  stage_name: string;
  entered_at: string;
  exited_at?: string | null;
  stage_status: 'active' | 'completed' | 'dropped';
  next_stage?: string | null;
  exit_reason?: string | null;
};

export type M07Interaction = {
  id: string;
  lead_id: string;
  timestamp: string;
  interaction_type: string;
  channel: string;
  outcome: string;
  engagement_score: number;
};

export type M07Filters = {
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  industry?: string;
  owner?: string;
  segment?: string;
};

export const STAGE_ORDER = ['Lead', 'MQL', 'SQL', 'Proposal', 'Closed'] as const;

export const sampleLeads: M07Lead[] = [
  { lead_id: 'L-1001', full_name: 'Ayesha Khan', company: 'Nova AI', source: 'Webinar', owner: 'Rep A', industry: 'Technology', segment: 'SMB', lead_score: 81, intent_score: 74 },
  { lead_id: 'L-1002', full_name: 'Omar Malik', company: 'CloudAxis', source: 'LinkedIn', owner: 'Rep B', industry: 'Finance', segment: 'Enterprise', lead_score: 67, intent_score: 59 },
  { lead_id: 'L-1003', full_name: 'Emma Wilson', company: 'TechSoft', source: 'Referral', owner: 'Rep C', industry: 'Healthcare', segment: 'Mid-Market', lead_score: 73, intent_score: 65 },
  { lead_id: 'L-1004', full_name: 'Ali Shah', company: 'Pixel Labs', source: 'Ads', owner: 'Rep A', industry: 'Retail', segment: 'SMB', lead_score: 62, intent_score: 48 },
  { lead_id: 'L-1005', full_name: 'Sara Ahmed', company: 'DataWorks', source: 'Email', owner: 'Rep B', industry: 'Technology', segment: 'Enterprise', lead_score: 88, intent_score: 79 },
  { lead_id: 'L-1006', full_name: 'Noah Lee', company: 'MarketGuru', source: 'Webinar', owner: 'Rep C', industry: 'Education', segment: 'Mid-Market', lead_score: 70, intent_score: 61 },
  { lead_id: 'L-1007', full_name: 'Fatima Iqbal', company: 'Nova AI', source: 'Referral', owner: 'Rep A', industry: 'Technology', segment: 'Enterprise', lead_score: 76, intent_score: 69 },
  { lead_id: 'L-1008', full_name: 'David Smith', company: 'XYZ Corp', source: 'Ads', owner: 'Rep B', industry: 'Finance', segment: 'Mid-Market', lead_score: 58, intent_score: 41 },
  { lead_id: 'L-1009', full_name: 'Zara Ali', company: 'ABC Ltd', source: 'LinkedIn', owner: 'Rep C', industry: 'Healthcare', segment: 'SMB', lead_score: 64, intent_score: 55 },
  { lead_id: 'L-1010', full_name: 'John Brown', company: 'CloudAxis', source: 'Email', owner: 'Rep A', industry: 'Retail', segment: 'Enterprise', lead_score: 84, intent_score: 72 },
];

export const sampleStages: M07StageEvent[] = [
  { id: 'S-1', lead_id: 'L-1001', stage_name: 'Lead', entered_at: '2026-01-03', exited_at: '2026-01-07', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-2', lead_id: 'L-1001', stage_name: 'MQL', entered_at: '2026-01-07', exited_at: '2026-01-12', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-3', lead_id: 'L-1001', stage_name: 'SQL', entered_at: '2026-01-12', exited_at: '2026-01-21', stage_status: 'completed', next_stage: 'Proposal' },
  { id: 'S-4', lead_id: 'L-1001', stage_name: 'Proposal', entered_at: '2026-01-21', exited_at: '2026-01-29', stage_status: 'completed', next_stage: 'Closed' },
  { id: 'S-5', lead_id: 'L-1001', stage_name: 'Closed', entered_at: '2026-01-29', stage_status: 'active' },
  { id: 'S-6', lead_id: 'L-1002', stage_name: 'Lead', entered_at: '2026-01-05', exited_at: '2026-01-11', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-7', lead_id: 'L-1002', stage_name: 'MQL', entered_at: '2026-01-11', exited_at: '2026-01-26', stage_status: 'dropped', exit_reason: 'No follow-up after qualification' },
  { id: 'S-8', lead_id: 'L-1003', stage_name: 'Lead', entered_at: '2026-01-08', exited_at: '2026-01-15', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-9', lead_id: 'L-1003', stage_name: 'MQL', entered_at: '2026-01-15', exited_at: '2026-01-25', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-10', lead_id: 'L-1003', stage_name: 'SQL', entered_at: '2026-01-25', stage_status: 'active' },
  { id: 'S-11', lead_id: 'L-1004', stage_name: 'Lead', entered_at: '2026-02-01', exited_at: '2026-02-10', stage_status: 'dropped', exit_reason: 'Low engagement after first outreach' },
  { id: 'S-12', lead_id: 'L-1005', stage_name: 'Lead', entered_at: '2026-02-03', exited_at: '2026-02-08', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-13', lead_id: 'L-1005', stage_name: 'MQL', entered_at: '2026-02-08', exited_at: '2026-02-14', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-14', lead_id: 'L-1005', stage_name: 'SQL', entered_at: '2026-02-14', exited_at: '2026-02-20', stage_status: 'completed', next_stage: 'Proposal' },
  { id: 'S-15', lead_id: 'L-1005', stage_name: 'Proposal', entered_at: '2026-02-20', stage_status: 'active' },
  { id: 'S-16', lead_id: 'L-1006', stage_name: 'Lead', entered_at: '2026-02-04', exited_at: '2026-02-11', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-17', lead_id: 'L-1006', stage_name: 'MQL', entered_at: '2026-02-11', exited_at: '2026-02-21', stage_status: 'dropped', exit_reason: 'Budget pushed to next quarter' },
  { id: 'S-18', lead_id: 'L-1007', stage_name: 'Lead', entered_at: '2026-02-12', exited_at: '2026-02-17', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-19', lead_id: 'L-1007', stage_name: 'MQL', entered_at: '2026-02-17', exited_at: '2026-02-25', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-20', lead_id: 'L-1007', stage_name: 'SQL', entered_at: '2026-02-25', exited_at: '2026-03-04', stage_status: 'completed', next_stage: 'Proposal' },
  { id: 'S-21', lead_id: 'L-1007', stage_name: 'Proposal', entered_at: '2026-03-04', exited_at: '2026-03-20', stage_status: 'dropped', exit_reason: 'Went with competitor' },
  { id: 'S-22', lead_id: 'L-1008', stage_name: 'Lead', entered_at: '2026-03-01', exited_at: '2026-03-06', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-23', lead_id: 'L-1008', stage_name: 'MQL', entered_at: '2026-03-06', stage_status: 'active' },
  { id: 'S-24', lead_id: 'L-1009', stage_name: 'Lead', entered_at: '2026-03-05', exited_at: '2026-03-13', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-25', lead_id: 'L-1009', stage_name: 'MQL', entered_at: '2026-03-13', exited_at: '2026-03-22', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-26', lead_id: 'L-1009', stage_name: 'SQL', entered_at: '2026-03-22', stage_status: 'active' },
  { id: 'S-27', lead_id: 'L-1010', stage_name: 'Lead', entered_at: '2026-03-07', exited_at: '2026-03-12', stage_status: 'completed', next_stage: 'MQL' },
  { id: 'S-28', lead_id: 'L-1010', stage_name: 'MQL', entered_at: '2026-03-12', exited_at: '2026-03-19', stage_status: 'completed', next_stage: 'SQL' },
  { id: 'S-29', lead_id: 'L-1010', stage_name: 'SQL', entered_at: '2026-03-19', exited_at: '2026-03-31', stage_status: 'dropped', exit_reason: 'Decision delayed with no re-engagement' },
];

export const sampleInteractions: M07Interaction[] = [
  { id: 'I-1', lead_id: 'L-1001', timestamp: '2026-01-04T10:00:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 76 },
  { id: 'I-2', lead_id: 'L-1001', timestamp: '2026-01-10T11:20:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'positive', engagement_score: 83 },
  { id: 'I-3', lead_id: 'L-1001', timestamp: '2026-01-24T15:40:00', interaction_type: 'demo', channel: 'zoom', outcome: 'positive', engagement_score: 88 },
  { id: 'I-4', lead_id: 'L-1002', timestamp: '2026-01-09T09:30:00', interaction_type: 'call', channel: 'phone', outcome: 'follow-up needed', engagement_score: 54 },
  { id: 'I-5', lead_id: 'L-1002', timestamp: '2026-01-17T16:10:00', interaction_type: 'email', channel: 'email', outcome: 'no response', engagement_score: 38 },
  { id: 'I-6', lead_id: 'L-1002', timestamp: '2026-01-21T14:05:00', interaction_type: 'email', channel: 'email', outcome: 'no response', engagement_score: 31 },
  { id: 'I-7', lead_id: 'L-1003', timestamp: '2026-01-12T10:10:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 65 },
  { id: 'I-8', lead_id: 'L-1003', timestamp: '2026-01-28T13:45:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'positive', engagement_score: 72 },
  { id: 'I-9', lead_id: 'L-1004', timestamp: '2026-02-03T09:00:00', interaction_type: 'email', channel: 'email', outcome: 'follow-up needed', engagement_score: 43 },
  { id: 'I-10', lead_id: 'L-1004', timestamp: '2026-02-05T11:10:00', interaction_type: 'call', channel: 'phone', outcome: 'no response', engagement_score: 28 },
  { id: 'I-11', lead_id: 'L-1005', timestamp: '2026-02-06T12:00:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'positive', engagement_score: 82 },
  { id: 'I-12', lead_id: 'L-1005', timestamp: '2026-02-12T10:50:00', interaction_type: 'call', channel: 'phone', outcome: 'positive', engagement_score: 79 },
  { id: 'I-13', lead_id: 'L-1005', timestamp: '2026-02-19T15:15:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 77 },
  { id: 'I-14', lead_id: 'L-1005', timestamp: '2026-02-22T08:40:00', interaction_type: 'email', channel: 'email', outcome: 'follow-up needed', engagement_score: 66 },
  { id: 'I-15', lead_id: 'L-1006', timestamp: '2026-02-10T14:45:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 61 },
  { id: 'I-16', lead_id: 'L-1006', timestamp: '2026-02-16T15:20:00', interaction_type: 'call', channel: 'phone', outcome: 'no response', engagement_score: 41 },
  { id: 'I-17', lead_id: 'L-1007', timestamp: '2026-02-15T10:00:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'positive', engagement_score: 74 },
  { id: 'I-18', lead_id: 'L-1007', timestamp: '2026-02-18T09:00:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 71 },
  { id: 'I-19', lead_id: 'L-1007', timestamp: '2026-02-19T09:30:00', interaction_type: 'email', channel: 'email', outcome: 'follow-up needed', engagement_score: 59 },
  { id: 'I-20', lead_id: 'L-1007', timestamp: '2026-02-20T10:00:00', interaction_type: 'call', channel: 'phone', outcome: 'follow-up needed', engagement_score: 52 },
  { id: 'I-21', lead_id: 'L-1007', timestamp: '2026-02-21T11:30:00', interaction_type: 'email', channel: 'email', outcome: 'no response', engagement_score: 39 },
  { id: 'I-22', lead_id: 'L-1007', timestamp: '2026-03-10T10:00:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'negative', engagement_score: 34 },
  { id: 'I-23', lead_id: 'L-1008', timestamp: '2026-03-04T13:20:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 58 },
  { id: 'I-24', lead_id: 'L-1008', timestamp: '2026-03-14T09:20:00', interaction_type: 'email', channel: 'email', outcome: 'follow-up needed', engagement_score: 48 },
  { id: 'I-25', lead_id: 'L-1009', timestamp: '2026-03-12T15:35:00', interaction_type: 'call', channel: 'phone', outcome: 'positive', engagement_score: 63 },
  { id: 'I-26', lead_id: 'L-1009', timestamp: '2026-03-24T10:00:00', interaction_type: 'meeting', channel: 'zoom', outcome: 'positive', engagement_score: 70 },
  { id: 'I-27', lead_id: 'L-1010', timestamp: '2026-03-11T08:45:00', interaction_type: 'email', channel: 'email', outcome: 'positive', engagement_score: 68 },
  { id: 'I-28', lead_id: 'L-1010', timestamp: '2026-03-15T08:45:00', interaction_type: 'call', channel: 'phone', outcome: 'follow-up needed', engagement_score: 56 },
  { id: 'I-29', lead_id: 'L-1010', timestamp: '2026-03-20T08:45:00', interaction_type: 'email', channel: 'email', outcome: 'no response', engagement_score: 40 },
  { id: 'I-30', lead_id: 'L-1010', timestamp: '2026-03-24T08:45:00', interaction_type: 'email', channel: 'email', outcome: 'no response', engagement_score: 32 },
];

export function getFilterOptions() {
  return {
    sources: Array.from(new Set(sampleLeads.map((lead) => lead.source))).sort(),
    industries: Array.from(new Set(sampleLeads.map((lead) => lead.industry))).sort(),
    owners: Array.from(new Set(sampleLeads.map((lead) => lead.owner))).sort(),
    segments: Array.from(new Set(sampleLeads.map((lead) => lead.segment))).sort(),
  };
}

export function applyLeadFilters(filters: M07Filters) {
  return sampleLeads.filter((lead) => {
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.industry && lead.industry !== filters.industry) return false;
    if (filters.owner && lead.owner !== filters.owner) return false;
    if (filters.segment && lead.segment !== filters.segment) return false;
    return true;
  });
}

function isDateInRange(value: string, filters: M07Filters) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  if (filters.dateFrom && time < new Date(filters.dateFrom).getTime()) return false;
  if (filters.dateTo && time > new Date(filters.dateTo).getTime()) return false;
  return true;
}

export function getFilteredStageEvents(filters: M07Filters) {
  const leadIds = new Set(applyLeadFilters(filters).map((lead) => lead.lead_id));
  return sampleStages.filter((item) => leadIds.has(item.lead_id) && isDateInRange(item.entered_at, filters));
}

export function getFilteredInteractions(filters: M07Filters) {
  const leadIds = new Set(applyLeadFilters(filters).map((lead) => lead.lead_id));
  return sampleInteractions.filter((item) => leadIds.has(item.lead_id) && isDateInRange(item.timestamp, filters));
}

export function getCurrentStage(leadId: string, filters?: M07Filters) {
  const rows = (filters ? getFilteredStageEvents(filters) : sampleStages)
    .filter((item) => item.lead_id === leadId)
    .sort((a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime());
  return rows[rows.length - 1] || null;
}

export function getLatestInteraction(leadId: string, filters?: M07Filters) {
  const rows = (filters ? getFilteredInteractions(filters) : sampleInteractions)
    .filter((item) => item.lead_id === leadId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return rows[rows.length - 1] || null;
}

export function getStageDurationDays(item: M07StageEvent) {
  const start = new Date(item.entered_at).getTime();
  const end = item.exited_at ? new Date(item.exited_at).getTime() : new Date('2026-04-01').getTime();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

export function getFunnelOverview(filters: M07Filters) {
  const leads = applyLeadFilters(filters);
  const events = getFilteredStageEvents(filters);
  const currentStages = leads.map((lead) => ({ lead, stage: getCurrentStage(lead.lead_id, filters) }));
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: currentStages.filter((item) => (item.stage?.stage_name || 'Unassigned') === stage).length,
  }));
  const unassigned = currentStages.filter((item) => !item.stage).length;
  const droppedEvents = events.filter((item) => item.stage_status === 'dropped');
  const closedCount = currentStages.filter((item) => item.stage?.stage_name === 'Closed').length;
  const conversionRate = leads.length ? Math.round((closedCount / leads.length) * 100) : 0;
  const dropOffRate = events.length ? Math.round((droppedEvents.length / events.length) * 100) : 0;
  const avgTimeInFunnel = leads.length
    ? Math.round(
        leads.reduce((sum, lead) => {
          const leadEvents = events.filter((item) => item.lead_id === lead.lead_id);
          if (!leadEvents.length) return sum;
          const first = new Date(leadEvents[0].entered_at).getTime();
          const last = new Date(leadEvents[leadEvents.length - 1].exited_at || leadEvents[leadEvents.length - 1].entered_at).getTime();
          return sum + Math.max(0, Math.round((last - first) / (1000 * 60 * 60 * 24)));
        }, 0) / leads.length
      )
    : 0;
  const conversionTable = STAGE_ORDER.map((stage) => {
    const entered = events.filter((item) => item.stage_name === stage).length;
    const progressed = events.filter((item) => item.stage_name === stage && item.next_stage).length;
    const dropped = events.filter((item) => item.stage_name === stage && item.stage_status === 'dropped').length;
    const conversion = entered ? Math.round((progressed / entered) * 100) : 0;
    return { stage, entered, progressed, dropped, conversion };
  });
  const leadsTable = leads.map((lead) => {
    const stage = getCurrentStage(lead.lead_id, filters);
    const interaction = getLatestInteraction(lead.lead_id, filters);
    return {
      ...lead,
      currentStage: stage?.stage_name || 'Unassigned',
      timeInStage: stage ? getStageDurationDays(stage) : 0,
      lastInteractionDate: interaction?.timestamp || null,
      status: stage?.stage_status || 'unassigned',
    };
  });
  return {
    totalLeads: leads.length,
    activeLeads: currentStages.filter((item) => item.stage && item.stage.stage_status === 'active').length,
    conversionRate,
    dropOffRate,
    avgTimeInFunnel,
    stageCounts: unassigned ? [...stageCounts, { stage: 'Unassigned', count: unassigned }] : stageCounts,
    conversionTable,
    leadsTable,
  };
}

export function getLeakageAnalysis(filters: M07Filters) {
  const events = getFilteredStageEvents(filters);
  const rows = STAGE_ORDER.map((stage) => {
    const stageEvents = events.filter((item) => item.stage_name === stage);
    const dropped = stageEvents.filter((item) => item.stage_status === 'dropped');
    const entered = stageEvents.length;
    const dropRate = entered ? Math.round((dropped.length / entered) * 100) : 0;
    const avgTime = stageEvents.length ? Math.round(stageEvents.reduce((sum, item) => sum + getStageDurationDays(item), 0) / stageEvents.length) : 0;
    const reasons = Array.from(new Set(dropped.map((item) => item.exit_reason || 'Unknown')));
    return {
      stage,
      entered,
      droppedLeads: dropped.length,
      dropRate,
      avgTime,
      reasons,
      droppedLeadIds: dropped.map((item) => item.lead_id),
    };
  });
  const highestLeak = [...rows].sort((a, b) => b.dropRate - a.dropRate)[0];
  const longestDelay = [...rows].sort((a, b) => b.avgTime - a.avgTime)[0];
  const totalDropped = rows.reduce((sum, row) => sum + row.droppedLeads, 0);
  const avgDropRate = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.dropRate, 0) / rows.length) : 0;
  return { rows, highestLeak, longestDelay, totalDropped, avgDropRate };
}

export function getLeadJourney(leadId: string) {
  const lead = sampleLeads.find((item) => item.lead_id === leadId) || null;
  const stageEvents = sampleStages.filter((item) => item.lead_id === leadId).sort((a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime());
  const interactions = sampleInteractions.filter((item) => item.lead_id === leadId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const timeline = [
    ...stageEvents.map((item) => ({ kind: 'stage', title: `${item.stage_name} stage entered`, subtitle: item.stage_status === 'dropped' ? `Dropped${item.exit_reason ? `: ${item.exit_reason}` : ''}` : item.stage_status, date: item.entered_at })),
    ...interactions.map((item) => ({ kind: 'interaction', title: `${item.interaction_type} via ${item.channel}`, subtitle: `${item.outcome} • engagement ${item.engagement_score}`, date: item.timestamp })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalTime = stageEvents.length
    ? Math.max(0, Math.round((new Date(stageEvents[stageEvents.length - 1].exited_at || stageEvents[stageEvents.length - 1].entered_at).getTime() - new Date(stageEvents[0].entered_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const finalStage = stageEvents[stageEvents.length - 1];
  return {
    lead,
    stageEvents,
    interactions,
    timeline,
    totalTouches: 0,
    totalInteractions: interactions.length,
    totalTime,
    finalStatus: finalStage?.stage_status || 'unassigned',
  };
}

export function getFatigueAnalysis(filters: M07Filters) {
  const leads = applyLeadFilters(filters);
  const interactions = getFilteredInteractions(filters);
  const rows = leads.map((lead) => {
    const leadInteractions = interactions.filter((item) => item.lead_id === lead.lead_id);
    const latestTime = leadInteractions.length ? new Date(leadInteractions[leadInteractions.length - 1].timestamp).getTime() : 0;
    const windowStart = latestTime ? latestTime - 21 * 24 * 60 * 60 * 1000 : 0;
    const recentCount = leadInteractions.filter((item) => new Date(item.timestamp).getTime() >= windowStart).length;
    const avgScore = leadInteractions.length ? Math.round(leadInteractions.reduce((sum, item) => sum + item.engagement_score, 0) / leadInteractions.length) : 0;
    const noResponseCount = leadInteractions.filter((item) => item.outcome === 'no response').length;
    const fatigueLevel =
      recentCount >= 5 || noResponseCount >= 2 ? 'High' :
      recentCount >= 3 || avgScore < 55 ? 'Medium' :
      leadInteractions.length ? 'Low' : 'None';
    return { ...lead, interactions: leadInteractions.length, timeWindowDays: leadInteractions.length ? 21 : 0, avgEngagementScore: avgScore, fatigueLevel, recentCount };
  });
  return {
    totalLeads: rows.length,
    fatiguedLeads: rows.filter((row) => row.fatigueLevel === 'High' || row.fatigueLevel === 'Medium').length,
    avgInteractions: rows.length ? Number((rows.reduce((sum, row) => sum + row.interactions, 0) / rows.length).toFixed(1)) : 0,
    highRiskLeads: rows.filter((row) => row.fatigueLevel === 'High').length,
    rows,
  };
}

export function getRecommendations() {
  const fatigue = getFatigueAnalysis({}).rows;
  const currentLeads = getFunnelOverview({}).leadsTable;
  return currentLeads.flatMap((lead) => {
    const fatigueRow = fatigue.find((item) => item.lead_id === lead.lead_id);
    const stage = getCurrentStage(lead.lead_id);
    const cards: Array<{ id: string; leadId: string; type: string; priority: string; owner: string; recommendation: string; reason: string; confidence: number }> = [];
    if (fatigueRow?.fatigueLevel === 'High') {
      cards.push({ id: `${lead.lead_id}-fatigue`, leadId: lead.lead_id, type: 'fatigue', priority: 'High', owner: lead.owner, recommendation: 'Reduce communication frequency', reason: `${fatigueRow.recentCount} recent interactions with weakening engagement signal.`, confidence: 87 });
    }
    if (stage && stage.stage_status === 'active' && getStageDurationDays(stage) > 10 && stage.stage_name !== 'Closed') {
      cards.push({ id: `${lead.lead_id}-stagnation`, leadId: lead.lead_id, type: 'leakage', priority: 'Medium', owner: lead.owner, recommendation: 'Review stage progression and re-engage', reason: `${stage.stage_name} has been active for ${getStageDurationDays(stage)} days with no exit yet.`, confidence: 74 });
    }
    if (stage?.stage_status === 'dropped') {
      cards.push({ id: `${lead.lead_id}-recovery`, leadId: lead.lead_id, type: 'recovery', priority: 'Medium', owner: lead.owner, recommendation: 'Move lead back to nurture stage', reason: stage.exit_reason || 'Dropped from funnel with no explicit reason recorded.', confidence: 69 });
    }
    return cards;
  });
}

export function getTrendSeries(filters: M07Filters) {
  const events = getFilteredStageEvents(filters);
  return ['Jan', 'Feb', 'Mar', 'Apr'].map((label, idx) => {
    const month = idx + 1;
    const stageEntries = events.filter((item) => new Date(item.entered_at).getMonth() + 1 === month);
    const closed = stageEntries.filter((item) => item.stage_name === 'Closed').length;
    const dropped = stageEntries.filter((item) => item.stage_status === 'dropped').length;
    const added = stageEntries.filter((item) => item.stage_name === 'Lead').length;
    return { label, leadsAdded: added, conversionRate: added ? Math.round((closed / added) * 100) : 0, stageMovement: stageEntries.length, dropped };
  });
}
