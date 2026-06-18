import { Badge } from '@/shared/ui/badge';

import type {
  CommitReportStatus,
  MatchConfidence,
  MatchSource,
  ReviewStatus,
  SpecCoverage,
} from '@/features/commit-reports/model/types';
import type { ComponentProps } from 'react';

type Variant = ComponentProps<typeof Badge>['variant'];

const REPORT_STATUS: Record<
  CommitReportStatus,
  { variant: Variant; label: string }
> = {
  done: { variant: 'success', label: 'Done' },
  partial: { variant: 'warning', label: 'Partial' },
  empty: { variant: 'neutral', label: 'Empty' },
};

export function ReportStatusBadge({ status }: { status: CommitReportStatus }) {
  const config = REPORT_STATUS[status] ?? REPORT_STATUS.empty;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const CONFIDENCE: Record<MatchConfidence, { variant: Variant; label: string }> =
  {
    high: { variant: 'success', label: 'High confidence' },
    medium: { variant: 'warning', label: 'Medium confidence' },
    low: { variant: 'danger', label: 'Low confidence' },
  };

export function MatchConfidenceBadge({
  value,
}: {
  value: MatchConfidence | null;
}) {
  if (!value) return null;
  const config = CONFIDENCE[value];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const SOURCE: Record<
  MatchSource,
  { variant: Variant; label: string; dot: boolean }
> = {
  explicit: { variant: 'neutral', label: 'Explicit', dot: false },
  semantic: { variant: 'info', label: 'Semantic', dot: true },
};

export function MatchSourceBadge({ value }: { value: MatchSource | null }) {
  if (!value) return null;
  const config = SOURCE[value];
  return (
    <Badge variant={config.variant} dot={config.dot}>
      {config.label}
    </Badge>
  );
}

export function UnmatchedBadge() {
  return (
    <Badge variant='warning' dot>
      Unmatched
    </Badge>
  );
}

const SPEC: Record<SpecCoverage, { variant: Variant; label: string }> = {
  covered: { variant: 'success', label: 'Spec covered' },
  partial: { variant: 'warning', label: 'Spec partial' },
  uncovered: { variant: 'danger', label: 'Spec uncovered' },
  unknown: { variant: 'neutral', label: 'Spec unknown' },
};

export function SpecCoverageBadge({ value }: { value: SpecCoverage | null }) {
  if (!value) return null;
  const config = SPEC[value];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const REVIEW: Record<ReviewStatus, { variant: Variant; label: string } | null> =
  {
    done: { variant: 'success', label: 'Reviewed' },
    in_progress: { variant: 'info', label: 'Reviewing…' },
    pending: { variant: 'warning', label: 'Review pending' },
    failed: { variant: 'danger', label: 'Review failed' },
    deferred: { variant: 'neutral', label: 'Review deferred' },
    not_flagged: null, // an unmatched item is never flagged for review — show nothing
  };

export function ReviewStatusBadge({ value }: { value: ReviewStatus }) {
  const config = REVIEW[value];
  if (!config) return null;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
