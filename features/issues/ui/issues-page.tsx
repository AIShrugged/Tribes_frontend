'use client';

import { format } from 'date-fns';
import { Bug } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';

import {
  IssueCodeBadge,
  IssuePriorityBadge,
  IssueStatusBadge,
  issueHrefSegment,
} from '@/entities/issue';
import {
  getArchivedCount,
  loadArchivedChunk,
  loadIssuesChunk,
  updateIssue,
} from '@/features/issues/api/issues';
import { useIssueDetailHref } from '@/features/issues/hooks/use-issue-detail-href';
import { useFiltersContext } from '@/features/issues/model/filters-context';
import {
  getPriorityLevel,
  ISSUE_STATUS_OPTIONS,
} from '@/features/issues/model/types';
import { ArchivedSection } from '@/features/issues/ui/archived-section';
import { ArchivedSectionToggle } from '@/features/issues/ui/archived-section-toggle';
import { useInfiniteScroll } from '@/shared/hooks';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import { InfiniteScrollStatus } from '@/shared/ui/layout/infinite-scroll-status';
import SpinLoader from '@/shared/ui/layout/spin-loader';
import { SortableHeader } from '@/shared/ui/table/SortableHeader';

import type {
  Issue,
  IssueFilters,
  IssueSortField,
  IssueStatus,
  PersonOption,
  SharedFilters,
  SortOrder,
} from '@/features/issues/model/types';

const PAGE_SIZE = 20;

interface IssuesPageProps {
  initialIssues: Issue[];
  initialTotalCount: number;
  persons: PersonOption[];
  filters: SharedFilters;
  filtersVersion: number;
  initialSort: IssueSortField;
  initialOrder: SortOrder;
  onShowArchivedChange: (value: boolean) => void;
}

/**
 * formatIssueDate.
 * @param value - iso string.
 * @returns formatted date.
 */
function formatIssueDate(value: string) {
  return format(new Date(value), 'dd.MM.yyyy HH:mm');
}

/**
 * formatIssueDueDate — returns a label and className for a due date cell.
 * @param dueDate - ISO date string or null.
 * @returns Object with label and className.
 */
function formatIssueDueDate(dueDate: string | null): {
  label: string;
  className: string;
} {
  if (!dueDate) return { label: '—', className: 'text-muted-foreground' };

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);

  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dateLabel = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (diffDays < 0)
    return { label: `${dateLabel} · overdue`, className: 'text-destructive' };
  if (diffDays === 0)
    return { label: `${dateLabel} · today`, className: 'text-amber-500' };
  if (diffDays === 1)
    return { label: `${dateLabel} · 1 day left`, className: 'text-amber-500' };

  return {
    label: `${dateLabel} · ${diffDays} days left`,
    className: 'text-muted-foreground',
  };
}

/**
 *
 * @param issue
 */
function formatIssueScope(issue: Issue) {
  if (!issue.organization_id) {
    return '—';
  }

  return issue.team_id
    ? `Org #${issue.organization_id} · Team #${issue.team_id}`
    : `Org #${issue.organization_id}`;
}

/**
 * IssuesPage renders the issues list with infinite scroll.
 * All filters (org, team, search, type, assignee, priority, status) are controlled by parent.
 * Tab-local filters: sort.
 * @param props - component props.
 * @param props.initialIssues
 * @param props.initialTotalCount
 * @param props.persons
 * @param props.filters
 * @param props.filtersVersion
 * @param props.initialSort
 * @param props.initialOrder
 * @returns JSX element.
 */
