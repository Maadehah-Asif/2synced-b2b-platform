export type TouchFieldKey = 'lead_id' | 'campaign_id' | 'channel' | 'type' | 'touched_at' | 'status' | 'metadata';
export type TouchFormState = Record<TouchFieldKey, string>;
export type TouchMapping = Record<TouchFieldKey, string>;

export const TOUCH_CHANNEL_OPTIONS = ['email', 'ads', 'linkedin', 'webinar', 'other'] as const;
export const TOUCH_TYPE_OPTIONS = ['email_open', 'ad_click', 'webinar', 'email_click', 'form_submit', 'other'] as const;
export const TOUCH_STATUS_OPTIONS = ['active', 'archived'] as const;

export const TOUCH_REQUIRED_FIELDS: TouchFieldKey[] = ['lead_id', 'campaign_id', 'type', 'touched_at'];

export function emptyTouchForm(): TouchFormState {
  return {
    lead_id: '',
    campaign_id: '',
    channel: 'email',
    type: 'email_open',
    touched_at: '',
    status: 'active',
    metadata: '',
  };
}

export function defaultTouchMapping(): TouchMapping {
  return {
    lead_id: 'lead_id',
    campaign_id: 'campaign_id',
    channel: 'channel',
    type: 'type',
    touched_at: 'touched_at',
    status: 'status',
    metadata: 'metadata',
  };
}

export const TOUCH_HEADER_ALIASES: Record<TouchFieldKey, string[]> = {
  lead_id: ['lead_id', 'lead', 'lead id', 'email'],
  campaign_id: ['campaign_id', 'campaign id', 'campaign', 'campaign_name', 'campaign name'],
  channel: ['channel', 'touch_channel'],
  type: ['type', 'touch_type', 'interaction_type'],
  touched_at: ['touched_at', 'timestamp', 'date', 'datetime', 'touch_time'],
  status: ['status'],
  metadata: ['metadata', 'meta', 'notes'],
};
