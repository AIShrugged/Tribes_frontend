'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getMeetingsList } from '../api/meetings';
import { type MeetingsListFilters } from '../model/filters';

import { MeetingCard } from './meeting-card';

import type { CalendarEventListItem } from '../model/types';

interface Props {
  filters: MeetingsListFilters;
  initialItems: CalendarEventListItem[];
  initialTotalCount: number;
  initialHasMore: boolean;
  pageSize?: number;
}

export function MeetingsListClient({
  filters,
  initialItems,
  initialTotalCount,
  initialHasMore,
  pageSize = 50,
}: Props) {
  const [items, setItems] = useState<CalendarEventListItem[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset to initial data when filters/initial props change (parent re-renders).
  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialHasMore);
  }, [initialItems, initialTotalCount, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const next = await getMeetingsList({
        ...filters,
        offset: items.length,
        limit: pageSize,
      });
      setItems((prev) => {
        return [...prev, ...next.data];
      });
      setTotalCount(next.totalCount);
      setHasMore((prev) => {
        return prev && next.hasMore;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load more meetings';
      toast.error(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [filters, hasMore, isLoadingMore, items.length, pageSize]);

  if (items.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        <p className='text-sm text-muted-foreground'>
          No meetings match these filters.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3 px-4 py-4'>
      <p className='text-xs text-muted-foreground'>
        Showing {items.length} of {totalCount}
      </p>

      <div className='flex flex-col gap-2'>
        {items.map((meeting) => {
          return <MeetingCard key={meeting.id} meeting={meeting} />;
        })}
      </div>

      {hasMore && (
        <div className='flex justify-center py-3'>
          <button
            type='button'
            onClick={loadMore}
            disabled={isLoadingMore}
            className='inline-flex items-center px-4 h-9 rounded-[var(--radius-button)] border border-border bg-background text-sm text-foreground hover:bg-white/5 transition-colors disabled:opacity-50'
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
