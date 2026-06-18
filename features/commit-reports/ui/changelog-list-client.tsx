'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getCommitReports } from '@/features/commit-reports/api/commit-reports';
import { CommitReportCard } from '@/features/commit-reports/ui/commit-report-card';

import type { CommitReportSummary } from '@/features/commit-reports/model/types';

interface Props {
  orgId: number;
  initialItems: CommitReportSummary[];
  initialTotalCount: number;
  initialHasMore: boolean;
  pageSize?: number;
}

export function ChangelogListClient({
  orgId,
  initialItems,
  initialTotalCount,
  initialHasMore,
  pageSize = 50,
}: Props) {
  const [items, setItems] = useState<CommitReportSummary[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Monotonic server-offset cursor: advanced by the rows the SERVER returns, so a report inserted
  // at the head between pages can't freeze paging (deriving offset from deduped items.length could).
  const offsetRef = useRef(initialItems.length);

  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialHasMore);
    offsetRef.current = initialItems.length;
  }, [initialItems, initialTotalCount, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const next = await getCommitReports(orgId, {
        offset: offsetRef.current,
        limit: pageSize,
      });
      // Advance the cursor by what the SERVER returned (incl. any re-emitted boundary row), so
      // progress never stalls; the dedup below only prevents duplicate React keys.
      offsetRef.current += next.data.length;
      // Dedup by id — a new report between pages can re-emit a boundary row.
      const seen = new Set(
        items.map((report) => {
          return report.id;
        }),
      );
      const fresh = next.data.filter((report) => {
        return !seen.has(report.id);
      });

      setItems((prev) => {
        return [...prev, ...fresh];
      });
      setTotalCount(next.totalCount);
      // Stop when the server returns an empty page or the cursor covered the (possibly grown) total.
      setHasMore(next.data.length > 0 && offsetRef.current < next.totalCount);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load more changelog entries';
      toast.error(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, items, orgId, pageSize]);

  if (items.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        <p className='text-sm text-muted-foreground'>
          No changelog entries yet.
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
        {items.map((report) => {
          return <CommitReportCard key={report.id} report={report} />;
        })}
      </div>

      {hasMore && (
        <div className='flex justify-center py-3'>
          <button
            type='button'
            onClick={loadMore}
            disabled={isLoadingMore}
            className='inline-flex h-9 items-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50'
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
