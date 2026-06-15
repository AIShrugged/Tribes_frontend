'use client';

import { Activity, CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  getEventTaskReview,
  getLatestMeetingTaskReview,
} from '../api/meeting-task-review';
import { getCalendarEventsByDate } from '../api/meetings';

import { MeetingTaskReviewBlocks } from './meeting-task-review-blocks';
import { MeetingTaskReviewCard } from './meeting-task-review-card';

import type {
  MeetingListItem,
  MeetingTaskReview,
  MeetingTaskReviewBlock,
} from '../model/types';

type EventWithReview = { event: MeetingListItem; review: MeetingTaskReview };

function getRecentDateStrings(): string[] {
  const now = new Date();
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  });
}

function collectSortedEvents(
  results: PromiseSettledResult<MeetingListItem[]>[],
): MeetingListItem[] {
  const all: MeetingListItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') all.push(...result.value);
  }
  return all.toSorted((a, b) => {
    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
  });
}

function pairWithReviews(
  events: MeetingListItem[],
  reviewResults: PromiseSettledResult<MeetingTaskReview | null>[],
): EventWithReview[] {
  const pairs: EventWithReview[] = [];
  for (const [i, event] of events.entries()) {
    const result = reviewResults[i];
    if (result.status === 'fulfilled' && result.value !== null) {
      pairs.push({ event, review: result.value });
    }
  }
  return pairs;
}

function HealthBlocksSection({ blocks }: { blocks: MeetingTaskReviewBlock[] }) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-1.5 px-1'>
        <Activity className='h-3.5 w-3.5 text-muted-foreground' />
        <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Здоровье задач
        </span>
      </div>
      {blocks.length > 0 ? (
        <MeetingTaskReviewBlocks blocks={blocks} />
      ) : (
        <div className='flex items-center gap-2 rounded-card border border-border bg-card px-4 py-3'>
          <CheckCircle2 className='h-4 w-4 shrink-0 text-(--success-500)' />
          <span className='text-sm text-muted-foreground'>
            Нет проблем с задачами
          </span>
        </div>
      )}
    </div>
  );
}

export function MeetingTaskReviewContainer() {
  const [eventsWithReviews, setEventsWithReviews] = useState<EventWithReview[]>(
    [],
  );
  const [healthBlocks, setHealthBlocks] = useState<MeetingTaskReviewBlock[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const dates = getRecentDateStrings();
    try {
      const [eventsResults, latestReview] = await Promise.all([
        Promise.allSettled(
          dates.map((date) => {
            return getCalendarEventsByDate(date);
          }),
        ),
        getLatestMeetingTaskReview(),
      ]);

      const sorted = collectSortedEvents(eventsResults);
      const reviewResults = await Promise.allSettled(
        sorted.map((event) => {
          return getEventTaskReview(event.id);
        }),
      );

      setEventsWithReviews(pairWithReviews(sorted, reviewResults));
      setHealthBlocks(latestReview?.health_blocks ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
        <span>Загружаем данные встреч...</span>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {eventsWithReviews.map(({ event, review }) => {
        return (
          <MeetingTaskReviewCard
            key={event.id}
            event={event}
            initialReview={review}
          />
        );
      })}
      <HealthBlocksSection blocks={healthBlocks} />
    </div>
  );
}
