'use client';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { MeetingTaskReviewBlocks } from './meeting-task-review-blocks';

import type { MeetingTaskReview } from '../model/types';

interface MeetingTaskReviewCardProps {
  review: MeetingTaskReview | null;
  isLoading: boolean;
}

export function MeetingTaskReviewCard({
  review,
  isLoading,
}: MeetingTaskReviewCardProps) {
  if (isLoading) {
    return (
      <div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
        <span>Анализируем задачи...</span>
      </div>
    );
  }

  if (!review) return null;

  if (review.status === 'failed') {
    return (
      <div className='flex items-start gap-2.5 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm'>
        <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-destructive' />
        <div>
          <p className='font-medium text-destructive'>Ошибка анализа задач</p>
          {review.error && (
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {review.error}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (review.status === 'pending') {
    return (
      <div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
        <span>Встреча анализируется...</span>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card px-4 py-3'>
        <div className='flex items-center gap-2.5'>
          <CheckCircle2 className='h-4 w-4 shrink-0 text-(--success-500)' />
          <div>
            <p className='text-sm font-medium text-foreground'>
              Результаты анализа встречи
            </p>
            <p className='text-xs text-muted-foreground'>
              Проанализировано:{' '}
              <span className='font-medium text-foreground'>
                {review.analyzed_count}
              </span>{' '}
              задач
            </p>
          </div>
        </div>
        <span className='shrink-0 text-xs text-muted-foreground'>
          {format(new Date(review.generated_at), 'dd MMM. yyyy HH:mm', {
            locale: ru,
          })}
        </span>
      </div>

      {review.blocks.length > 0 && (
        <MeetingTaskReviewBlocks blocks={review.blocks} />
      )}
    </div>
  );
}
