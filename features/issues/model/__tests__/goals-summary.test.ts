import {
  epicFilterCounts,
  filterEpics,
  isGoalsFilter,
  summarizeEpics,
} from '../goals-summary';

import type { Issue } from '../types';

const NOW = new Date('2026-06-15T12:00:00Z');

function epic(overrides: Partial<Issue>): Issue {
  return {
    id: 1,
    name: 'Epic',
    description: null,
    type: 'epic',
    status: 'open',
    organization_id: 1,
    team_id: null,
    epic_id: null,
    assignee_id: null,
    user_id: null,
    due_date: null,
    priority: 0,
    close_date: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

describe('isGoalsFilter', () => {
  it('accepts known filters and rejects others', () => {
    expect(isGoalsFilter('all')).toBe(true);
    expect(isGoalsFilter('mine')).toBe(true);
    expect(isGoalsFilter('overdue')).toBe(true);
    expect(isGoalsFilter('nope')).toBe(false);
    const undef: string | undefined = undefined;
    expect(isGoalsFilter(undef)).toBe(false);
    expect(isGoalsFilter(null)).toBe(false);
  });
});

describe('summarizeEpics', () => {
  it('buckets by status and counts overdue independently', () => {
    const epics: Issue[] = [
      epic({ id: 1, status: 'open' }),
      epic({ id: 2, status: 'in_progress' }),
      epic({ id: 3, status: 'reopen' }),
      epic({ id: 4, status: 'review' }),
      // overdue + open → counted in open AND overdue
      epic({ id: 5, status: 'open', due_date: '2026-06-01' }),
      // recently done, not overdue → in no status bucket
      epic({ id: 6, status: 'done', due_date: '2026-07-01' }),
    ];

    const s = summarizeEpics(epics, NOW);

    expect(s.total).toBe(6);
    expect(s.open).toBe(2); // ids 1, 5
    expect(s.inProgress).toBe(2); // ids 2, 3
    expect(s.review).toBe(1); // id 4
    expect(s.overdue).toBe(1); // id 5
  });

  it('ignores malformed due dates', () => {
    const s = summarizeEpics([epic({ due_date: 'not-a-date' })], NOW);
    expect(s.overdue).toBe(0);
  });

  it('does not count completed epics as overdue', () => {
    const s = summarizeEpics(
      [epic({ status: 'done', due_date: '2026-06-01' })],
      NOW,
    );
    expect(s.overdue).toBe(0);
  });
});

describe('filterEpics', () => {
  const epics: Issue[] = [
    epic({ id: 1, assignee_id: 99 }),
    epic({ id: 2, assignee_id: 7, due_date: '2026-06-01' }),
    epic({ id: 3, assignee_id: null, due_date: '2026-12-01' }),
  ];

  it('returns all for "all"', () => {
    expect(
      filterEpics(epics, { filter: 'all', currentUserId: 99 }, NOW),
    ).toHaveLength(3);
  });

  it('filters by current user for "mine"', () => {
    const mine = filterEpics(epics, { filter: 'mine', currentUserId: 7 }, NOW);
    expect(
      mine.map((e) => {
        return e.id;
      }),
    ).toEqual([2]);
  });

  it('returns nothing for "mine" when current user is null', () => {
    expect(
      filterEpics(epics, { filter: 'mine', currentUserId: null }, NOW),
    ).toHaveLength(0);
  });

  it('filters overdue', () => {
    const overdue = filterEpics(
      epics,
      { filter: 'overdue', currentUserId: 7 },
      NOW,
    );
    expect(
      overdue.map((e) => {
        return e.id;
      }),
    ).toEqual([2]);
  });

  it('excludes completed epics from overdue', () => {
    const list: Issue[] = [
      epic({ id: 10, status: 'open', due_date: '2026-06-01' }),
      epic({ id: 11, status: 'done', due_date: '2026-06-01' }),
    ];
    const overdue = filterEpics(
      list,
      { filter: 'overdue', currentUserId: null },
      NOW,
    );
    expect(
      overdue.map((e) => {
        return e.id;
      }),
    ).toEqual([10]);
  });
});

describe('epicFilterCounts', () => {
  it('counts all/mine/overdue', () => {
    const epics: Issue[] = [
      epic({ id: 1, assignee_id: 7 }),
      epic({ id: 2, assignee_id: 7, due_date: '2026-06-01' }),
      epic({ id: 3, assignee_id: 1, due_date: '2026-06-10' }),
    ];

    expect(epicFilterCounts(epics, 7, NOW)).toEqual({
      all: 3,
      mine: 2,
      overdue: 2,
    });
    expect(epicFilterCounts(epics, null, NOW)).toEqual({
      all: 3,
      mine: 0,
      overdue: 2,
    });
  });
});
