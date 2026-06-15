import { UserCircle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { IssueStatusBadge } from '@/entities/issue';
import { getIssues } from '@/features/issues/api/issues';
import {
  formatDeadline,
  formatShortDate,
  TONE_TEXT_CLASS,
} from '@/features/issues/model/goals-deadline';
import {
  computeProgress,
  getProgressColor,
} from '@/features/issues/model/goals-progress';
import { ROUTES } from '@/shared/lib/routes';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import { EpicCardCollapse } from './epic-card-collapse';
import { EpicGoalCardClient } from './epic-goal-card-client';

import type { GoalsTone } from '@/features/issues/model/goals-deadline';
import type { Issue } from '@/features/issues/model/types';

/**
 * resolveDeadline — deadline display for an epic. A completed epic is never
 * "overdue"; its deadline is shown as a plain date.
 * @param epic - the epic issue.
 * @returns overdue flag plus label/tone for the deadline meta.
 */
function resolveDeadline(epic: Issue): {
  isOverdue: boolean;
  label: string;
  tone: GoalsTone;
} {
  const deadline = formatDeadline(epic.due_date);
  const isDone = epic.status === 'done';

  return {
    isOverdue: !isDone && deadline.tone === 'danger',
    label: isDone ? formatShortDate(epic.due_date) : deadline.label,
    tone: isDone ? 'none' : deadline.tone,
  };
}

async function EpicTasksList({ epicId }: { epicId: number }) {
  const result = await getIssues({ epic_id: epicId, limit: 100, offset: 0 });
  const tasks = result.data.filter((t) => {
    return t.type !== 'epic';
  });
  const progress = computeProgress(tasks);
  const barColor = getProgressColor(progress);

  return (
    <EpicGoalCardClient tasks={tasks} progress={progress} barColor={barColor} />
  );
}

function EpicTasksListSkeleton() {
  return (
    <div className='px-4 pb-4 space-y-2'>
      <div className='flex items-center justify-between mb-2'>
        <Skeleton className='h-3 w-32' />
        <Skeleton className='h-4 w-16' />
      </div>
      <Skeleton className='h-1.5 w-full' />
      <div className='mt-3 space-y-2'>
        {[1, 2, 3].map((i) => {
          return <Skeleton key={i} className='h-8 w-full' />;
        })}
      </div>
    </div>
  );
}

/**
 * EpicGoalCard — async Server Component. Renders one epic as a goal card: a
 * static header (title, code, status, owner, deadline) and a streamed body
 * (progress + task list) wrapped in a client collapse toggle.
 * @param props - Component props.
 * @param props.epic - the epic issue.
 * @returns JSX element.
 */
export async function EpicGoalCard({ epic }: { epic: Issue }) {
  const epicDetailHref = `${ROUTES.DASHBOARD.ISSUES}/${epic.id.toString()}`;
  const kanbanHref = `${ROUTES.DASHBOARD.ISSUES_KANBAN}?epic_id=${epic.id.toString()}`;
  const {
    isOverdue,
    label: deadlineLabel,
    tone: deadlineTone,
  } = resolveDeadline(epic);

  const header = (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        <span
          aria-hidden='true'
          className='flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary-soft-text)]'
        >
          G
        </span>
        <Link
          href={epicDetailHref}
          className='text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline transition-colors line-clamp-2'
        >
          {epic.name}
        </Link>
        <span className='font-mono text-[11px] text-[var(--muted-foreground)]'>
          EPIC-{epic.id.toString()}
        </span>
        <IssueStatusBadge status={epic.status} isOverdue={isOverdue} />
      </div>

      {epic.description && (
        <p className='mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2'>
          {epic.description}
        </p>
      )}

      <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]'>
        {epic.assignee?.name != null && epic.assignee.name !== '' && (
          <span className='inline-flex items-center gap-1 text-[var(--muted-foreground)]'>
            <UserCircle className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
            {epic.assignee.name}
          </span>
        )}
        {deadlineLabel !== '' && (
          <span className='inline-flex items-center gap-1'>
            <span className='text-[var(--muted-foreground)]'>Deadline</span>
            <span className={TONE_TEXT_CLASS[deadlineTone]}>
              {deadlineLabel}
            </span>
          </span>
        )}
        <Link
          href={kanbanHref}
          className='ml-auto rounded px-2 py-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors'
        >
          Kanban
        </Link>
      </div>
    </>
  );

  return (
    <div className='group/epic overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]'>
      <EpicCardCollapse header={header}>
        <Suspense fallback={<EpicTasksListSkeleton />}>
          <EpicTasksList epicId={epic.id} />
        </Suspense>
      </EpicCardCollapse>
    </div>
  );
}

export function EpicGoalCardSkeleton() {
  return (
    <div className='overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]'>
      <div className='flex items-start gap-2 px-4 py-3'>
        <Skeleton className='h-5 w-5 shrink-0 rounded' />
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-3 w-1/2' />
        </div>
      </div>
      <EpicTasksListSkeleton />
    </div>
  );
}
