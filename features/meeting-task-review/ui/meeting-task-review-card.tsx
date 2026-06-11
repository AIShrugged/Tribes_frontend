'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getEventTaskReview } from '../api/meeting-task-review';

import { MeetingTaskReviewBlocks } from './meeting-task-review-blocks';

import type { MeetingListItem, MeetingTaskReview } from '../model/types';

function formatEventDateTime(startsAt: string): string {
  const date = new Date(startsAt);
  const time = format(date, 'HH:mm');

  if (isToday(date)) return `сегодня, ${time}`;
  if (isYesterday(date)) return `вчера, ${time}`;
  return format(date, 'd MMMM, HH:mm', { locale: ru });
}

function ReviewBody({ review }: { review: MeetingTaskReview }) {
  if (review.status === 'pending') return null;

  if (review.status === 'failed') {
    return (
      <div className='flex items-start gap-2.5 rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3'>
        <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-destructive' />
        <p className='text-xs text-muted-foreground'>
          {review.error ?? 'Ошибка анализа задач'}
        </p>
      </div>
    );
  }

  if (review.llm_blocks.length === 0) {
    return (
      <div className='flex items-center gap-2 rounded-card border border-border bg-card px-4 py-3'>
        <CheckCircle2 className='h-4 w-4 shrink-0 text-(--success-500)' />
        <span className='text-sm text-muted-foreground'>
          Всё хорошо по итогам встречи
        </span>
      </div>
    );
  }

  return <MeetingTaskReviewBlocks blocks={review.llm_blocks} />;
}

export function MeetingTaskReviewCard({
  event,
  initialReview,
}: {
  event: MeetingListItem;
  initialReview: MeetingTaskReview;
}) {
  const [review, setReview] = useState(initialReview);

  useEffect(() => {
    if (initialReview.status !== 'pending') return;

    let count = 0;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(async () => {
        const data = await getEventTaskReview(event.id);
        if (!active) return;
        if (data !== null) setReview(data);
        count += 1;
        if (data?.status === 'pending' && count < 10) schedule();
      }, 2000);
    };

    schedule();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [event.id, initialReview.status]);

  const dateLabel = formatEventDateTime(event.starts_at);

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between rounded-card border border-border bg-card px-4 py-3'>
        <div>
          <p className='text-sm font-medium text-foreground'>{event.title}</p>
          <p className='text-xs text-muted-foreground'>
            {dateLabel}
            {review.status === 'done' &&
              ` · Проанализировано: ${review.analyzed_count} задач`}
          </p>
        </div>
        {review.status === 'pending' && (
          <Loader2 className='h-3.5 w-3.5 animate-spin text-muted-foreground' />
        )}
      </div>

      <ReviewBody review={review} />
    </div>
  );
}
