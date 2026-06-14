/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: dealInputSchema.ts
 * Purpose: Supports the d ea lI np ut Sc he ma flow for this module.
 * Notes: Documentation header added for maintainability.
 */

export type DealFieldKey = 'deal_id' | 'lead_id' | 'revenue' | 'currency' | 'closed_won' | 'closed_at';
export type DealFormState = Record<DealFieldKey, string>;
export type DealMapping = Record<DealFieldKey, string>;

export const DEAL_CURRENCY_OPTIONS = ['USD', 'PKR', 'EUR'] as const;

export const DEAL_REQUIRED_FIELDS: DealFieldKey[] = ['deal_id', 'lead_id', 'revenue', 'closed_won'];

export function emptyDealForm(): DealFormState {
  return {
    deal_id: '',
    lead_id: '',
    revenue: '',
    currency: 'USD',
    closed_won: 'true',
    closed_at: '',
  };
}

export function defaultDealMapping(): DealMapping {
  return {
    deal_id: 'deal_id',
    lead_id: 'lead_id',
    revenue: 'revenue',
    currency: 'currency',
    closed_won: 'closed_won',
    closed_at: 'closed_at',
  };
}

export const DEAL_HEADER_ALIASES: Record<DealFieldKey, string[]> = {
  deal_id: ['deal_id', 'deal id', 'external_id', 'id'],
  lead_id: ['lead_id', 'lead id', 'lead', 'lead_email', 'email'],
  revenue: ['revenue', 'amount', 'value'],
  currency: ['currency', 'curr'],
  closed_won: ['closed_won', 'won', 'is_won', 'status'],
  closed_at: ['closed_at', 'closed', 'close_date'],
};
