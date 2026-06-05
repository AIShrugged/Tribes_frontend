export type UploadType = 'transcript' | 'task_data';

export type NormalizedUploadStatus = 'processing' | 'done' | 'failed';

/** One row of the unified Upload Log feed (GET /uploads). */
export interface UploadLogItem {
  id: number;
  type: UploadType;
  original_filename: string;
  status: NormalizedUploadStatus;
  error_message: string | null;
  uploader_name: string | null;
  team_name: string | null;
  created_at: string;
  calendar_event_id: number | null;
  issues_created: number | null;
  issues_updated: number | null;
}

/** Live-derived pipeline signals for a done transcript upload. */
export interface UploadDetailProcessing {
  has_summary: boolean;
  has_review: boolean;
  followups_count: number;
  issues_created: number;
  issues_updated: number;
}

export interface UploadDetailTranscript {
  id: number;
  type: 'transcript';
  original_filename: string;
  status: NormalizedUploadStatus;
  error_message: string | null;
  calendar_event_id: number | null;
  /** Meeting date (Y-m-d, app TZ) — used to deep-link the meetings list to that day. */
  calendar_event_date: string | null;
  transcript_entries_count: number | null;
  participants_count: number | null;
  processing: UploadDetailProcessing | null;
  uploader_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadDetailIssue {
  id: number;
  name: string;
  status: string;
}

export interface UploadDetailTaskData {
  id: number;
  type: 'task_data';
  original_filename: string;
  status: NormalizedUploadStatus;
  raw_status: TaskDataRawStatus;
  error_message: string | null;
  issues_created: number;
  issues_updated: number;
  /** Issues created by this upload (status 'new'). */
  issues: UploadDetailIssue[];
  /** Pre-existing issues this upload updated (status 'updated'). */
  updated_issues: UploadDetailIssue[];
  uploader_name: string | null;
  team_name: string | null;
  created_at: string;
  updated_at: string;
}

export type UploadDetail = UploadDetailTranscript | UploadDetailTaskData;

/**
 * Raw task-data processing statuses, declared LOCALLY (not imported from
 * features/task-data-upload — that would be a cross-feature FSD violation, and
 * the constants there are not barrel-exported). Drives the inline timeline.
 */
export type TaskDataRawStatus =
  | 'queued'
  | 'processing'
  | 'extracting'
  | 'analyzing'
  | 'deduplicating'
  | 'done'
  | 'failed';

export const TASK_DATA_STATUS_LABELS: Record<TaskDataRawStatus, string> = {
  queued: 'Queued for processing…',
  processing: 'Queued for processing…',
  extracting: 'Reading and extracting file content…',
  analyzing: 'Analyzing document with AI…',
  deduplicating: 'Checking for duplicates with existing tasks…',
  done: 'Processing complete',
  failed: 'Processing failed',
};

export const TASK_DATA_STATUS_PROGRESS: Record<TaskDataRawStatus, number> = {
  queued: 5,
  processing: 5,
  extracting: 20,
  analyzing: 45,
  deduplicating: 75,
  done: 100,
  failed: 0,
};
