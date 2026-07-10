// ------------------------------
// Second-brain (Temp tab) domain types.
// Mirrors the backend BrainSuggestion / BrainEvent `format()` shapes
// (app/Http/Controllers/API/v1/Brain*Controller.php) exactly.
// ------------------------------

// --- Suggestions ---

export type BrainSuggestionStatus =
  | 'pending'
  | 'applied'
  | 'rejected'
  | 'failed'
  | 'superseded'
  | 'expired';

export type BrainSuggestionKey =
  | 'create_issue'
  | 'update_task_status'
  | 'add_comment'
  | 'save_meeting_summary'
  | 'save_meeting_agenda';

export interface BrainSuggestionEvidence {
  meeting_id?: number | null;
  decision_id?: number | null;
  issue_id?: number | null;
  quote?: string | null;
}

/** payload for key="create_issue" — the action intent the brain proposes. */
export interface CreateIssuePayload {
  name: string;
  type: string;
  description?: string | null;
  team_id?: number | null;
  assignee_id?: number | null;
  due_date?: string | null;
  source_type?: string | null;
  source_id?: number | null;
}

/** payload for key="update_task_status". */
export interface UpdateTaskStatusPayload {
  issue_id: number;
  status: string;
}

/** payload for key="add_comment". */
export interface AddCommentPayload {
  issue_id: number;
  comment: string;
}

/**
 * payload for key="save_meeting_summary" — a brain-drafted protocol awaiting
 * approval. Same shape as the {@link MeetingSummary} artifact (Section 1) minus
 * the server-computed `attendees`/`repeated_discussions`. `commitments` is
 * carried but not rendered in the preview (Section 1 does not show it).
 */
export interface SaveMeetingSummaryPayload {
  calendar_event_id: number;
  title?: string | null;
  summary?: string | null;
  key_points?: string[];
  decisions?: string[];
  commitments?: unknown[];
}

/**
 * payload for key="save_meeting_agenda" — a brain-drafted agenda awaiting
 * approval. `calendar_event_id` is the NEXT meeting the agenda attaches to;
 * `source_meeting_id` is the processed meeting (informational).
 */
export interface SaveMeetingAgendaPayload {
  calendar_event_id: number;
  type?: MeetingAgendaType;
  content?: string | null;
  raw_json?: AgendaRawJson | null;
  source_meeting_id?: number | null;
}

export type BrainSuggestionPayload =
  | CreateIssuePayload
  | UpdateTaskStatusPayload
  | AddCommentPayload
  | SaveMeetingSummaryPayload
  | SaveMeetingAgendaPayload
  | Record<string, unknown>;

/** applied_result for key="create_issue" — present after approve. */
export interface CreateIssueResult {
  issue_id: number;
  name: string;
}

/** applied_result for key="update_task_status" — present after approve. */
export interface UpdateTaskStatusResult {
  issue_id: number;
  old_status: string;
  new_status: string;
}

/** applied_result for key="add_comment" — present after approve. */
export interface AddCommentResult {
  issue_id: number;
  comment_id: number;
}

export type BrainAppliedResult =
  | CreateIssueResult
  | UpdateTaskStatusResult
  | AddCommentResult
  | Record<string, unknown>;

export interface BrainSuggestion {
  id: number;
  organization_id: number;
  run_uuid: string | null;
  key: BrainSuggestionKey | string;
  title: string;
  summary: string | null;
  reasoning: string | null;
  evidence: BrainSuggestionEvidence | null;
  confidence: number | null;
  payload: BrainSuggestionPayload;
  status: BrainSuggestionStatus | string;
  applied_result: BrainAppliedResult | null;
  failure_reason: string | null;
  dedupe_key: string | null;
  created_at: string | null;
  resolved_at: string | null;
  applied_at: string | null;
}

// --- Reasoning log (events) ---

export type BrainEventType =
  | 'reasoning'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'cycle_summary'
  | 'cycle_start';

export interface BrainEvent {
  id: number;
  organization_id: number;
  run_uuid: string | null;
  seq: number;
  type: BrainEventType | string;
  tool_name: string | null;
  content: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string | null;
  created_at: string | null;
}

/** A reasoning log group — all events from one loop pass (run_uuid). */
export interface BrainEventGroup {
  runUuid: string | null;
  events: BrainEvent[];
}

// --- Filters ---

export type SuggestionStatusFilter = 'pending' | 'applied' | 'rejected' | 'all';

export interface BrainOrgOption {
  id: number;
  name: string;
}

// --- Mutation outcomes (approve / reject) ---
// Distinct kinds let the UI render the right state per HTTP status:
// 200 applied/rejected, 422 failed (with reason), 409 conflict (stale row), 403 forbidden.

export type BrainApproveOutcome =
  | { kind: 'applied'; suggestion: BrainSuggestion }
  | { kind: 'failed'; suggestion: BrainSuggestion }
  | { kind: 'conflict'; suggestion: BrainSuggestion | null; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string };

export type BrainRejectOutcome =
  | { kind: 'rejected'; suggestion: BrainSuggestion }
  | { kind: 'conflict'; suggestion: BrainSuggestion | null; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string };

