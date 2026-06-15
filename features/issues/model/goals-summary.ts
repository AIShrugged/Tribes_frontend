import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { Issue } from './types';

export interface GoalsSummary {
  total: number;
  open: number;
  inProgress: number;
  review: number;
  overdue: number;
}

export type GoalsFilter = 'all' | 'mine' | 'overdue';

const GOALS_FILTERS: GoalsFilter[] = ['all', 'mine', 'overdue'];

/**
 * isGoalsFilter — type guard for the ?filter search param.
 * @param value - raw value.
 * @returns whether value is a GoalsFilter.
 */
export function isGoalsFilter(
  value: string | undefined | null,
): value is GoalsFilter {
  return value != null && (GOALS_FILTERS as string[]).includes(value);
}

/**
 * isEpicOverdue — true when the epic has a past due_date.
 * @param epic - epic issue.
 * @param now - reference date.
 * @returns whether the epic is overdue.
 */
function isEpicOverdue(epic: Issue, now: Date): boolean {
  // A completed epic is never "overdue", even if finished past its deadline.
  if (epic.status === 'done') return false;
  if (!epic.due_date) return false;
  const due = parseISO(epic.due_date);
  if (Number.isNaN(due.getTime())) return false;

  return differenceInCalendarDays(due, now) < 0;
}

/**
 * isMine — true when the epic is assigned to the current user.
 * @param epic - epic issue.
 * @param currentUserId - current user id (assignee_id namespace).
 * @returns whether the epic belongs to the current user.
 */
function isMine(epic: Issue, currentUserId: number | null): boolean {
  return currentUserId != null && epic.assignee_id === currentUserId;
}

/**
 * summarizeEpics — counts for the summary strip, over the epics array (goals),
 * NOT /issues/stats. open=status 'open'; inProgress=in_progress|reopen;
 * review=status 'review'; overdue=due_date<today (any status).
 * NOTE: total != open+inProgress+review+overdue (a recently-done, non-overdue
 * epic is in no bucket) and the count is capped by getEpics' limit:100.
 * @param epics - epics list.
 * @param now - reference date.
 * @returns summary counts.
 */
export function summarizeEpics(
  epics: Issue[],
  now: Date = new Date(),
): GoalsSummary {
  let open = 0;
  let inProgress = 0;
  let review = 0;
  let overdue = 0;

  for (const epic of epics) {
    // Independent (mutually exclusive) checks — avoids an else-if chain.
    if (epic.status === 'open') open++;
    if (epic.status === 'in_progress' || epic.status === 'reopen') inProgress++;
    if (epic.status === 'review') review++;
    if (isEpicOverdue(epic, now)) overdue++;
  }

  return { total: epics.length, open, inProgress, review, overdue };
}

/**
 * filterEpics — applies the chip filter (All/Mine/Overdue). Text search (q) is
 * applied client-side, not here.
 * @param epics - epics list.
 * @param opts - filter + current user id.
 * @param opts.filter - active chip filter.
 * @param opts.currentUserId - current user id for "Mine".
 * @param now - reference date.
 * @returns filtered epics.
 */
export function filterEpics(
  epics: Issue[],
  opts: { filter: GoalsFilter; currentUserId: number | null },
  now: Date = new Date(),
): Issue[] {
  const { filter, currentUserId } = opts;

  if (filter === 'mine') {
    return epics.filter((epic) => {
      return isMine(epic, currentUserId);
    });
  }
  if (filter === 'overdue') {
    return epics.filter((epic) => {
      return isEpicOverdue(epic, now);
    });
  }

  return epics;
}

/**
 * epicFilterCounts — counts for each chip, computed over ALL epics.
 * @param epics - epics list.
 * @param currentUserId - current user id for "Mine".
 * @param now - reference date.
 * @returns counts keyed by filter.
 */
export function epicFilterCounts(
  epics: Issue[],
  currentUserId: number | null,
  now: Date = new Date(),
): Record<GoalsFilter, number> {
  let mine = 0;
  let overdue = 0;

  for (const epic of epics) {
    if (isMine(epic, currentUserId)) mine++;
    if (isEpicOverdue(epic, now)) overdue++;
  }

  return { all: epics.length, mine, overdue };
}
