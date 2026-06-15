'use client';

import { Bug } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { loadIssuesChunk } from '@/features/issues/api/issues';
import { useIssueDetailHref } from '@/features/issues/hooks/use-issue-detail-href';
import { getPriorityLevel } from '@/features/issues/model/types';
import { useInfiniteScroll } from '@/shared/hooks';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { InfiniteScrollStatus } from '@/shared/ui/layout/infinite-scroll-status';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { Issue } from '@/features/issues/model/types';

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

const PRIORITY_P_MAP: Record<string, { prefix: string; cls: string }> = {
  Critical: { prefix: 'P0', cls: 'bg-red-500/10 text-red-400' },
  High: { prefix: 'P1', cls: 'bg-orange-500/10 text-orange-400' },
  Normal: { prefix: 'P2', cls: 'bg-secondary text-muted-foreground' },
  Low: { prefix: 'P3', cls: 'bg-blue-500/10 text-blue-400' },
  Minimal: { prefix: 'P4', cls: 'bg-secondary/60 text-muted-foreground/60' },
};

function getPriorityBadge(
  priority: number,
): { label: string; cls: string } | null {
  if (priority === 0) return null;
  const level = getPriorityLevel(priority);
  const meta = PRIORITY_P_MAP[level.label] ?? PRIORITY_P_MAP['Normal'];
  return { label: `${meta.prefix} ${level.label}`, cls: meta.cls };
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
// Due date (Russian)
// ---------------------------------------------------------------------------

function formatDueDateRu(dueDate: string | null): {
  label: string;
  cls: string;
} {
  if (!dueDate) return { label: '—', cls: 'text-muted-foreground/40' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return {
      label: `Просрочено · ${Math.abs(diffDays)} дн.`,
      cls: 'text-red-400',
    };
  }
  if (diffDays === 0) return { label: 'Сегодня', cls: 'text-amber-400' };
  if (diffDays === 1) return { label: 'Завтра', cls: 'text-amber-400' };

  const dateLabel = due.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
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
    hash = (hash * 31 + (name.codePointAt(i) ?? 0)) & 0x7f_ff_ff_ff;
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
  const due = formatDueDateRu(issue.due_date);
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
            #{issue.id}
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
          <span className='text-sm text-muted-foreground/40'>Не назначен</span>
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

const COLUMNS = [
  'ЗАДАЧА',
  'ПРИОРИТЕТ',
  'ДЕДЛАЙН',
  'ОТВЕТСТВЕННЫЙ',
  'СТАТУС',
] as const;

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
        Мои
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
        Все
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
          Просрочено
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
        На этой неделе
      </button>

      <button
        type='button'
        onClick={() => {
          onFilter('blocked');
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${chipClass(activeFilter === 'blocked')}`}
      >
        Блокеры
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
    loadIssuesChunk({
      organization_id: cookieOrgId || null,
      assignee: resolvedAssignee(activeFilter),
      sort: 'updated_at',
      order: 'desc',
      offset: 0,
      limit: PAGE_SIZE,
    })
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
      return loadIssuesChunk({
        organization_id: cookieOrgId || null,
        assignee: resolvedAssignee(activeFilter),
        sort: 'updated_at',
        order: 'desc',
        offset,
        limit: PAGE_SIZE,
      });
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

  const visibleItems = useMemo(() => {
    const seen = new Set<number>();
    const deduped = items.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return true;
    });

    if (activeFilter === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return deduped.filter((i) => {
        return i.due_date !== null && new Date(i.due_date) < today;
      });
    }
    if (activeFilter === 'this_week') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return deduped.filter((i) => {
        if (!i.due_date) return false;
        const d = new Date(i.due_date);
        return d >= today && d <= weekEnd;
      });
    }
    if (activeFilter === 'blocked') {
      return deduped.filter((i) => {
        return String(i.status) === 'blocked';
      });
    }
    return deduped;
  }, [items, activeFilter]);

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
            title='Задачи не найдены'
            description='Попробуйте сменить фильтр.'
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
                      href={issueDetailHref(issue.id)}
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
