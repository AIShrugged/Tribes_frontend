/**
 * Types for the pre-moderation review screen. Mirrors the backend ExtractionPlan `plan` JSON
 * (see ExtractionPlanController / ExtractionPlanSections). UID-keyed so edits/removals never drift.
 *
 * `UploadReviewType` is declared locally (NOT imported from features/uploads) to keep this slice
 * free of cross-feature imports per the FSD boundary rules.
 */
export type UploadReviewType = 'transcript' | 'task_data';

export interface ExtractionPlanIssueItem {
  uid: string;
  name: string;
  description: string | null;
  type: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: string | null;
  author_name: string | null;
}

export interface ExtractionPlanIssueDecision {
  uid: string | null;
  action: 'create' | 'update' | 'skip';
  existing_issue_id: number | null;
  update_description: string | null;
}

export interface ExtractionPlanExistingSnapshot {
  id: number;
  name: string;
  assignee_name: string | null;
  due_date: string | null;
  priority: string | number | null;
}

export interface ExtractionPlanDecisionItem {
  uid: string;
  text: string;
  author_name: string | null;
  topic: string | null;
  skip: boolean;
}

export interface ExtractionPlanIssuesSection {
  items: ExtractionPlanIssueItem[];
  decisions: ExtractionPlanIssueDecision[] | null;
  existing_snapshots: ExtractionPlanExistingSnapshot[];
}

export interface ExtractionPlanPayload {
  issues: ExtractionPlanIssuesSection | null;
  decisions: { items: ExtractionPlanDecisionItem[] } | null;
  review: { review_id: number } | null;
}

export interface ExtractionPlanResponse {
  status: string;
  plan: ExtractionPlanPayload | null;
}

/** PATCH body — only the editable fields, keyed by uid. Rows absent from the arrays are dropped. */
export interface ExtractionPlanEditInput {
  issues?: Array<{
    uid: string;
    assignee_name?: string | null;
    due_date?: string | null;
    priority?: string | null;
    type?: string | null;
  }>;
  decisions?: Array<{
    uid: string;
    text?: string;
    author_name?: string | null;
    topic?: string | null;
    skip?: boolean;
  }>;
}
