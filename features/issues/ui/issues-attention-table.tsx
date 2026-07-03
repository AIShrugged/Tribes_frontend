'use client';

import { Bug } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { issueCodeLabel, issueHrefSegment } from '@/entities/issue';
import { loadIssuesChunk } from '@/features/issues/api/issues';
import { useIssueDetailHref } from '@/features/issues/hooks/use-issue-detail-href';
import { getPriorityLevel } from '@/features/issues/model/types';
import { useInfiniteScroll } from '@/shared/hooks';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { InfiniteScrollStatus } from '@/shared/ui/layout/infinite-scroll-status';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { Issue, IssueStatus } from '@/features/issues/model/types';

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

const PRIORITY_MAP: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400',
  High: 'bg-orange-500/10 text-orange-400',
  Normal: 'bg-secondary text-muted-foreground',
  Low: 'bg-blue-500/10 text-blue-400',
  Minimal: 'bg-secondary/60 text-muted-foreground/60',
};

function getPriorityBadge(
  priority: number,
): { label: string; cls: string } | null {
  const level = getPriorityLevel(priority);
  const cls = PRIORITY_MAP[level.label] ?? PRIORITY_MAP['Normal'];
  return { label: level.label, cls };
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open: { label: 'To do', cls: 'bg-secondary text-muted-foreground' },
  in_progress: { label: 'In progress', cls: 'bg-blue-500/10 text-blue-400' },
  paused: { label: 'Paused', cls: 'bg-yellow-500/10 text-yellow-400' },
  review: { label: 'Review', cls: 'bg-violet-500/10 text-violet-400' },
  reopen: { label: 'Reopened', cls: 'bg-orange-500/10 text-orange-400' },
  done: { label: 'Done', cls: 'bg-green-500/10 text-green-400' },
};

function getStatusBadge(status: string): { label: string; cls: string } {
  return (
    STATUS_MAP[status] ?? {
      label: status,
      cls: 'bg-secondary text-muted-foreground',
    }
  );
}

// ---------------------------------------------------------------------------
// Due date
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['done', 'closed', 'cancelled']);

function formatDueDate(
  dueDate: string | null,
  status: string,
): { label: string; cls: string } {
  if (!dueDate) return { label: '—', cls: 'text-muted-foreground/40' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const dateLabel = due.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });

  if (diffDays < 0) {
    if (TERMINAL_STATUSES.has(status)) {
      return { label: dateLabel, cls: 'text-muted-foreground/50' };
    }
    return {
      label: `Overdue · ${Math.abs(diffDays)} d.`,
      cls: 'text-red-400',
    };
  }
  if (diffDays === 0) return { label: 'Today', cls: 'text-amber-400' };
  if (diffDays === 1) return { label: 'Tomorrow', cls: 'text-amber-400' };

  return { label: dateLabel, cls: 'text-muted-foreground' };
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-teal-600',
  'bg-green-600',
  'bg-orange-600',
  'bg-pink-600',
  'bg-indigo-600',
  'bg-rose-600',
] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + (name.codePointAt(i) ?? 0)) & 2_147_483_647;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

