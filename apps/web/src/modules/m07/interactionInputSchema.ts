/**
 * Module: Funnel Insight (m07)
 * Layer: Frontend
 * File: interactionInputSchema.ts
 * Purpose: Supports the i nt er ac ti on In pu tS ch em a flow for this module.
 * Notes: Documentation header added for maintainability.
 */

export type InteractionFieldKey =
  | 'interaction_id'
  | 'lead_id'
  | 'timestamp'
  | 'interaction_type'
  | 'channel'
  | 'campaign_id'
  | 'outcome'
  | 'engagement_score'
  | 'notes';

export type InteractionFormState = Record<InteractionFieldKey, string>;
export type InteractionMapping = Record<InteractionFieldKey, string>;

export const INTERACTION_TYPE_OPTIONS = ['call', 'email', 'meeting', 'demo'] as const;
export const INTERACTION_CHANNEL_OPTIONS = ['phone', 'email', 'zoom', 'linkedin'] as const;
export const INTERACTION_OUTCOME_OPTIONS = ['positive', 'negative', 'no response', 'follow-up needed'] as const;
export const INTERACTION_REQUIRED_FIELDS: InteractionFieldKey[] = ['lead_id', 'timestamp', 'interaction_type'];
export const INTERACTION_FIELD_LABELS: Record<InteractionFieldKey, string> = {
  interaction_id: 'Interaction ID',
  lead_id: 'Lead ID',
  timestamp: 'Timestamp',
  interaction_type: 'Interaction Type',
  channel: 'Channel',
  campaign_id: 'Campaign ID',
  outcome: 'Outcome',
  engagement_score: 'Engagement Score',
  notes: 'Notes',
};

export function emptyInteractionForm(): InteractionFormState {
  return {
    interaction_id: '',
    lead_id: '',
    timestamp: '',
    interaction_type: 'email',
    channel: '',
    campaign_id: '',
    outcome: '',
    engagement_score: '',
    notes: '',
  };
}

export function defaultInteractionMapping(): InteractionMapping {
  return {
    interaction_id: '',
    lead_id: '',
    timestamp: '',
    interaction_type: '',
    channel: '',
    campaign_id: '',
    outcome: '',
    engagement_score: '',
    notes: '',
  };
}

export const INTERACTION_HEADER_ALIASES: Record<InteractionFieldKey, string[]> = {
  interaction_id: ['interaction_id', 'interaction id', 'id'],
  lead_id: ['lead_id', 'lead id', 'lead', 'leadid'],
  timestamp: ['timestamp', 'time', 'event time', 'interaction time'],
  interaction_type: ['interaction_type', 'interaction type', 'type'],
  channel: ['channel', 'medium'],
  campaign_id: ['campaign_id', 'campaign id', 'campaign'],
  outcome: ['outcome', 'result'],
  engagement_score: ['engagement_score', 'engagement score', 'score'],
  notes: ['notes', 'note', 'comments'],
};
