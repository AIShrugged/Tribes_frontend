// Types mirror the backend CommitReportResource / CommitReportItemResource toArray()
// (spodial_hr_backend/app/Http/Resources/API/v1/). Keep them 1:1 — do not drift.

export const COMMIT_REPORT_STATUSES = ['done', 'empty', 'partial'] as const;
export type CommitReportStatus = (typeof COMMIT_REPORT_STATUSES)[number];

export const COMMIT_ITEM_BUCKETS = ['added', 'fixed'] as const;
export type CommitItemBucket = (typeof COMMIT_ITEM_BUCKETS)[number];

export const MATCH_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCES)[number];

export const MATCH_SOURCES = ['explicit', 'semantic'] as const;
export type MatchSource = (typeof MATCH_SOURCES)[number];

export const SPEC_COVERAGES = [
  'covered',
  'partial',
  'uncovered',
  'unknown',
] as const;
export type SpecCoverage = (typeof SPEC_COVERAGES)[number];

export const REVIEW_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'failed',
  'deferred',
  'not_flagged',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface CommitReportMatchedTask {
  id: number;
  name: string | null;
  // raw backend Issue::status — may be 'closed'/'cancelled', i.e. OUTSIDE the entities/issue
  // IssueStatus union, so the UI narrows before reusing IssueStatusBadge.
  status: string | null;
}

export interface CommitReportRelatedIssue {
  id: number;
  name: string | null;
}

export interface CommitReportArchitectComment {
  good?: string | null;
  bad?: string | null;
  improve?: string | null;
  // model-written json: typically boolean, but rendered defensively.
  covers_spec?: boolean | string | null;
}

export interface CommitReportItem {
  id: number;
  sha: string;
  short_sha: string;
  bucket: CommitItemBucket;
  title: string | null;
  summary: string | null;
  position: number;
  matched: boolean;
  unmatched: boolean;
  matched_task: CommitReportMatchedTask | null;
  matched_confidence: MatchConfidence | null;
  match_source: MatchSource | null;
  evidence: string | null;
  related_issues: CommitReportRelatedIssue[];
  architect_comment: CommitReportArchitectComment | null;
  spec_coverage: SpecCoverage | null;
  review_status: ReviewStatus;
}

// Fields present on every report payload (list + detail).
interface CommitReportBase {
  id: number;
  repo: string;
  branch: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  status: CommitReportStatus;
  commit_count: number;
  total_in_window: number;
  created_at: string | null;
}

// LIST shape: counts via withCount, no child arrays.
export interface CommitReportSummary extends CommitReportBase {
  added_count: number;
  fixed_count: number;
  // run-health rollup (list path): items matched to a task / items deep-reviewed
  matched_count: number;
  reviewed_count: number;
}

// DETAIL shape: child arrays from reportItems, no counts.
export interface CommitReportDetail extends CommitReportBase {
  added: CommitReportItem[];
  fixed: CommitReportItem[];
}