function IssueAttentionRow({ issue, href }: { issue: Issue; href: string }) {
  const priority = getPriorityBadge(issue.priority);
  const due = formatDueDate(issue.due_date, issue.status);
  const status = getStatusBadge(issue.status);
  const assigneeName = issue.assignee?.name ?? null;

  return (
    <tr className='border-t border-border hover:bg-white/[0.018] transition-colors'>
      <td className='px-4 py-3 align-middle'>
        <Link href={href} className='group block'>
          <span className='block font-medium text-foreground group-hover:text-primary transition-colors leading-snug'>
            {issue.name}
          </span>
          <span className='mt-0.5 block text-xs text-muted-foreground/50'>
            {issueCodeLabel(issue.code, issue.id)}
            {issue.epic?.name ? ` · ${issue.epic.name}` : ''}
          </span>
        </Link>
      </td>
      <td className='px-4 py-3 align-middle'>
        {priority ? (
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${priority.cls}`}
          >
            {priority.label}
          </span>
        ) : (
          <span className='text-xs text-muted-foreground/30'>—</span>
        )}
      </td>
      <td className='px-4 py-3 align-middle'>
        <span className={`text-sm whitespace-nowrap ${due.cls}`}>
          {due.label}
        </span>
      </td>
      <td className='px-4 py-3 align-middle'>
        {assigneeName ? (
          <div className='flex items-center gap-2.5'>
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${getAvatarColor(assigneeName)}`}
            >
              {getInitials(assigneeName)}
            </span>
            <span className='max-w-[120px] truncate text-sm text-foreground'>
              {assigneeName}
            </span>
          </div>
        ) : (
          <span className='text-sm text-muted-foreground/40'>Unassigned</span>
        )}
      </td>
      <td className='px-4 py-3 align-middle'>
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${status.cls}`}
        >
          {status.label}
        </span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------

const COLUMNS = ['TASK', 'PRIORITY', 'DUE DATE', 'ASSIGNEE', 'STATUS'] as const;

function AttentionTableHead() {
  return (
    <thead>
      <tr className='border-b border-border'>
        {COLUMNS.map((col) => {
          return (
            <th
              key={col}
              className='px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50'
            >
              {col}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// ---------------------------------------------------------------------------
// Quick filter chips
// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

type FilterId = 'all' | 'mine' | 'overdue' | 'this_week' | 'blocked';

interface AttentionChipsProps {
  activeFilter: FilterId;
  totalCount: number;
  overdue: number;
  onFilter: (id: FilterId) => void;
}

function chipClass(isActive: boolean): string {
  if (isActive) return 'border border-border bg-secondary text-foreground';
  return 'border border-transparent text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/50';
}

function overdueChipClass(isActive: boolean): string {
  if (isActive) return 'border border-red-500/40 bg-red-500/10 text-red-400';
  return 'border border-transparent text-muted-foreground hover:border-red-500/30 hover:text-red-400';
}

function AttentionChips({
  activeFilter,
  totalCount,
  overdue,
  onFilter,
}: AttentionChipsProps) {
  return (
    <div className='flex items-center gap-2 flex-wrap'>
      <button
        type='button'
        onClick={() => {
          onFilter('mine');
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipClass(activeFilter === 'mine')}`}
      >
        Mine
        {activeFilter === 'mine' && (
          <span className='text-xs text-muted-foreground'>· {totalCount}</span>
        )}
      </button>

      <button
        type='button'
        onClick={() => {
          onFilter('all');
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipClass(activeFilter === 'all')}`}
      >
        All
        <span className='text-xs text-muted-foreground'>· {totalCount}</span>
      </button>

      {overdue > 0 && (
        <button
          type='button'
          onClick={() => {
            onFilter('overdue');
          }}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${overdueChipClass(activeFilter === 'overdue')}`}
        >
          Overdue
          <span className='text-xs opacity-60'>· {overdue}</span>
        </button>
      )}

      <button
        type='button'
        onClick={() => {
          onFilter('this_week');
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipClass(activeFilter === 'this_week')}`}
      >
        This week
      </button>

      <button
        type='button'
        onClick={() => {
          onFilter('blocked');
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipClass(activeFilter === 'blocked')}`}
      >
        Blockers
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface AttentionTableClientProps {
  initialIssues: Issue[];
  initialTotalCount: number;
  overdue: number;
  currentUserId: number | null;
  cookieOrgId: number;
}

