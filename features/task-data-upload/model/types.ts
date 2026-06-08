export interface TaskDataUploadResponse {
  upload_id: number;
  status: string;
}

export type UploadStatus =
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'deduplicating'
  | 'done'
  | 'failed';

export interface TaskDataUploadStatusResponse {
  upload_id: number;
  status: UploadStatus;
  original_filename: string;
  issues_created: number;
  issues_updated: number;
  /** Present when status is 'failed'. User-facing reason for the failure. */
  error_message?: string;
  /** Issues created by this upload (status 'new'). */
  issues?: Array<{
    id: number;
    name: string;
    status: 'new';
  }>;
  /** Pre-existing issues this upload updated (status 'updated'). */
  updated_issues?: Array<{
    id: number;
    name: string;
    status: 'updated';
  }>;
}

export const STATUS_LABELS: Record<UploadStatus, string> = {
  queued: 'Queued for processing…',
  extracting: 'Reading and extracting file content…',
  analyzing: 'Analyzing document with AI…',
  deduplicating: 'Checking for duplicates with existing tasks…',
  done: 'Processing complete',
  failed: 'Processing failed',
};

export const STATUS_PROGRESS: Record<UploadStatus, number> = {
  queued: 5,
  extracting: 20,
  analyzing: 45,
  deduplicating: 75,
  done: 100,
  failed: 0,
};
