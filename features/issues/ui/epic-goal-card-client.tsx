'use client';

import { Minus, TrendingDown, TrendingUp, Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { detachTaskFromEpic } from '@/features/issues/api/issues';
import { formatTaskBreakdown } from '@/features/issues/model/goals-progress';

import { GoalTaskRow } from './goal-task-row';

import type { GoalProgress } from '@/features/issues/model/goals-progress';
import type { Issue } from '@/features/issues/model/types';

function TrendIcon({ trend }: { trend: GoalProgress['trend'] }) {
  if (trend === 'up') {
    return (
      <TrendingUp
        className='h-3 w-3 text-emerald-500 shrink-0'
        aria-label='trending up'
      />
    );
  }
  if (trend === 'down') {
    return (
      <TrendingDown
        className='h-3 w-3 text-amber-500 shrink-0'
        aria-label='trending down'
      />
    );
  }
  return (
    <Minus
      className='h-3 w-3 text-[var(--muted-foreground)] shrink-0'
      aria-label='stable'
    />
  );
}

/**
 * EpicGoalCardClient — streamed body of an epic card: progress stat + bar and
 * the linked task list with an inline Unlink action per row.
 * @param props - Component props.
 * @param props.tasks - linked (non-epic) tasks.
 * @param props.progress - computed goal progress.
 * @param props.barColor - Tailwind bg class for the progress bar.
 * @returns JSX element.
 */
export function EpicGoalCardClient({
  tasks,
  progress,
  barColor,
}: {
  tasks: Issue[];
  progress: GoalProgress;
  barColor: string;
}) {
  const router = useRouter();
  // Card-level guard — disables all detach buttons while one is in flight
  const [isDetaching, setIsDetaching] = useState(false);

  async function handleDetach(taskId: number) {
    if (isDetaching) return;
    setIsDetaching(true);
    try {
      const result = await detachTaskFromEpic(taskId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Removed from goal');
        router.refresh();
      }
    } finally {
      setIsDetaching(false);
    }
  }

  return (
    <>
      <div className='px-4 pb-3'>
        <div className='mb-1 flex items-center justify-between gap-2'>
          <span className='text-xs text-[var(--muted-foreground)]'>
            {formatTaskBreakdown(progress)}
          </span>
          <span className='flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]'>
            {progress.isEmpty ? (
              '—'
            ) : (
              <>
                {progress.done.toString()}
                <span className='font-normal text-[var(--muted-foreground)]'>
                  /{progress.total.toString()}
                </span>
                <span className='ml-1 text-xs font-medium'>
                  · {progress.percent.toString()}%
                </span>
              </>
            )}
            {!progress.isEmpty && <TrendIcon trend={progress.trend} />}
          </span>
        </div>
        <div
          className='h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]'
          role='progressbar'
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
            style={{ width: `${progress.percent.toString()}%` }}
          />
        </div>
      </div>

      {tasks.length > 0 && (
        <div className='border-t border-[var(--border)] px-2 pb-2 pt-1'>
          {tasks.map((task) => {
            return (
              <GoalTaskRow
                key={task.id}
                task={task}
                trailing={
                  <button
                    type='button'
                    aria-label='Remove from goal'
                    onClick={() => {
                      return handleDetach(task.id);
                    }}
                    disabled={isDetaching}
                    className={[
                      'rounded p-1.5 transition-all',
                      'opacity-0 group-hover/taskrow:opacity-100',
                      'text-[var(--muted-foreground)] hover:bg-amber-500/10 hover:text-amber-500',
                      'disabled:pointer-events-none disabled:opacity-30',
                    ].join(' ')}
                  >
                    <Unlink className='h-3 w-3' />
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
