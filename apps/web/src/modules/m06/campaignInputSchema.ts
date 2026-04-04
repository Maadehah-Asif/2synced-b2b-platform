export type CampaignFieldKey =
  | 'campaign_id'
  | 'name'
  | 'channel'
  | 'description'
  | 'tags'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'spend';

export type CampaignFormState = Record<CampaignFieldKey, string>;
export type CampaignMapping = Record<CampaignFieldKey, string>;

export type CampaignSchemaField = {
  key: CampaignFieldKey;
  label: string;
  required?: boolean;
  type: 'text' | 'number' | 'date' | 'select';
  helperText?: string;
  options?: string[];
};

export const CAMPAIGN_CHANNEL_OPTIONS = ['email', 'ads', 'linkedin', 'webinar', 'other'] as const;
export const CAMPAIGN_STATUS_OPTIONS = ['active', 'archived'] as const;

export const CAMPAIGN_SCHEMA_FIELDS: CampaignSchemaField[] = [
  { key: 'campaign_id', label: 'Campaign ID', required: true, type: 'text', helperText: 'Unique campaign identifier.' },
  { key: 'name', label: 'Name', required: true, type: 'text' },
  { key: 'channel', label: 'Channel', required: true, type: 'select', options: [...CAMPAIGN_CHANNEL_OPTIONS] },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'tags', label: 'Tags', type: 'text', helperText: 'Comma-separated tags.' },
  { key: 'start_date', label: 'Start date', type: 'date' },
  { key: 'end_date', label: 'End date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: [...CAMPAIGN_STATUS_OPTIONS] },
  { key: 'spend', label: 'Spend', required: true, type: 'number', helperText: 'Must be 0 or higher.' },
];

export const CAMPAIGN_REQUIRED_FIELDS = CAMPAIGN_SCHEMA_FIELDS.filter((field) => field.required).map((field) => field.key);

export function emptyCampaignForm(): CampaignFormState {
  return {
    campaign_id: '',
    name: '',
    channel: 'email',
    description: '',
    tags: '',
    start_date: '',
    end_date: '',
    status: 'active',
    spend: '',
  };
}

export function defaultCampaignMapping(): CampaignMapping {
  return {
    campaign_id: 'campaign_id',
    name: 'name',
    channel: 'channel',
    description: 'description',
    tags: 'tags',
    start_date: 'start_date',
    end_date: 'end_date',
    status: 'status',
    spend: 'spend',
  };
}

export const CAMPAIGN_HEADER_ALIASES: Record<CampaignFieldKey, string[]> = {
  campaign_id: ['campaign_id', 'campaign id', 'campaignid', 'camp_id', 'id'],
  name: ['name', 'campaign_name', 'campaign name', 'campaign'],
  channel: ['channel', 'utm_medium', 'source', 'utm_source'],
  description: ['description', 'details', 'notes', 'campaign description'],
  tags: ['tags', 'tag', 'labels'],
  start_date: ['start_date', 'start date', 'start', 'begin_date'],
  end_date: ['end_date', 'end date', 'end', 'finish_date'],
  status: ['status'],
  spend: ['spend', 'amount', 'cost', 'budget'],
};
