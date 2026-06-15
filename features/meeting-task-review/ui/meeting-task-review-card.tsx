'use client';

import { format } from 'date-fns';
import { AlertCircle, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getEventTaskReview } from '../api/meeting-task-review';
import { pluralTasks } from '../model/plural';

import { MeetingTaskReviewBlocks } from './meeting-task-review-blocks';

import type { MeetingListItem, MeetingTaskReview } from '../model/types';

function countFlagged(review: MeetingTaskReview): number {
  return review.llm_blocks.reduce((sum, block) => {
    return sum + block.count;
  }, 0);
}

function StatusPill({ review }: { review: MeetingTaskReview }) {
  const base =
    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium';

  if (review.status === 'pending') {
    return (
      <span className={`${base} bg-secondary text-muted-foreground`}>
        <Loader2 className='h-3 w-3 animate-spin' />
        Анализ
      </span>
    );
  }

  if (review.status === 'failed') {
    return (
      <span className={`${base} bg-destructive/10 text-destructive`}>
        <AlertCircle className='h-3 w-3' />
        Ошибка
      </span>
    );
  }

  const flagged = countFlagged(review);

  if (flagged === 0) {
    return (
      <span className={`${base} bg-(--success-500)/10 text-(--success-500)`}>
        <CheckCircle2 className='h-3 w-3' />
        Всё хорошо
      </span>
    );
  }

  return (
    <span
      className={`${base} bg-(--warning-500)/10 text-(--warning-500)`}
      title='Задачи, требующие внимания'
    >
      <AlertCircle className='h-3 w-3' />
      {flagged} к вниманию
    </span>
  );
}

function ReviewBody({ review }: { review: MeetingTaskReview }) {
  if (review.status === 'failed') {
    return (
      <p className='text-xs text-muted-foreground'>
        {review.error ?? 'Не удалось проанализировать задачи встречи'}
      </p>
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

  const timeLabel = format(new Date(event.starts_at), 'HH:mm');
  const hasBody =
    review.status === 'failed' ||
    (review.status === 'done' && review.llm_blocks.length > 0);

  return (
    <div className='overflow-hidden rounded-card border border-border bg-card shadow-sm transition-shadow hover:shadow-md'>
      <div className='flex items-center gap-3 px-4 py-3'>
        <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary'>
          <CalendarDays className='h-4 w-4 text-muted-foreground' />
        </span>

        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold text-foreground'>
            {event.title}
          </p>
          <p className='text-xs text-muted-foreground'>
            {timeLabel}
            {review.status === 'done' &&
              ` · обсуждалось ${review.discussed_count} ${pluralTasks(review.discussed_count)}`}
          </p>
        </div>

        <StatusPill review={review} />
      </div>

      {hasBody && (
        <div className='border-t border-border bg-muted/40 px-3 py-3'>
          <ReviewBody review={review} />
        </div>
      )}
    </div>
  );
}
