'use client';

import { Brain, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { getBrainEvents } from '@/features/brain/api/events';
import {
  formatDateTime,
  formatRunUuid,
  groupEventsByRun,
} from '@/features/brain/lib/format';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

import { BrainEventItem } from './brain-event-item';

import type { BrainEvent } from '@/features/brain/model/types';
import type { ReactNode } from 'react';

interface Props {
  initialItems: BrainEvent[];
  initialTotalCount: number;
  /** The active organization — every query is scoped to it. */
  organizationId: number;
}

function distinctRuns(events: BrainEvent[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const event of events) {
    if (event.run_uuid && !seen.has(event.run_uuid)) {
      seen.add(event.run_uuid);
      result.push(event.run_uuid);
    }
  }

  return result;
}

function mergeRuns(previous: string[], events: BrainEvent[]): string[] {
  const merged = [...previous];
  const seen = new Set(previous);

  for (const run of distinctRuns(events)) {
    if (!seen.has(run)) {
      seen.add(run);
      merged.push(run);
    }
  }

  return merged;
}

/**
 * Read-only reasoning log for the active organization: events grouped by run
 * (loop pass), ordered by seq, with type icons. Supports an optional run filter,
 * manual refresh and pagination.
 * @param root0 - props.
 * @param root0.initialItems - SSR-loaded events.
 * @param root0.initialTotalCount - total event count from the Items-Count header.
 * @param root0.organizationId - the active organization id (query scope).
 */
export function ReasoningLog({
  initialItems,
  initialTotalCount,
  organizationId,
}: Props) {
  const [items, setItems] = useState<BrainEvent[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [knownRuns, setKnownRuns] = useState<string[]>(() => {
    return distinctRuns(initialItems);
  });
  const [runFilter, setRunFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(
    initialItems.length < initialTotalCount,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const runQuery = useCallback(
    async (runUuid: string) => {
      setIsLoading(true);
      setRunFilter(runUuid);

      try {
        const result = await getBrainEvents({
          runUuid: runUuid || undefined,
          organizationId,
          page: 1,
        });

        setItems(result.data);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setKnownRuns((prev) => {
          return mergeRuns(prev, result.data);
        });
        setPage(1);
      } catch {
        toast.error('Не удалось загрузить журнал');
      } finally {
        setIsLoading(false);
      }
    },
    [organizationId],
  );

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const result = await getBrainEvents({
        runUuid: runFilter || undefined,
        organizationId,
        page: nextPage,
      });

      setItems((prev) => {
        return [...prev, ...result.data];
      });
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setKnownRuns((prev) => {
        return mergeRuns(prev, result.data);
      });
      setPage(nextPage);
    } catch {
      toast.error('Не удалось загрузить ещё');
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, runFilter, organizationId]);

  const groups = groupEventsByRun(items);
  const showInitialSkeleton = isLoading && items.length === 0;

  let content: ReactNode;

  if (showInitialSkeleton) {
    content = <SkeletonList rows={6} />;
  } else if (groups.length === 0) {
    content = (
      <EmptyState
        icon={Brain}
        title='Журнал пуст'
        description='Здесь появятся рассуждения и действия «второго мозга» по мере его работы.'
      />
    );
  } else {
    content = (
      <div className='flex flex-col gap-4'>
        {groups.map((group) => {
          const firstEvent = group.events[0];

          return (
            <section
              key={group.runUuid ?? 'no-run'}
              className='rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4'
            >
              <header className='mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--divider)] pb-2'>
                <span
                  className='font-mono text-xs font-medium text-[var(--foreground)]'
                  title={group.runUuid ?? undefined}
                >
                  Запуск {formatRunUuid(group.runUuid)}
                </span>
                <span className='text-xs text-[var(--muted-foreground)]'>
                  {formatDateTime(firstEvent?.created_at)} ·{' '}
                  {group.events.length} событ.
                </span>
              </header>
              <ul className='flex flex-col'>
                {group.events.map((event, index) => {
                  return (
                    <BrainEventItem
                      key={event.id}
                      event={event}
                      isLast={index === group.events.length - 1}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-[var(--muted-foreground)]'>
          Записей: {totalCount}
        </p>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          fullWidth={false}
          loading={isLoading}
          loadingText='Обновляем…'
          leftIcon={<RefreshCw className='h-4 w-4' aria-hidden='true' />}
          onClick={() => {
            runQuery(runFilter);
          }}
        >
          Обновить
        </Button>
      </div>

      <div className='flex flex-wrap gap-3'>
        <select
          value={runFilter}
          disabled={isLoading}
          aria-label='Фильтр по запуску'
          onChange={(event) => {
            runQuery(event.target.value);
          }}
          className='w-fit max-w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
        >
          <option value=''>Все запуски</option>
          {knownRuns.map((run) => {
            return (
              <option key={run} value={run}>
                {formatRunUuid(run)}
              </option>
            );
          })}
        </select>
      </div>

      {content}

      {hasMore && items.length > 0 && (
        <div className='flex justify-center pt-2'>
          <Button
            type='button'
            variant='secondary'
            fullWidth={false}
            loading={isLoadingMore}
            loadingText='Загружаем…'
            onClick={loadMore}
          >
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  );
}
