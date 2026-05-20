import {
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';

import { IssueStatusBadge } from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import { Card } from '@/shared/ui/card';

import type { MeetingDecision } from '../model/types';
import type { IssueStatus } from '@/entities/issue';

/**
 * Секция «Decisions» (пункты протокола) на странице митинга.
 * Под каждым решением — связанные задачи (decision_issue pivot).
 * Решения без задач помечаются как uncovered.
 */
export function MeetingDecisionsSection({
  decisions,
}: {
  decisions: MeetingDecision[];
}) {
  if (decisions.length === 0) {
    return null;
  }

  const uncoveredCount = decisions.filter((d) => {
    return d.is_uncovered;
  }).length;

  return (
    <Card className='px-5 py-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          <CheckCircle2 className='h-3.5 w-3.5' />
          Decisions ({decisions.length})
        </div>
        {uncoveredCount > 0 && (
          <span className='inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400'>
            <AlertTriangle className='h-3.5 w-3.5' />
            {uncoveredCount} without tasks
          </span>
        )}
      </div>

      <div className='mt-4 flex flex-col gap-3'>
        {decisions.map((decision) => {
          return <DecisionRow key={decision.id} decision={decision} />;
        })}
      </div>
    </Card>
  );
}

function DecisionRow({ decision }: { decision: MeetingDecision }) {
  const authorName = decision.author?.name ?? decision.author_raw_name ?? null;

  return (
    <div
      data-decision-id={decision.id}
      data-uncovered={decision.is_uncovered}
      className={
        decision.is_uncovered
          ? 'rounded-[var(--radius-card)] border border-amber-500/40 bg-amber-50/40 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-900/10'
          : 'rounded-[var(--radius-card)] border border-border bg-background px-4 py-3'
      }
    >
      <div className='flex flex-col gap-2'>
        {decision.topic && (
          <span className='text-xs font-semibold uppercase tracking-wide text-primary/80'>
            {decision.topic}
          </span>
        )}

        <p className='text-sm leading-6 text-foreground'>{decision.text}</p>

        <DecisionMeta
          authorName={authorName}
          isUncovered={decision.is_uncovered}
        />

        {decision.linked_issues.length > 0 && (
          <LinkedIssuesList issues={decision.linked_issues} />
        )}
      </div>
    </div>
  );
}

function DecisionMeta({
  authorName,
  isUncovered,
}: {
  authorName: string | null;
  isUncovered: boolean;
}) {
  return (
    <div className='flex flex-wrap items-center gap-3'>
      {authorName && (
        <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
          <UserCircle className='h-3.5 w-3.5' />
          {authorName}
        </span>
      )}

      {isUncovered && (
        <span className='inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400'>
          <AlertTriangle className='h-3.5 w-3.5' />
          No task covers this decision
        </span>
      )}
    </div>
  );
}

function LinkedIssuesList({
  issues,
}: {
  issues: MeetingDecision['linked_issues'];
}) {
  return (
    <div className='mt-1 border-l-2 border-primary/30 pl-3'>
      <div className='mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground'>
        <LinkIcon className='h-3 w-3' />
        Linked tasks ({issues.length})
      </div>
      <ul className='flex flex-col gap-1'>
        {issues.map((issue) => {
          return (
            <li key={issue.id} className='flex items-center gap-2 text-sm'>
              <Link
                href={`${ROUTES.DASHBOARD.ISSUES}/${issue.id}`}
                className='truncate text-foreground hover:underline'
              >
                #{issue.id} {issue.name}
              </Link>
              <IssueStatusBadge status={issue.status as IssueStatus} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