// ------------------------------
// Second-brain instances (per-organization enable/disable).
// Mirrors the backend brain-instances endpoints exactly (secrets are write-only
// and NEVER returned — only `claude_auth_type` reveals the active auth mode).
// ------------------------------

/** Lifecycle status of an organization's second-brain container. */
export type SecondBrainStatus =
  | 'disabled' // off, or never enabled
  | 'pending' // enabling — container coming up (transitional)
  | 'running' // up and working
  | 'stopping' // disabling (transitional)
  | 'stopped' // stopped (transitional)
  | 'error'; // failed — see `last_error`

/** Claude credential kind: OAuth subscription token vs. Anthropic API key. */
export type ClaudeAuthType = 'oauth' | 'api_key';

export interface SecondBrainInstance {
  organization_id: number;
  enabled: boolean;
  status: SecondBrainStatus;
  container_name: string | null;
  claude_auth_type: ClaudeAuthType | null;
  /** Reason shown when `status === 'error'`. */
  last_error: string | null;
  last_started_at: string | null; // iso8601
  last_reconciled_at: string | null; // iso8601
}

/**
 * Enable payload. Credential fields are required on the FIRST enable and
 * optional afterwards: send `{}` to re-enable with the stored credential, or
 * new values to rotate it (the container is recreated).
 */
export interface EnableBrainPayload {
  claude_auth_type?: ClaudeAuthType;
  claude_auth_token?: string;
}

/** Domain error codes returned in `meta.error_code` by the brain endpoints. */
export type SecondBrainErrorCode =
  | 'SECOND_BRAIN_MANAGER_REQUIRED'
  | 'SECOND_BRAIN_FORBIDDEN'
  | 'SECOND_BRAIN_CREDENTIAL_REQUIRED'
  | 'SECOND_BRAIN_INVALID_AUTH_TYPE';

// ------------------------------
// Meeting protocol (summary) & agenda — the "Протокол и агенда" tab.
// Both artifacts are written to the same tables by either the main pipeline or
// the second brain (after manager approval), and read back through the
// calendar-event endpoints below:
//   GET  /calendar-events/{id}/meeting-summary          → MeetingSummary
//   POST /calendar-events/{id}/meeting-summary/generate → MeetingSummary
//   GET  /calendar-events/{id}/agendas                  → MeetingAgenda[]
//   POST /calendar-events/{id}/agendas/generate         → 202 (async job)
// ------------------------------

/**
 * Generation lifecycle of a protocol/agenda artifact. Backend enum AgendaStatus
 * and the meeting_summaries.status column share these values. Render content
 * only on `done`; show a spinner on `pending`/`in_progress`; show a retry plate
 * on `failed`.
 */
export type MeetingArtifactStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'failed';

/** A protocol attendee — MeetingSummaryResource maps participants to `{ name }`. */
export interface MeetingSummaryAttendee {
  name: string | null;
}

/**
 * A decision that came up again — the summary flags it against the earlier one.
 * Free-form JSON on the backend; every field is tolerated as optional.
 */
export interface MeetingSummaryRepeatedDiscussion {
  new_decision?: string | null;
  previous_decision?: string | null;
  previous_date?: string | null;
}

/**
 * Meeting protocol — the AI summary of the meeting that just happened.
 * Mirrors MeetingSummaryResource::toArray() exactly.
 */
export interface MeetingSummary {
  id: number;
  calendar_event_id: number;
  status: MeetingArtifactStatus;
  title: string | null;
  /** Narrative summary in Markdown (`##` headings, lists). */
  summary: string | null;
  key_points: string[];
  decisions: string[];
  repeated_discussions: MeetingSummaryRepeatedDiscussion[];
  attendees: MeetingSummaryAttendee[];
  created_at: string;
  updated_at: string;
}

/** Agenda scope: shared meeting agenda vs. a single participant's personal one. */
export type MeetingAgendaType = 'general' | 'personal';

/** One agenda discussion topic — title with an optional elaboration. */
export interface AgendaDiscussionTopic {
  title?: string | null;
  description?: string | null;
}

/** A row of the "Проверка обязательств" table in the agenda. */
export interface AgendaCommitmentCheck {
  person?: string | null;
  commitment?: string | null;
  deadline?: string | null;
  status?: string | null;
  question?: string | null;
}

/**
 * Structured agenda payload (meeting_agendas.raw_json). Every field is optional —
 * the generator may omit any of them. Prefer this over `content` for rendering.
 */
export interface AgendaRawJson {
  meeting_goal?: string | null;
  main_problem?: string | null;
  discussion_topics?: AgendaDiscussionTopic[];
  commitments_check?: AgendaCommitmentCheck[];
  decisions_recap?: string[];
  [key: string]: unknown;
}

/**
 * Meeting agenda — the agenda of the NEXT meeting in the series.
 * Mirrors the raw MeetingAgenda model returned by AgendaController (no Resource).
 */
export interface MeetingAgenda {
  id: number;
  calendar_event_id: number;
  user_id: number | null;
  type: MeetingAgendaType;
  status: MeetingArtifactStatus;
  /** Pre-rendered Markdown agenda — fallback when `raw_json` is empty. */
  content: string | null;
  raw_json: AgendaRawJson | null;
  sent_at: string | null;
  send_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}
