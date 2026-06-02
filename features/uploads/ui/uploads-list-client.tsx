'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getUploads } from '@/features/uploads/api/uploads';
import { UploadCard } from '@/features/uploads/ui/upload-card';
import { ROUTES } from '@/shared/lib/routes';

import type { UploadLogItem } from '@/features/uploads/model/types';

interface Props {
  initialItems: UploadLogItem[];
  initialTotalCount: number;
  initialHasMore: boolean;
  pageSize?: number;
}

export function UploadsListClient({
  initialItems,
  initialTotalCount,
  initialHasMore,
  pageSize = 50,
}: Props) {
  const [items, setItems] = useState<UploadLogItem[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialHasMore);
  }, [initialItems, initialTotalCount, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || items.length >= totalCount) return;

    setIsLoadingMore(true);
    try {
      const next = await getUploads({ offset: items.length, limit: pageSize });
      // Dedup: the org-wide feed re-ranks per request, so a new upload between pages
      // can re-emit a boundary row (same type+id) — drop it to avoid a duplicate key.
      const seen = new Set(
        items.map((u) => {
          return `${u.type}-${u.id}`;
        }),
      );
      const fresh = next.data.filter((u) => {
        return !seen.has(`${u.type}-${u.id}`);
      });

      setItems((prev) => {
        return [...prev, ...fresh];
      });
      setTotalCount(next.totalCount);
      // Terminate on cumulative length (not per-page size) and on an empty page.
      setHasMore(
        items.length + fresh.length < next.totalCount && next.data.length > 0,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load more uploads';
      toast.error(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, items, pageSize, totalCount]);

  if (items.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        <p className='text-sm text-muted-foreground'>
          No uploads yet — upload a transcript or task file to see it here.
        </p>
        <div className='flex gap-2'>
          <Link
            href={ROUTES.DASHBOARD.UPLOADS_TRANSCRIPTS}
            className='inline-flex h-9 items-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm text-foreground transition-colors hover:bg-white/5'
          >
            Upload transcript
          </Link>
          <Link
            href={ROUTES.DASHBOARD.UPLOADS_TASKS}
            className='inline-flex h-9 items-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm text-foreground transition-colors hover:bg-white/5'
          >
            Upload task data
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3 px-4 py-4'>
      <p className='text-xs text-muted-foreground'>
        Showing {items.length} of {totalCount}
      </p>

      <div className='flex flex-col gap-2'>
        {items.map((upload) => {
          return <UploadCard key={`${upload.type}-${upload.id}`} upload={upload} />;
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
