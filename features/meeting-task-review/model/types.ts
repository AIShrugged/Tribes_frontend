export interface MeetingListItem {
  id: number;
  title: string;
  starts_at: string;
}

export type MeetingTaskReviewStatus = 'pending' | 'done' | 'failed';

export type MeetingTaskReviewBlockType =
  | 'status_not_updated'
  | 'blocked'
  | 'no_assignee'
  | 'incomplete_info'
  | 'overdue'
  | 'stuck_in_progress'
  | 'abandoned';

export type MeetingTaskReviewSuggestion =
  | 'update_status'
  | 'resolve_blocker'
  | 'reassign'
  | 'fill_info'
  | 'update_due_date'
  | 'escalate'
  | 'close';

export type MeetingTaskIssueStatus =
  | 'open'
  | 'in_progress'
  | 'paused'
  | 'review'
  | 'reopen'
  | 'done';

export interface MeetingTaskReviewIssue {
  id: number;
  name: string;
  status: MeetingTaskIssueStatus;
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  days_inactive: number;
  suggestion: MeetingTaskReviewSuggestion;
  transcript_evidence: string | null;
}

export interface MeetingTaskReviewBlock {
  type: MeetingTaskReviewBlockType;
  label: string;
  count: number;
  issues: MeetingTaskReviewIssue[];
}

export interface MeetingTaskReview {
  id: number;
  calendar_event_id: number;
  status: MeetingTaskReviewStatus;
  analyzed_count: number;
  discussed_count: number;
  generated_at: string;
  error: string | null;
  llm_blocks: MeetingTaskReviewBlock[];
  health_blocks: MeetingTaskReviewBlock[];
}
