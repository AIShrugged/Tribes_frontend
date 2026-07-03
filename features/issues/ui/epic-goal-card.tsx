import Link from 'next/link';

import {
  IssueCodeBadge,
  IssueStatusBadge,
  issueHrefSegment,
} from '@/entities/issue';
import { getIssues } from '@/features/issues/api/issues';
import {
  formatDeadline,
  formatShortDate,
  TONE_TEXT_CLASS,
} from '@/features/issues/model/goals-deadline';
import {
  computeProgress,
  getProgressColor,
  getProgressTextColor,
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

/**
 * EpicGoalCard — async Server Component. Awaits the epic's tasks once, then
 * renders a 2-column header (content + always-visible stat rail with a fixed
 * 220px progress bar) and a collapsible task list. The whole card streams in via
 * the parent Suspense boundary.
 * @param props - Component props.
 * @param props.epic - the epic issue.
 * @returns JSX element.
 */
export async function EpicGoalCard({ epic }: { epic: Issue }) {
  const result = await getIssues({ epic_id: epic.id, limit: 100, offset: 0 });
  const tasks = result.data.filter((t) => {
    return t.type !== 'epic';
  });
  const progress = computeProgress(tasks);
  const barColor = getProgressColor(progress);
  const numColor = getProgressTextColor(progress);

  const epicDetailHref = `${ROUTES.DASHBOARD.ISSUES}/${issueHrefSegment(epic)}`;
  const kanbanHref = `${ROUTES.DASHBOARD.ISSUES_KANBAN}?epic_id=${epic.id.toString()}`;
  const {
    isOverdue,
    label: deadlineLabel,
    tone: deadlineTone,
  } = resolveDeadline(epic);

  const header = (
    <>
      <div className='flex flex-wrap items-center gap-2.5'>
        <span
          aria-hidden='true'
          className='flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary-soft-text)]'
        >
          G
        </span>
        <Link
          href={epicDetailHref}
          className='text-[15.5px] font-semibold tracking-[-0.005em] text-[var(--foreground)] transition-colors line-clamp-2 hover:text-[var(--primary)] hover:underline'
        >
          {epic.name}
        </Link>
        <IssueCodeBadge code={epic.code} id={epic.id} />
        <IssueStatusBadge status={epic.status} isOverdue={isOverdue} />
      </div>

      {epic.description && (
        <p className='mt-1.5 max-w-[720px] text-[13px] text-[var(--muted-foreground)] line-clamp-2'>
          {epic.description}
        </p>
      )}

      <div className='mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-1 text-[12.5px]'>
        {epic.assignee?.name != null && epic.assignee.name !== '' && (
          <span className='inline-flex items-center gap-1.5'>
            <span className='text-[var(--muted-foreground)]'>Owner</span>
            <span className='text-[var(--foreground)]'>
              {epic.assignee.name}
            </span>
          </span>
        )}
        {deadlineLabel !== '' && (
          <span className='inline-flex items-center gap-1.5'>
            <span className='text-[var(--muted-foreground)]'>Deadline</span>
            <span className={TONE_TEXT_CLASS[deadlineTone]}>
              {deadlineLabel}
            </span>
          </span>
        )}
        <Link
          href={kanbanHref}
          className='ml-auto rounded px-2 py-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
        >
          Kanban
        </Link>
      </div>
    </>
  );

  const right = (
    <>
      <div className='text-right'>
        <div
          className={`text-2xl font-semibold tracking-[-0.02em] ${numColor}`}
        >
          {progress.isEmpty ? (
            '—'
          ) : (
            <>
              {progress.done.toString()}
              <span className='text-sm font-normal text-[var(--muted-foreground)]'>
                {' '}
                / {progress.total.toString()}
              </span>
            </>
          )}
        </div>
        <div className='mt-0.5 text-[11.5px] text-[var(--muted-foreground)]'>
          {progress.isEmpty
            ? 'No tasks yet'
            : `tasks closed · ${progress.percent.toString()}%`}
        </div>
      </div>
      {!progress.isEmpty && (
        <div
          className='h-1.5 w-[220px] overflow-hidden rounded-full bg-[var(--surface-3)]'
          role='progressbar'
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
            style={{ width: `${progress.percent.toString()}%` }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className='group/epic overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]'>
      <EpicCardCollapse
        header={header}
        right={right}
        hasBody={tasks.length > 0}
      >
        <EpicGoalCardClient tasks={tasks} progress={progress} />
      </EpicCardCollapse>
    </div>
  );
}

export function EpicGoalCardSkeleton() {
  return (
    <div className='overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)]'>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-[18px]'>
        <div className='flex items-start gap-2.5'>
          <Skeleton className='mt-0.5 h-[18px] w-[18px] shrink-0 rounded' />
          <div className='min-w-0 flex-1 space-y-2'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
        <div className='flex flex-col items-end gap-2.5'>
          <Skeleton className='h-7 w-20' />
          <Skeleton className='h-1.5 w-[220px]' />
        </div>
      </div>
    </div>
  );
}