export function IssuesPage({
  initialIssues,
  initialTotalCount,
  persons,
  filters,
  filtersVersion,
  initialSort,
  initialOrder,
  onShowArchivedChange,
}: IssuesPageProps) {
  const { bumpColumnsVersion } = useFiltersContext();
  const issueDetailHref = useIssueDetailHref();
  const [isPending, startTransition] = useTransition();
  const [sortField, setSortField] = useState<IssueSortField>(initialSort);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);
  const [updatingIssueId, setUpdatingIssueId] = useState<number | null>(null);
  const [firstPage, setFirstPage] = useState<{
    data: Issue[];
    hasMore: boolean;
  }>({
    data: initialIssues,
    hasMore: initialTotalCount > initialIssues.length,
  });
  const isFirstRender = useRef(true);
  const [editingStatusIssueId, setEditingStatusIssueId] = useState<
    number | null
  >(null);
  const [editingAssigneeIssueId, setEditingAssigneeIssueId] = useState<
    number | null
  >(null);

  // Archived section state
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [archivedItems, setArchivedItems] = useState<Issue[]>([]);
  const [archivedOffset, setArchivedOffset] = useState(0);
  const [archivedHasMore, setArchivedHasMore] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const showArchived = filters.show_archived;

  // filtersRef used inside fetchMore without triggering re-renders
  const filtersRef = useRef({
    ...filters,
    sort: sortField,
    order: sortOrder,
  });

  const archivedBaseFilters = useMemo((): IssueFilters => {
    return {
      organization_id: filters.organization_id
        ? Number(filters.organization_id)
        : null,
      team_id: filters.team_id ? Number(filters.team_id) : null,
      type: filters.type || undefined,
      assignee:
        filters.assignee_id && filters.assignee_id !== 'unassigned'
          ? Number(filters.assignee_id)
          : null,
      unassigned: filters.assignee_id === 'unassigned',
      search: filters.search || undefined,
    };
  }, [
    filters.organization_id,
    filters.team_id,
    filters.type,
    filters.assignee_id,
    filters.search,
  ]);

  // Keep filtersRef in sync with latest props/state (useEffect avoids updating during render)
  useEffect(() => {
    filtersRef.current = {
      ...filters,
      sort: sortField,
      order: sortOrder,
    };
  });

  // Reload first page whenever filters or sort change (skip initial render — SSR data is already correct)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      return;
    }

    let cancelled = false;
    const f = filtersRef.current;

    loadIssuesChunk({
      organization_id: f.organization_id ? Number(f.organization_id) : null,
      team_id: f.team_id ? Number(f.team_id) : null,
      status: f.status || undefined,
      type: f.type || undefined,
      assignee:
        f.assignee_id && f.assignee_id !== 'unassigned'
          ? Number(f.assignee_id)
          : null,
      unassigned: f.assignee_id === 'unassigned',
      offset: 0,
      limit: PAGE_SIZE,
      sort: f.sort,
      order: f.order,
      search: f.search || undefined,
    })
      .then(({ data, hasMore: more }) => {
        if (!cancelled) setFirstPage({ data, hasMore: more });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load issues');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filtersVersion, sortField, sortOrder]);

  // Fetch archived count whenever filters change (non-blocking)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setArchivedCount(null);
      setArchivedItems([]);
      setArchivedOffset(0);
      setArchivedHasMore(false);

      try {
        const count = await getArchivedCount(archivedBaseFilters);

        if (!cancelled) setArchivedCount(count);
      } catch {
        if (!cancelled) setArchivedCount(0);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filtersVersion, archivedBaseFilters]);

  // Ref-based guard prevents double-invoke race on handleLoadMoreArchived.
  // State booleans can be stale in closures; a ref is always current.
  const archivedLoadingRef = useRef(false);

  // Load first page of archived items when show_archived becomes true
  useEffect(() => {
    if (!showArchived) return;

    let cancelled = false;

    const run = async () => {
      archivedLoadingRef.current = true;
      setArchivedLoading(true);
      setArchivedItems([]);
      setArchivedOffset(0);

      try {
        const { data, hasMore } = await loadArchivedChunk({
          ...archivedBaseFilters,
          offset: 0,
          limit: PAGE_SIZE,
        });

        if (cancelled) return;
        setArchivedItems(data);
        setArchivedOffset(PAGE_SIZE);
        setArchivedHasMore(hasMore);
      } catch {
        // silently fail
      } finally {
        archivedLoadingRef.current = false;
        if (!cancelled) setArchivedLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [showArchived, filtersVersion]);

  const handleLoadMoreArchived = useCallback(() => {
    if (archivedLoadingRef.current) return;

    archivedLoadingRef.current = true;
    setArchivedLoading(true);

    loadArchivedChunk({
      ...archivedBaseFilters,
      offset: archivedOffset,
      limit: PAGE_SIZE,
    })
      .then(({ data, hasMore }) => {
        setArchivedItems((prev) => {
          return [...prev, ...data];
        });
        setArchivedOffset((prev) => {
          return prev + PAGE_SIZE;
        });
        setArchivedHasMore(hasMore);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        archivedLoadingRef.current = false;
        setArchivedLoading(false);
      });
  }, [archivedBaseFilters, archivedOffset]);

  const scrollInitialItems = useMemo(() => {
    return firstPage.data;
  }, [firstPage]);

  const fetchMore = useCallback(
    async (offset: number) => {
      const f = filtersRef.current;

      return loadIssuesChunk({
        organization_id: f.organization_id ? Number(f.organization_id) : null,
        team_id: f.team_id ? Number(f.team_id) : null,
        status: f.status || undefined,
        type: f.type || undefined,
        assignee:
          f.assignee_id && f.assignee_id !== 'unassigned'
            ? Number(f.assignee_id)
            : null,
        unassigned: f.assignee_id === 'unassigned',
        offset,
        limit: PAGE_SIZE,
        sort: f.sort,
        order: f.order,
        search: f.search || undefined,
      });
    },
    [filtersVersion, sortField, sortOrder],
  );

  const { items, isLoading, hasMore, sentinelRef } = useInfiniteScroll<Issue>({
    fetchMore,
    initialItems: scrollInitialItems,
    initialHasMore: firstPage.hasMore,
  });
  const visibleItems = useMemo(() => {
    const seen = new Set<number>();

    return items.filter((issue) => {
      if (seen.has(issue.id)) return false;

      seen.add(issue.id);
      return true;
    });
  }, [items]);

  const handleSort = useCallback(
    (field: string) => {
      const sortableField = field as IssueSortField;
      const newOrder =
        sortField === sortableField && sortOrder === 'desc' ? 'asc' : 'desc';

      setSortField(sortableField);
      setSortOrder(newOrder);
    },
    [sortField, sortOrder],
  );

  const rowStatusOptions = ISSUE_STATUS_OPTIONS;
  const rowAssigneeOptions = useMemo(() => {
    return [
      { value: '', label: 'Unassigned' },
      ...persons.map((person) => {
        return {
          value: String(person.id),
          label: person.email
            ? `${person.name} (${person.email})`
            : person.name,
        };
      }),
    ];
  }, [persons]);

  /**
   *
   * @param issue
   * @param patch
   */
  const updateIssueInline = useCallback(
    (issue: Issue, patch: Partial<Pick<Issue, 'status' | 'assignee_id'>>) => {
      const nextStatus = (patch.status ?? issue.status) as IssueStatus;
      const nextAssigneeId =
        patch.assignee_id === undefined ? issue.assignee_id : patch.assignee_id;

      setUpdatingIssueId(issue.id);

      startTransition(async () => {
        try {
          const result = await updateIssue(issue.id, {
            name: issue.name,
            description: issue.description,
            type: issue.type,
            status: nextStatus,
            organization_id: issue.organization_id,
            team_id: issue.team_id,
            epic_id: issue.epic_id ?? null,
            assignee_id: nextAssigneeId,
            author_id: issue.user_id ?? null,
            due_date: issue.due_date,
            priority: issue.priority,
          });

          if (result.error !== null) {
            setUpdatingIssueId(null);
            toast.error(result.error);

            return;
          }

          setUpdatingIssueId(null);
          setEditingStatusIssueId(null);
          setEditingAssigneeIssueId(null);

          if (nextStatus === 'done') {
            const level =
              issue.priority === 0 ? null : getPriorityLevel(issue.priority);
            toast.success(level ? `Done: ${issue.name}` : 'Issue updated', {
              description: level
                ? `${level.label} priority issue completed`
                : undefined,
              duration: 5000,
            });
          } else {
            toast.success('Issue updated');
          }

          bumpColumnsVersion();
        } catch (error) {
          setUpdatingIssueId(null);
          toast.error((error as Error).message);
        }
      });
    },
    [startTransition, bumpColumnsVersion],
  );

  return (
    <div className='flex flex-col gap-6'>
      {visibleItems.length === 0 && !isLoading ? (
        <div className='rounded-[var(--radius-card)] border border-border bg-card p-6'>
          <EmptyState
            icon={Bug}
            title='No issues found'
            description='Adjust filters or create a new issue.'
          />
        </div>
      ) : (
        <div className='overflow-hidden border border-border bg-card'>
          <div className='overflow-x-auto scrollbar-custom'>
            <table className='w-full min-w-[1180px] table-fixed text-sm'>
              <colgroup>
                <col className='w-[45px]' />
                <col className='w-[200px]' />
                <col className='w-[110px]' />
                <col className='w-[120px]' />
                <col className='w-[100px]' />
                <col className='w-[140px]' />
                <col className='w-[180px]' />
                <col className='w-[240px]' />
                <col className='w-[150px]' />
              </colgroup>
              <thead className='bg-[var(--surface-2)] text-left text-muted-foreground'>
                <tr>
                  <th className='p-2'>
                    <SortableHeader
                      field='id'
                      label='ID'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>
                    <SortableHeader
                      field='name'
                      label='Issue'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>
                    <SortableHeader
                      field='type'
                      label='Type'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>
                    <SortableHeader
                      field='status'
                      label='Status'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>
                    <SortableHeader
                      field='priority'
                      label='Priority'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>
                    <SortableHeader
                      field='due_date'
                      label='Deadline'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className='p-2'>Scope</th>
                  <th className='p-2'>Assignee</th>
                  <th className='p-2'>
                    <SortableHeader
                      field='created_at'
                      label='Created'
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((issue) => {
                  return (
                    <tr
                      key={issue.id}
                      className='border-t border-border hover:bg-accent/20'
                    >
                      <td className='p-2 align-top whitespace-nowrap'>
                        <IssueCodeBadge
                          code={issue.code}
                          id={issue.id}
                          className='text-sm'
                        />
                      </td>
                      <td className='max-w-0 overflow-hidden p-2 align-top'>
                        <div className='flex items-center gap-1.5 min-w-0'>
                          <IssuePriorityBadge
                            priority={issue.priority}
                            status={issue.status}
                            className='shrink-0'
                          />
                          <Link
                            href={issueDetailHref(issueHrefSegment(issue))}
                            className='truncate font-medium text-foreground hover:text-primary'
                          >
                            {issue.name}
                          </Link>
                        </div>
                        {issue.description ? (
                          <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
                            {issue.description}
                          </p>
                        ) : null}
                        {issue.epic_id ? (
                          <Link
                            href={`${ROUTES.DASHBOARD.ISSUES}/${issue.epic_id}`}
                            className='mt-1 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300'
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <span className='rounded px-1 py-0.5 bg-violet-500/10 border border-violet-500/20'>
                              {issue.epic?.name
                                ? `Epic: ${issue.epic.name}`
                                : `Epic #${issue.epic_id}`}
                            </span>
                          </Link>
                        ) : null}
                      </td>
                      <td className='max-w-0 truncate p-2 align-top'>
                        {issue.type}
                      </td>
                      <td className='p-2 align-top'>
                        <div className='group/status flex flex-col gap-2'>
                          <IssueStatusBadge
                            status={issue.status}
                            className='w-fit'
                          />
                          {editingStatusIssueId === issue.id ? (
                            <div className='flex items-center gap-2'>
                              <InputDropdown
                                label='Change status'
                                options={rowStatusOptions}
                                value={issue.status}
                                onChange={(value) => {
                                  updateIssueInline(issue, {
                                    status: value as IssueStatus,
                                  });
                                }}
                                disabled={
                                  isPending || updatingIssueId === issue.id
                                }
                                searchable={false}
                                className='min-w-[180px]'
                              />
                              <Button
                                type='button'
                                variant={BUTTON_VARIANT.secondary}
                                className='h-10 w-auto px-3'
                                onClick={() => {
                                  setEditingStatusIssueId(null);
                                }}
                                disabled={
                                  isPending || updatingIssueId === issue.id
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              type='button'
                              className='w-fit text-xs text-muted-foreground opacity-0 transition-opacity group-hover/status:opacity-100 hover:text-foreground'
                              onClick={() => {
                                setEditingStatusIssueId(issue.id);
                                setEditingAssigneeIssueId(null);
                              }}
                            >
                              Change
                            </button>
                          )}
                        </div>
                      </td>
                      <td className='p-2 align-top'>
                        {issue.priority === 0 ? (
                          <span className='text-xs text-muted-foreground'>
                            —
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-medium ${getPriorityLevel(issue.priority).color}`}
                          >
                            {getPriorityLevel(issue.priority).label}
                          </span>
                        )}
                      </td>
                      <td className='p-2 align-top'>
                        {(() => {
                          const { label, className } = formatIssueDueDate(
                            issue.due_date,
                          );

                          return (
                            <span
                              className={`text-xs whitespace-nowrap ${className}`}
                            >
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className='p-2 align-top text-muted-foreground'>
                        {formatIssueScope(issue)}
                      </td>
                      <td className='p-2 align-top text-muted-foreground'>
                        <div className='group/assignee'>
                          {editingAssigneeIssueId === issue.id ? (
                            <div className='flex items-center gap-2'>
                              <InputDropdown
                                label='Assignee'
                                options={rowAssigneeOptions}
                                value={
                                  issue.assignee_id
                                    ? String(issue.assignee_id)
                                    : ''
                                }
                                onChange={(value) => {
                                  updateIssueInline(issue, {
                                    assignee_id: value ? Number(value) : null,
                                  });
                                }}
                                disabled={
                                  isPending || updatingIssueId === issue.id
                                }
                              />
                              <Button
                                type='button'
                                variant={BUTTON_VARIANT.secondary}
                                className='h-10 w-auto px-3'
                                onClick={() => {
                                  setEditingAssigneeIssueId(null);
                                }}
                                disabled={
                                  isPending || updatingIssueId === issue.id
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className='flex flex-col gap-1'>
                              <span className='text-sm text-foreground'>
                                {issue.assignee?.name ??
                                  issue.assignee_id ??
                                  'Unassigned'}
                              </span>
                              <button
                                type='button'
                                className='w-fit text-xs text-muted-foreground opacity-0 transition-opacity group-hover/assignee:opacity-100 hover:text-foreground'
                                onClick={() => {
                                  setEditingAssigneeIssueId(issue.id);
                                  setEditingStatusIssueId(null);
                                }}
                              >
                                Change
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className='p-2 align-top text-muted-foreground'>
                        <span className='whitespace-nowrap'>
                          {formatIssueDate(issue.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isLoading ? (
            <div className='flex justify-center py-4'>
              <SpinLoader />
            </div>
          ) : null}

          {!hasMore && items.length > 0 ? (
            <div className='py-4'>
              <InfiniteScrollStatus itemCount={items.length} />
            </div>
          ) : (
            <div ref={sentinelRef} className='h-10' />
          )}
        </div>
      )}

      {/* Archived section toggle — shown when count is known and > 0 */}
      {archivedCount !== null && archivedCount > 0 && (
        <ArchivedSectionToggle
          count={archivedCount}
          expanded={showArchived}
          onToggle={() => {
            onShowArchivedChange(!showArchived);
          }}
        />
      )}

      {/* Archived items section */}
      {showArchived && (
        <ArchivedSection
          items={archivedItems}
          loading={archivedLoading}
          hasMore={archivedHasMore}
          onLoadMore={handleLoadMoreArchived}
        />
      )}
    </div>
  );
}
