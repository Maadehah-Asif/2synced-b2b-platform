export type StageFieldKey =
  | 'lead_id'
  | 'stage_name'
  | 'entered_at'
  | 'exited_at'
  | 'stage_status'
  | 'next_stage'
  | 'exit_reason'
  | 'notes';

export type StageFormState = Record<StageFieldKey, string>;
export type StageMapping = Record<StageFieldKey, string>;

export const STAGE_STATUS_OPTIONS = ['active', 'completed', 'dropped'] as const;
export const STAGE_REQUIRED_FIELDS: StageFieldKey[] = ['lead_id', 'stage_name', 'entered_at'];
export const STAGE_FIELD_LABELS: Record<StageFieldKey, string> = {
  lead_id: 'Lead ID',
  stage_name: 'Stage Name',
  entered_at: 'Entered At',
  exited_at: 'Exited At',
  stage_status: 'Stage Status',
  next_stage: 'Next Stage',
  exit_reason: 'Exit Reason',
  notes: 'Notes',
};

export function emptyStageForm(): StageFormState {
  return {
    lead_id: '',
    stage_name: '',
    entered_at: '',
    exited_at: '',
    stage_status: 'active',
    next_stage: '',
    exit_reason: '',
    notes: '',
  };
}

export function defaultStageMapping(): StageMapping {
  return {
    lead_id: '',
    stage_name: '',
    entered_at: '',
    exited_at: '',
    stage_status: '',
    next_stage: '',
    exit_reason: '',
    notes: '',
  };
}

export const STAGE_HEADER_ALIASES: Record<StageFieldKey, string[]> = {
  lead_id: ['lead_id', 'lead id', 'lead', 'leadid'],
  stage_name: ['stage_name', 'stage name', 'stage', 'stagename'],
  entered_at: ['entered_at', 'entered at', 'entered', 'enter date', 'entered date'],
  exited_at: ['exited_at', 'exited at', 'exited', 'exit date', 'exited date'],
  stage_status: ['stage_status', 'stage status', 'status'],
  next_stage: ['next_stage', 'next stage'],
  exit_reason: ['exit_reason', 'exit reason', 'reason'],
  notes: ['notes', 'note', 'comments'],
};
