'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  getEventTaskReview,
  getLatestMeetingTaskReview,
} from '../api/meeting-task-review';
import { getCalendarEventsByDate } from '../api/meetings';
import { pluralMeetings } from '../model/plural';

import { MeetingTaskReviewBlocks } from './meeting-task-review-blocks';
import { MeetingTaskReviewCard } from './meeting-task-review-card';

import type {
  MeetingListItem,
  MeetingTaskReview,
  MeetingTaskReviewBlock,
} from '../model/types';

type EventWithReview = { event: MeetingListItem; review: MeetingTaskReview };

type DayGroup = { key: string; label: string; items: EventWithReview[] };

function formatDayLabel(date: Date): string {
  if (isToday(date)) return 'Сегодня';
  if (isYesterday(date)) return 'Вчера';
  const label = format(date, 'EEEE, d MMMM', { locale: ru });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByDay(items: EventWithReview[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();

  for (const item of items) {
    const date = new Date(item.event.starts_at);
    const key = format(date, 'yyyy-MM-dd');
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: formatDayLabel(date), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

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

function HealthBlocksSection({
  blocks,
  onReload,
}: {
  blocks: MeetingTaskReviewBlock[];
  onReload: () => void;
}) {
  return (
    <div className='space-y-2'>
      {blocks.length > 0 ? (
        <MeetingTaskReviewBlocks blocks={blocks} onReload={onReload} />
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

  const reloadHealthBlocks = useCallback(async () => {
    const latestReview = await getLatestMeetingTaskReview();
    setHealthBlocks(latestReview?.health_blocks ?? []);
  }, []);

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

  const dayGroups = groupByDay(eventsWithReviews);

  return (
    <div className='space-y-6'>
      {dayGroups.length > 0 ? (
        <div className='space-y-5'>
          {dayGroups.map((group) => {
            return (
              <section key={group.key} className='space-y-2.5'>
                <div className='flex items-center gap-3 px-0.5'>
                  <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    {group.label}
                  </span>
                  <span className='h-px flex-1 bg-border' />
                  <span className='text-xs text-muted-foreground'>
                    {group.items.length} {pluralMeetings(group.items.length)}
                  </span>
                </div>
                <div className='space-y-3'>
                  {group.items.map(({ event, review }) => {
                    return (
                      <MeetingTaskReviewCard
                        key={event.id}
                        event={event}
                        initialReview={review}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className='px-1 text-sm text-muted-foreground'>
          За последнюю неделю нет проанализированных встреч
        </p>
      )}

      <HealthBlocksSection
        blocks={healthBlocks}
        onReload={reloadHealthBlocks}
      />
    </div>
  );
}