const PAGE_SIZE = 20;

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildChunkParams(
  filter: FilterId,
  assignee: number | null,
  orgId: number,
  offset: number,
) {
  const base = {
    organization_id: orgId || null,
    assignee,
    offset,
    limit: PAGE_SIZE,
    exclude_statuses: ['done'] as IssueStatus[],
  };

  if (filter === 'overdue') {
    return {
      ...base,
      overdue: true,
      sort: 'due_date' as const,
      order: 'asc' as const,
    };
  }

  if (filter === 'this_week') {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      ...base,
      due_date_from: toDateStr(tomorrow),
      due_date_to: toDateStr(weekEnd),
      sort: 'due_date' as const,
      order: 'asc' as const,
    };
  }

  if (filter === 'blocked') {
    return {
      ...base,
      blocked: true,
      sort: 'updated_at' as const,
      order: 'desc' as const,
    };
  }

  return { ...base, sort: 'updated_at' as const, order: 'desc' as const };
}

export function AttentionTableClient({
  initialIssues,
  initialTotalCount,
  overdue,
  currentUserId,
  cookieOrgId,
}: AttentionTableClientProps) {
  const issueDetailHref = useIssueDetailHref();
  const [activeFilter, setActiveFilter] = useState<FilterId>('mine');
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [firstPage, setFirstPage] = useState<{
    data: Issue[];
    hasMore: boolean;
  }>({
    data: initialIssues,
    hasMore: initialTotalCount > initialIssues.length,
  });
  const isFirstRender = useRef(true);

  const resolvedAssignee = useCallback(
    (filter: FilterId): number | null => {
      return filter === 'mine' && currentUserId !== null ? currentUserId : null;
    },
    [currentUserId],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let cancelled = false;

    loadIssuesChunk(
      buildChunkParams(
        activeFilter,
        resolvedAssignee(activeFilter),
        cookieOrgId,
        0,
      ),
    )
      .then(({ data, hasMore, totalCount: count }) => {
        if (cancelled) return;
        setFirstPage({ data, hasMore });
        setTotalCount(count);
      })
      .catch(() => {
        if (!cancelled) toast.error('Не удалось загрузить задачи');
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter, cookieOrgId, resolvedAssignee]);

  const fetchMore = useCallback(
    (offset: number) => {
      return loadIssuesChunk(
        buildChunkParams(
          activeFilter,
          resolvedAssignee(activeFilter),
          cookieOrgId,
          offset,
        ),
      );
    },
    [activeFilter, cookieOrgId, resolvedAssignee],
  );

  const scrollInitialItems = useMemo(() => {
    return firstPage.data;
  }, [firstPage]);

  const { items, isLoading, hasMore, sentinelRef } = useInfiniteScroll<Issue>({
    fetchMore,
    initialItems: scrollInitialItems,
    initialHasMore: firstPage.hasMore,
  });

  // All filtering is server-side — just deduplicate pages from infinite scroll.
  const visibleItems = useMemo(() => {
    const seen = new Set<number>();
    return items.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return true;
    });
  }, [items]);

  return (
    <div className='flex flex-col gap-4'>
      <AttentionChips
        activeFilter={activeFilter}
        totalCount={totalCount}
        overdue={overdue}
        onFilter={setActiveFilter}
      />

      {visibleItems.length === 0 && !isLoading ? (
        <div className='rounded-card border border-border bg-card p-6'>
          <EmptyState
            icon={Bug}
            title='No tasks found'
            description='Try switching the filter.'
          />
        </div>
      ) : (
        <div className='overflow-hidden rounded-card border border-border bg-card'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[720px] table-fixed text-sm'>
              <colgroup>
                <col />
                <col className='w-[140px]' />
                <col className='w-40' />
                <col className='w-[180px]' />
                <col className='w-[130px]' />
              </colgroup>
              <AttentionTableHead />
              <tbody>
                {visibleItems.map((issue) => {
                  return (
                    <IssueAttentionRow
                      key={issue.id}
                      issue={issue}
                      href={issueDetailHref(issueHrefSegment(issue))}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {isLoading && (
            <div className='flex justify-center py-4'>
              <SpinLoader />
            </div>
          )}

          {!hasMore && items.length > 0 ? (
            <div className='py-4'>
              <InfiniteScrollStatus itemCount={items.length} />
            </div>
          ) : (
            <div ref={sentinelRef} className='h-10' />
          )}
        </div>
      )}
    </div>
  );
}
