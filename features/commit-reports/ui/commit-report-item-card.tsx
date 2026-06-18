import Link from 'next/link';

import { IssueStatusBadge } from '@/entities/issue';
import {
  MatchConfidenceBadge,
  MatchSourceBadge,
  ReviewStatusBadge,
  SpecCoverageBadge,
  UnmatchedBadge,
} from '@/features/commit-reports/ui/commit-report-badges';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';

import type { IssueStatus } from '@/entities/issue';
import type {
  CommitReportArchitectComment,
  CommitReportItem,
} from '@/features/commit-reports/model/types';

// entities/issue's IssueStatus union covers only the 6 live statuses; the matched task's raw
// backend status may be closed/cancelled, so narrow before reusing IssueStatusBadge.
const ISSUE_STATUSES: readonly IssueStatus[] = [
  'open',
  'in_progress',
  'paused',
  'review',
  'reopen',
  'done',
];

function isIssueStatus(value: string): value is IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value);
}

function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

function MatchedTaskStatus({ status }: { status: string | null }) {
  if (!status) return null;
  if (isIssueStatus(status)) return <IssueStatusBadge status={status} />;
  return <Badge variant='neutral'>{humanize(status)}</Badge>;
}

function MatchRow({ item }: { item: CommitReportItem }) {
  const trailing = (
    <>
      <SpecCoverageBadge value={item.spec_coverage} />
      <ReviewStatusBadge value={item.review_status} />
    </>
  );

  if (!item.matched_task) {
    return (
      <div className='mt-2 flex flex-wrap items-center gap-2'>
        <UnmatchedBadge />
        {trailing}
      </div>
    );
  }

  return (
    <div className='mt-2 flex flex-wrap items-center gap-2'>
      <Link
        href={ROUTES.DASHBOARD.ISSUES_DETAIL(item.matched_task.id)}
        className='inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-white/5'
      >
        {item.matched_task.name ?? `Task #${item.matched_task.id}`}
      </Link>
      <MatchedTaskStatus status={item.matched_task.status} />
      <MatchConfidenceBadge value={item.matched_confidence} />
      <MatchSourceBadge value={item.match_source} />
      {trailing}
    </div>
  );
}

function RelatedIssues({
  issues,
}: {
  issues: CommitReportItem['related_issues'];
}) {
  if (issues.length === 0) return null;

  return (
    <div className='mt-2 flex flex-wrap items-center gap-1.5'>
      <span className='text-xs text-muted-foreground'>Related:</span>
      {issues.map((related) => {
        return (
          <Link
            key={related.id}
            href={ROUTES.DASHBOARD.ISSUES_DETAIL(related.id)}
            className='rounded-full border border-border px-2 py-0.5 text-xs text-primary transition-colors hover:bg-white/5'
          >
            {related.name ?? `#${related.id}`}
          </Link>
        );
      })}
    </div>
  );
}

function CommentLine({
  label,
  labelClass,
  text,
}: {
  label: string;
  labelClass: string;
  text: string;
}) {
  return (
    <p>
      <span className={`font-medium ${labelClass}`}>{label}</span>{' '}
      <span className='text-muted-foreground'>{text}</span>
    </p>
  );
}

function ArchitectComment({
  comment,
}: {
  comment: CommitReportArchitectComment | null;
}) {
  if (!comment) return null;

  return (
    <div className='mt-3 space-y-1 rounded-[var(--radius-card)] border border-border px-3 py-2 text-sm'>
      {comment.good && (
        <CommentLine
          label='Good:'
          labelClass='text-[var(--success)]'
          text={comment.good}
        />
      )}
      {comment.bad && (
        <CommentLine
          label='Concerns:'
          labelClass='text-[var(--danger)]'
          text={comment.bad}
        />
      )}
      {comment.improve && (
        <CommentLine
          label='Improve:'
          labelClass='text-[var(--warning)]'
          text={comment.improve}
        />
      )}
      {typeof comment.covers_spec === 'boolean' && (
        <CommentLine
          label='Covers spec:'
          labelClass='text-foreground'
          text={comment.covers_spec ? 'Yes' : 'No'}
        />
      )}
    </div>
  );
}

export function CommitReportItemCard({ item }: { item: CommitReportItem }) {
  return (
    <div className='rounded-[var(--radius-card)] border border-border bg-card px-4 py-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium text-foreground'>
            {item.title ?? item.short_sha}
          </p>
          {item.summary && (
            <p className='mt-0.5 text-sm text-muted-foreground'>
              {item.summary}
            </p>
          )}
        </div>
        <code className='shrink-0 rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-xs text-muted-foreground'>
          {item.short_sha}
        </code>
      </div>

      <MatchRow item={item} />

      {item.evidence && (
        <p className='mt-2 text-xs text-muted-foreground'>
          Match: {item.evidence}
        </p>
      )}

      <RelatedIssues issues={item.related_issues} />
      <ArchitectComment comment={item.architect_comment} />
    </div>
  );
}
