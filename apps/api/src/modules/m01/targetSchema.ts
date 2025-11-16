export type TargetColumn = {
  key: string;
  label?: string;
  type: 'integer' | 'text' | 'timestamptz' | 'numeric' | 'boolean';
  required?: boolean;
};

// Canonical target schema for Module 01 (Team-provided)
export const TARGET_SCHEMA_VERSION = 'v1';

export const TARGET_SCHEMA: TargetColumn[] = [
  { key: 'lead_id', type: 'integer', required: true },
  { key: 'intent_tier', type: 'integer' },
  { key: 'lead_response_time_avg', type: 'numeric' },
  { key: 'touchpoint_diversity_score', type: 'numeric' },
  { key: 'days_since_first_contact', type: 'integer' },
  { key: 'engagement_consistency_index', type: 'numeric' },
  { key: 'sentiment_score_recent', type: 'numeric' },
  { key: 'website_visits_last_30d', type: 'integer' },
  { key: 'product_demo_requested', type: 'boolean' },
  { key: 'average_meeting_duration', type: 'numeric' },
  { key: 'account_activity_index', type: 'numeric' },
  { key: 'total_emails_sent', type: 'integer' },
  { key: 'total_open_count', type: 'integer' },
  { key: 'total_click_count', type: 'integer' },
  { key: 'total_reply_count', type: 'integer' },
  { key: 'total_actions', type: 'integer' },
  { key: 'days_since_last_email', type: 'integer' },
  { key: 'days_since_last_action', type: 'integer' },
  { key: 'email_relationship_span_days', type: 'integer' },
  { key: 'open_rate', type: 'numeric' },
  { key: 'click_rate', type: 'numeric' },
  { key: 'unsubscribe_rate', type: 'numeric' },
  { key: 'accepted_connection_count', type: 'integer' },
  { key: 'connection_accept_rate', type: 'numeric' },
  { key: 'channel_call', type: 'boolean' },
  { key: 'channel_email', type: 'boolean' },
  { key: 'channel_linkedin', type: 'boolean' },
  { key: 'engagement_recent', type: 'numeric' },
  { key: 'reply_behavior_score', type: 'numeric' },
  { key: 'meeting_signal', type: 'numeric' },
  { key: 'activity_per_touch', type: 'numeric' },
  { key: 'account_engaged', type: 'boolean' },
  { key: 'activity_intensity', type: 'numeric' },
  { key: 'engagement_score_recent', type: 'numeric' },
  { key: 'demo_interest_score', type: 'boolean' },

  { key: 'campaign_id', type: 'integer' },
  { key: 'sequence_number', type: 'integer' },
  { key: 'sent_time', type: 'timestamptz' },
  { key: 'opened_time', type: 'timestamptz' },
  { key: 'clicked_time', type: 'timestamptz' },
  { key: 'replied_time', type: 'timestamptz' },
  { key: 'open_count', type: 'integer' },
  { key: 'click_count', type: 'integer' },
  { key: 'is_unsubscribed', type: 'boolean' },

  { key: 'last_action_taken', type: 'text' },
  { key: 'last_action_date', type: 'timestamptz' },
  { key: 'sender_status', type: 'text' },
  { key: 'company_id', type: 'integer' },
  { key: 'tier_id', type: 'integer' },
  { key: 'profile_url', type: 'text' },
  { key: 'first_name', type: 'text' },
  { key: 'last_name', type: 'text' },
  { key: 'full_name', type: 'text' },
  { key: 'headline', type: 'text' },
  { key: 'job_title', type: 'text' },
  { key: 'location', type: 'text' },
  { key: 'company', type: 'text' },
  { key: 'company_domain', type: 'text' },
  { key: 'work_email', type: 'text' },
  { key: 'created_at', type: 'timestamptz' },
  { key: 'updated_at', type: 'timestamptz' },
  { key: 'custom_fields', type: 'text' },
  { key: 'engagement_score', type: 'integer' },

  { key: 'sales_pressure_index', type: 'numeric' },
  { key: 'is_urgent_escalation', type: 'boolean' },
  { key: 'rep_priority_bucket', type: 'integer' },
  { key: 'escalation_risk_score', type: 'numeric' },
  { key: 'crm_anomaly_flag', type: 'boolean' },
  { key: 'random_spike_factor', type: 'numeric' },
];

export default TARGET_SCHEMA;
