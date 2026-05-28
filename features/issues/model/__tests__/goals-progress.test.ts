import {
  computeProgress,
  getProgressColor,
} from '@/features/issues/model/goals-progress';

import type { GoalProgress } from '@/features/issues/model/goals-progress';
import type { Issue } from '@/features/issues/model/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeIssue(overrides: Partial<Issue>): Issue {
  return {
    id: 1,
    name: 'Task',
    description: null,
    type: 'development',
    status: 'open',
    organization_id: 1,
    team_id: null,
    epic_id: null,
    assignee_id: null,
    user_id: null,
    priority: 0,
    due_date: null,
    close_date: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProgress(overrides: Partial<GoalProgress>): GoalProgress {
  return {
    total: 0,
    done: 0,
    active: 0,
    open: 0,
    percent: 0,
    isEmpty: true,
    trend: 'flat',
    ...overrides,
  };
}

// Fixed reference date for deterministic trend tests
const NOW = new Date('2026-05-28T12:00:00Z');

// Helpers to build close_date strings relative to NOW
const daysAgo = (n: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

// ─── computeProgress — basic counting ───────────────────────────────────────

describe('computeProgress — counting', () => {
  it('empty array → isEmpty true, all zeros', () => {
    const result = computeProgress([]);
    expect(result.isEmpty).toBe(true);
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
    expect(result.active).toBe(0);
    expect(result.open).toBe(0);
    expect(result.percent).toBe(0);
  });

  it('all done → percent 100', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(2) }),
    ];
    const result = computeProgress(tasks);
    expect(result.done).toBe(2);
    expect(result.total).toBe(2);
    expect(result.percent).toBe(100);
  });

  it('all open → percent 0', () => {
    const tasks = [makeIssue({ id: 1 }), makeIssue({ id: 2 })];
    const result = computeProgress(tasks);
    expect(result.percent).toBe(0);
    expect(result.open).toBe(2);
  });

  it('mixed statuses → correct counts', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2, status: 'in_progress' }),
      makeIssue({ id: 3, status: 'open' }),
    ];
    const result = computeProgress(tasks);
    expect(result.total).toBe(3);
    expect(result.done).toBe(1);
    expect(result.active).toBe(1);
    expect(result.open).toBe(1);
  });

  it('rounding — 1 of 3 done → percent 33', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2 }),
      makeIssue({ id: 3 }),
    ];
    expect(computeProgress(tasks).percent).toBe(33);
  });

  it('all 4 active statuses count toward active', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'in_progress' }),
      makeIssue({ id: 2, status: 'paused' }),
      makeIssue({ id: 3, status: 'review' }),
      makeIssue({ id: 4, status: 'reopen' }),
    ];
    expect(computeProgress(tasks).active).toBe(4);
  });

  it('epic children are filtered out before counting', () => {
    const tasks = [
      makeIssue({ id: 1, type: 'epic' }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(1) }),
    ];
    const result = computeProgress(tasks);
    expect(result.total).toBe(1);
    expect(result.done).toBe(1);
  });

  it('mixed epics + tasks — correct total', () => {
    const tasks = [
      makeIssue({ id: 1, type: 'epic' }),
      makeIssue({ id: 2, type: 'epic' }),
      makeIssue({ id: 3, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 4, status: 'done', close_date: daysAgo(2) }),
      makeIssue({ id: 5 }),
    ];
    const result = computeProgress(tasks);
    expect(result.total).toBe(3);
    expect(result.done).toBe(2);
    expect(result.percent).toBe(67);
  });

  it('array of only epics → isEmpty true', () => {
    const tasks = [makeIssue({ id: 1, type: 'epic' })];
    expect(computeProgress(tasks).isEmpty).toBe(true);
  });
});

// ─── computeProgress — trend ─────────────────────────────────────────────────

