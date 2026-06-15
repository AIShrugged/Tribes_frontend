import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import Link from 'next/link';

import { getPriorityLevel } from '@/entities/issue';
import {
  formatTaskDue,
  TONE_TEXT_CLASS,
} from '@/features/issues/model/goals-deadline';
import { ROUTES } from '@/shared/lib/routes';
import Avatar from '@/shared/ui/common/avatar';

import type { Issue, IssueStatus } from '@/features/issues/model/types';
import type { ReactNode } from 'react';

const STATUS_META: Record<IssueStatus, string> = {
  open: 'todo',
  in_progress: 'in progress',
  paused: 'paused',
  review: 'in review',
  reopen: 'reopened',
  done: 'done',
};

/**
 * initials — first letters of the first and last name parts.
 * @param name - person name or null.
 * @returns up to two uppercase initials, or "?".
 */
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';

  return (first + last).toUpperCase() || '?';
}

/**
 * taskMeta — secondary line for a task row: "#12 · closed Jun 4" / "#12 · in progress".
 * @param task - the task issue.
 * @returns meta string.
 */
function taskMeta(task: Issue): string {
  const id = `#${task.id.toString()}`;

  if (task.status === 'done' && task.close_date) {
    const closed = parseISO(task.close_date);
    if (!Number.isNaN(closed.getTime())) {
      return `${id} · closed ${format(closed, 'MMM d')}`;
    }
  }

  return `${id} · ${STATUS_META[task.status]}`;
}

/**
 * GoalTaskRow — presentational task row shared by linked (epic card) and
 * unlinked sections. Interactivity is injected via the `trailing` slot, so this
 * component stays server- and client-safe.
 *
 * Columns are fixed-width (priority / due / avatar) so they line up across rows
 * even though each row is its own grid. Priority renders for EVERY task (all 5
 * levels, including Normal and done) so the column is never blank.
 * @param props - Component props.
 * @param props.task - the task issue.
 * @param props.trailing - trailing action (Unlink / Link to goal).
 * @returns JSX element.
 */
export function GoalTaskRow({
  task,
  trailing,
}: {
  task: Issue;
  trailing?: ReactNode;
}) {
  const href = `${ROUTES.DASHBOARD.ISSUES}/${task.id.toString()}`;
  const isDone = task.status === 'done';
  const due = formatTaskDue(task.due_date);
  const priority = getPriorityLevel(task.priority);

  return (
    <div className='group/taskrow grid grid-cols-[16px_minmax(0,1fr)_84px_60px_24px_auto] items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-[var(--surface-2)]'>
      <span
        aria-hidden='true'
        className={clsx(
          'flex h-4 w-4 items-center justify-center rounded border',
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-[var(--background)]'
            : 'border-[var(--muted-foreground)]/50',
        )}
      >
        {isDone && <Check className='h-3 w-3' />}
      </span>

      <div className='min-w-0'>
        <Link
          href={href}
          className={clsx(
            'block truncate text-xs hover:underline',
            isDone
              ? 'text-[var(--muted-foreground)] line-through'
              : 'text-[var(--foreground)]',
          )}
        >
          {task.name}
        </Link>
        <div className='truncate text-[10px] text-[var(--muted-foreground)]'>
          {taskMeta(task)}
        </div>
      </div>

      <span
        className={clsx(
          'flex min-w-0 items-center gap-1 text-[11px]',
          priority.color,
        )}
        title={`Priority: ${priority.label}`}
      >
        <span
          aria-hidden='true'
          className='h-1.5 w-1.5 shrink-0 rounded-full bg-current'
        />
        <span className='truncate'>{priority.label}</span>
      </span>

      <span
        className={clsx(
          'whitespace-nowrap text-right text-[11px]',
          TONE_TEXT_CLASS[due.tone],
        )}
      >
        {due.label}
      </span>

      <div className='flex justify-center'>
        {task.assignee ? (
          <Avatar size='xs'>{initials(task.assignee.name)}</Avatar>
        ) : (
          <span
            aria-hidden='true'
            className='flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] text-[var(--muted-foreground)]'
          >
            ?
          </span>
        )}
      </div>

      <div className='flex items-center justify-end'>{trailing}</div>
    </div>
  );
}
