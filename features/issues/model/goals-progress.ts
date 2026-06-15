import { parseISO, startOfDay, subDays } from 'date-fns';

import type { Issue, IssueStatus } from './types';

export interface GoalProgress {
  total: number;
  done: number;
  active: number;
  open: number;
  percent: number;
  isEmpty: boolean;
  trend: 'up' | 'flat' | 'down';
}

const ACTIVE_STATUSES = new Set<IssueStatus>([
  'in_progress',
  'paused',
  'review',
  'reopen',
]);

export function computeProgress(
  tasks: Issue[],
  now: Date = new Date(),
): GoalProgress {
  const nonEpicTasks = tasks.filter((t) => {
    return t.type !== 'epic';
  });

  // Pre-compute cutoff ms once — avoids repeated Date construction inside loop
  const sevenDaysAgoMs = startOfDay(subDays(now, 7)).getTime();
  const fourteenDaysAgoMs = startOfDay(subDays(now, 14)).getTime();

  const counts: Partial<Record<IssueStatus, number>> = {};
  let doneRecent = 0; // tasks closed in last 7 days
  let donePrior = 0; // tasks closed 7–14 days ago
  let active = 0;

  for (const task of nonEpicTasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;

    if (ACTIVE_STATUSES.has(task.status)) {
      active++;
    }

    if (task.status === 'done' && task.close_date !== null) {
      const parsed = parseISO(task.close_date);
      // Guard against malformed close_date strings from the backend
      if (!Number.isNaN(parsed.getTime())) {
        const closedMs = parsed.getTime();
        if (closedMs >= sevenDaysAgoMs) {
          doneRecent++;
        } else if (closedMs >= fourteenDaysAgoMs) {
          donePrior++;
        }
      }
    }
  }

  const total = nonEpicTasks.length;
  const done = counts.done ?? 0;
  const open = counts.open ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isEmpty = total === 0;

  // Trend: compare velocity of last 7 days vs prior 7 days.
  // isEmpty → flat (no data). Tasks reopened after done may inflate prior counts — accepted v1 limitation.
  let trend: GoalProgress['trend'] = 'flat';
  if (!isEmpty) {
    if (doneRecent > donePrior) {
      trend = 'up';
    } else if (doneRecent < donePrior) {
      trend = 'down';
    }
  }

  return { total, done, active, open, percent, isEmpty, trend };
}

/**
 * getProgressColor returns a Tailwind background class for the RAG progress bar.
 * 0% / no tasks → gray; 1-33% → amber; 34-66% → violet; 67-99% → green; 100% → gradient.
 */
export function getProgressColor(progress: GoalProgress): string {
  if (progress.isEmpty) return 'bg-[var(--muted-foreground)]/30';
  if (progress.percent === 0) return 'bg-[var(--muted-foreground)]/30';
  if (progress.percent <= 33) return 'bg-amber-500';
  if (progress.percent <= 66) return 'bg-[var(--primary)]';
  if (progress.percent < 100) return 'bg-emerald-500';

  return 'bg-gradient-to-r from-emerald-400 to-emerald-600';
}

/**
 * getProgressTextColor returns a Tailwind text-color class matching
 * getProgressColor, for tinting the stat number in the card header.
 * @param progress - computed goal progress.
 * @returns text-color class.
 */
export function getProgressTextColor(progress: GoalProgress): string {
  if (progress.isEmpty || progress.percent === 0) {
    return 'text-[var(--muted-foreground)]';
  }
  if (progress.percent <= 33) return 'text-amber-500';
  if (progress.percent <= 66) return 'text-[var(--primary)]';

  return 'text-emerald-500';
}

/**
 * formatTaskBreakdown returns the by-bucket task breakdown (done / active /
 * open) for the linked-tasks header, e.g. "12 done, 4 active, 2 open". The
 * middle bucket is "active" (not "in progress") because GoalProgress.active
 * lumps in_progress + paused + review + reopen. The caller prefixes the total,
 * e.g. `Tasks · ${total} (${formatTaskBreakdown(progress)})`.
 * @param progress - computed goal progress.
 * @returns breakdown string.
 */
export function formatTaskBreakdown(progress: GoalProgress): string {
  if (progress.isEmpty) return 'No tasks yet';

  const parts: string[] = [`${progress.done.toString()} done`];

  if (progress.active > 0) parts.push(`${progress.active.toString()} active`);
  if (progress.open > 0) parts.push(`${progress.open.toString()} open`);

  return parts.join(', ');
}
