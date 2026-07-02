import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import Link from 'next/link';

import { getPriorityLevel, issueCodeLabel } from '@/entities/issue';
import {
  formatTaskDue,
  TONE_TEXT_CLASS,
} from '@/features/issues/model/goals-deadline';
import { ROUTES } from '@/shared/lib/routes';
import Avatar from '@/shared/ui/common/avatar';

import type { GoalsTone } from '@/features/issues/model/goals-deadline';
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
  const id = issueCodeLabel(task.code, task.id);

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
 * Columns are fixed-width (priority / due / avatar) so they line up across rows.
 * Priority renders for EVERY task (all 5 levels, including Normal and done) with
 * a color-coded dot and a muted label.
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
  const due: { label: string; tone: GoalsTone } = isDone
    ? { label: 'Closed', tone: 'none' }
    : formatTaskDue(task.due_date);
  const priority = getPriorityLevel(task.priority);

  return (
    <div className='group/taskrow grid grid-cols-[18px_minmax(0,1fr)_80px_72px_24px_auto] items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] transition-colors hover:bg-[var(--surface-2)]'>
      <span
        aria-hidden='true'
        className={clsx(
          'flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border-[1.5px]',
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-[var(--background)]'
            : 'border-[var(--muted-foreground)]/50',
        )}
      >
        {isDone && <Check className='h-[11px] w-[11px]' />}
      </span>

      <div className='min-w-0'>
        <Link
          href={href}
          className={clsx(
            'block truncate text-[13.5px] hover:underline',
            isDone
              ? 'text-[var(--muted-foreground)] line-through'
              : 'text-[var(--foreground)]',
          )}
        >
          {task.name}
        </Link>
        <div className='mt-px truncate text-[11.5px] text-[var(--muted-foreground)]'>
          {taskMeta(task)}
        </div>
      </div>

      <span
        className='flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted-foreground)]'
        title={`Priority: ${priority.label}`}
      >
        <span
          aria-hidden='true'
          className={clsx(
            'h-[7px] w-[7px] shrink-0 rounded-full bg-current',
            priority.color,
          )}
        />
        <span className='truncate'>{priority.label}</span>
      </span>

      <span
        className={clsx(
          'whitespace-nowrap text-xs',
          TONE_TEXT_CLASS[due.tone],
          (due.tone === 'danger' || due.tone === 'warn') && 'font-medium',
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
