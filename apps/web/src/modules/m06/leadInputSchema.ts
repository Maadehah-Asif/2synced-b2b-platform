export type LeadFieldKey =
  | 'lead_id'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'source'
  | 'owner'
  | 'industry'
  | 'region'
  | 'lead_score'
  | 'intent_score'
  | 'email'
  | 'job_title'
  | 'segment';

export type LeadFormState = Record<LeadFieldKey, string>;

export type LeadMapping = Record<LeadFieldKey, string>;

export type LeadSchemaField = {
  key: LeadFieldKey;
  label: string;
  required?: boolean;
  type: 'text' | 'number' | 'email' | 'select';
  helperText?: string;
  options?: readonly string[];
};

export const LEAD_SOURCE_OPTIONS = ['ads', 'linkedin', 'email', 'referral', 'webinar'] as const;
export const LEAD_OWNER_OPTIONS = ['Rep A', 'Rep B', 'Rep C'] as const;
export const LEAD_INDUSTRY_OPTIONS = ['IT', 'Finance', 'Healthcare', 'Retail', 'Education'] as const;
export const LEAD_REGION_OPTIONS = ['US', 'UK', 'UAE', 'PK', 'CA'] as const;
export const LEAD_SEGMENT_OPTIONS = ['SMB', 'Mid-Market', 'Enterprise'] as const;

export const LEAD_SCHEMA_FIELDS: LeadSchemaField[] = [
  { key: 'lead_id', label: 'Lead ID', required: true, type: 'text', helperText: 'Unique identifier for the lead record.' },
  { key: 'full_name', label: 'Full name', type: 'text' },
  { key: 'first_name', label: 'First name', type: 'text' },
  { key: 'last_name', label: 'Last name', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'source', label: 'Source', type: 'select', options: LEAD_SOURCE_OPTIONS, helperText: 'Use a supported source so dashboards group correctly.' },
  { key: 'owner', label: 'Owner', type: 'select', options: LEAD_OWNER_OPTIONS },
  { key: 'industry', label: 'Industry', type: 'select', options: LEAD_INDUSTRY_OPTIONS },
  { key: 'region', label: 'Region', type: 'select', options: LEAD_REGION_OPTIONS },
  { key: 'lead_score', label: 'Lead score', type: 'number', helperText: 'Numeric score only.' },
  { key: 'intent_score', label: 'Intent score', type: 'number', helperText: 'Numeric score only.' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'job_title', label: 'Job title', type: 'text' },
  { key: 'segment', label: 'Segment', type: 'select', options: LEAD_SEGMENT_OPTIONS },
];

export const LEAD_REQUIRED_FIELDS = LEAD_SCHEMA_FIELDS.filter((field) => field.required).map((field) => field.key);

export function emptyLeadForm(): LeadFormState {
  return {
    lead_id: '',
    full_name: '',
    first_name: '',
    last_name: '',
    company: '',
    source: '',
    owner: '',
    industry: '',
    region: '',
    lead_score: '',
    intent_score: '',
    email: '',
    job_title: '',
    segment: '',
  };
}

export function defaultLeadMapping(): LeadMapping {
  return {
    lead_id: 'lead_id',
    full_name: 'full_name',
    first_name: 'first_name',
    last_name: 'last_name',
    company: 'company',
    source: 'source',
    owner: 'owner',
    industry: 'industry',
    region: 'region',
    lead_score: 'lead_score',
    intent_score: 'intent_score',
    email: 'email',
    job_title: 'job_title',
    segment: 'segment',
  };
}

export const LEAD_HEADER_ALIASES: Record<LeadFieldKey, string[]> = {
  lead_id: ['lead_id', 'lead id', 'leadid'],
  full_name: ['full_name', 'full name', 'lead_name', 'name'],
  first_name: ['first_name', 'first name'],
  last_name: ['last_name', 'last name'],
  company: ['company', 'organization', 'account'],
  source: ['source', 'lead_source'],
  owner: ['owner', 'lead_owner'],
  industry: ['industry'],
  region: ['region', 'territory'],
  lead_score: ['lead_score', 'lead score', 'score'],
  intent_score: ['intent_score', 'intent score', 'intent'],
  email: ['email', 'email_address', 'email address'],
  job_title: ['job_title', 'job title', 'title'],
  segment: ['segment'],
};
