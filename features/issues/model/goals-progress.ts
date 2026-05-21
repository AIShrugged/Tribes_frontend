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

/**
 * computeProgress calculates task completion stats for an epic.
 * Filters out nested epics (depth guard) before counting.
 * @param tasks - child issues of the epic.
 * @returns GoalProgress snapshot.
 */
export function computeProgress(tasks: Issue[]): GoalProgress {
  const nonEpicTasks = tasks.filter((t) => {
    return t.type !== 'epic';
  });

  const counts: Partial<Record<IssueStatus, number>> = {};

  for (const task of nonEpicTasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  const total = nonEpicTasks.length;
  const done = counts.done ?? 0;
  const active = nonEpicTasks.filter((t) => {
    return ACTIVE_STATUSES.has(t.status);
  }).length;
  const open = counts.open ?? 0;

  return {
    total,
    done,
    active,
    open,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    isEmpty: total === 0,
    trend: 'flat',
  };
}

/**
 * getProgressColor returns a Tailwind background class for the RAG progress bar.
 * 0% / no tasks → gray; 1-33% → amber; 34-66% → violet; 67-99% → green; 100% → gradient.
 * @param progress - computed GoalProgress.
 * @returns Tailwind className string.
 */
export function getProgressColor(progress: GoalProgress): string {
  if (progress.isEmpty) return 'bg-[var(--muted-foreground)]/30';
  if (progress.percent === 0) return 'bg-[var(--muted-foreground)]/30';
  if (progress.percent <= 33) return 'bg-amber-500';
  if (progress.percent <= 66) return 'bg-[var(--primary)]';
  if (progress.percent < 100) return 'bg-emerald-500';

  return 'bg-gradient-to-r from-emerald-400 to-emerald-600';
}