describe('computeProgress — trend', () => {
  it('trend up: more closed in last 7 days than prior 7', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(3) }),
      makeIssue({ id: 3, status: 'done', close_date: daysAgo(5) }),
      makeIssue({ id: 4, status: 'done', close_date: daysAgo(10) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('up');
  });

  it('trend down: fewer closed recently than prior week (1 recent, 3 prior)', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(2) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(8) }),
      makeIssue({ id: 3, status: 'done', close_date: daysAgo(9) }),
      makeIssue({ id: 4, status: 'done', close_date: daysAgo(10) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('down');
  });

  it('trend down: none closed recently but some closed prior (0 recent, 2 prior)', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(8) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(10) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('down');
  });

  it('trend flat: equal counts in both windows', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(2) }),
      makeIssue({ id: 3, status: 'done', close_date: daysAgo(8) }),
      makeIssue({ id: 4, status: 'done', close_date: daysAgo(9) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('flat');
  });

  it('trend flat: no closed issues at all', () => {
    const tasks = [makeIssue({ id: 1 }), makeIssue({ id: 2 })];
    expect(computeProgress(tasks, NOW).trend).toBe('flat');
  });

  it('trend flat: tasks closed but outside both windows (> 14 days ago)', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(20) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(30) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('flat');
  });

  it('malformed close_date does not crash — counts as 0 in both windows', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: 'not-a-date' }),
      makeIssue({ id: 2, status: 'done', close_date: '' }),
    ];
    expect(() => {
      return computeProgress(tasks, NOW);
    }).not.toThrow();
    expect(computeProgress(tasks, NOW).trend).toBe('flat');
  });

  it('close_date exactly on 7-day boundary counts as recent', () => {
    // startOfDay(subDays(now, 7)) — a task closed at exactly that ms boundary is >= sevenDaysAgoMs
    const { startOfDay, subDays } = jest.requireActual(
      'date-fns',
    ) as typeof import('date-fns');
    const boundary = startOfDay(subDays(NOW, 7));
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: boundary.toISOString() }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('up'); // 1 recent, 0 prior → up
  });

  it('total === 0 (all epics filtered) → trend flat', () => {
    const tasks = [makeIssue({ id: 1, type: 'epic' })];
    expect(computeProgress(tasks, NOW).trend).toBe('flat');
  });

  it('newly active epic: 2 recent, 0 prior → up (accepted v1 behaviour)', () => {
    const tasks = [
      makeIssue({ id: 1, status: 'done', close_date: daysAgo(1) }),
      makeIssue({ id: 2, status: 'done', close_date: daysAgo(3) }),
    ];
    expect(computeProgress(tasks, NOW).trend).toBe('up');
  });
});

// ─── getProgressColor — all 9 branches ──────────────────────────────────────

describe('getProgressColor', () => {
  it('isEmpty true → muted class', () => {
    expect(getProgressColor(makeProgress({ isEmpty: true, percent: 0 }))).toBe(
      'bg-[var(--muted-foreground)]/30',
    );
  });

  it('percent 0 non-empty → muted class', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 0, total: 3 })),
    ).toBe('bg-[var(--muted-foreground)]/30');
  });

  it('percent 1 → amber', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 1, total: 1 })),
    ).toBe('bg-amber-500');
  });

  it('percent 33 → amber (boundary)', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 33, total: 3 })),
    ).toBe('bg-amber-500');
  });

  it('percent 34 → violet primary (boundary)', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 34, total: 3 })),
    ).toBe('bg-[var(--primary)]');
  });

  it('percent 66 → violet primary', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 66, total: 3 })),
    ).toBe('bg-[var(--primary)]');
  });

  it('percent 67 → emerald (boundary)', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 67, total: 3 })),
    ).toBe('bg-emerald-500');
  });

  it('percent 99 → emerald', () => {
    expect(
      getProgressColor(makeProgress({ isEmpty: false, percent: 99, total: 3 })),
    ).toBe('bg-emerald-500');
  });

  it('percent 100 → gradient', () => {
    expect(
      getProgressColor(
        makeProgress({ isEmpty: false, percent: 100, total: 2, done: 2 }),
      ),
    ).toBe('bg-gradient-to-r from-emerald-400 to-emerald-600');
  });
});
