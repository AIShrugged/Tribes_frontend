'use client';

import { Minus, TrendingDown, TrendingUp, Unlink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { IssueStatusBadge } from '@/entities/issue';
import { detachTaskFromEpic } from '@/features/issues/api/issues';
import { ROUTES } from '@/shared/lib/routes';

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
      <div className='px-4 pb-2'>
        <div className='flex items-center justify-between mb-1'>
          <span className='text-xs text-[var(--muted-foreground)]'>
            {progress.isEmpty
              ? 'No tasks yet'
              : `${progress.done.toString()}/${progress.total.toString()} done`}
          </span>
          <span className='flex items-center gap-1 text-xs font-medium text-[var(--foreground)]'>
            {progress.isEmpty ? '—' : `${progress.percent.toString()}%`}
            {!progress.isEmpty && <TrendIcon trend={progress.trend} />}
          </span>
        </div>
        <div
          className='h-1.5 w-full rounded-full bg-[var(--surface-3)] overflow-hidden'
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
        {!progress.isEmpty && (
          <div className='mt-1 flex gap-3 text-[10px] text-[var(--muted-foreground)]'>
            {progress.active > 0 && (
              <span>{progress.active.toString()} active</span>
            )}
            {progress.open > 0 && <span>{progress.open.toString()} open</span>}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <ul className='border-t border-[var(--border)] divide-y divide-[var(--border)]/50'>
          {tasks.map((task) => {
            const href = `${ROUTES.DASHBOARD.ISSUES}/${task.id.toString()}`;
            return (
              <li
                key={task.id}
                className='group/taskrow flex items-center justify-between gap-2 rounded px-3 py-2 hover:bg-[var(--surface-2)] transition-colors'
              >
                <Link
                  href={href}
                  className='flex-1 truncate text-xs text-[var(--foreground)] hover:underline'
                >
                  #{task.id} {task.name}
                </Link>
                <div className='flex shrink-0 items-center gap-1'>
                  <IssueStatusBadge status={task.status} />
                  <button
                    type='button'
                    aria-label='Remove from goal'
                    onClick={() => {
                      return handleDetach(task.id);
                    }}
                    disabled={isDetaching}
                    className={[
                      'rounded p-0.5 transition-all',
                      'opacity-0 group-hover/taskrow:opacity-100',
                      'text-[var(--muted-foreground)] hover:text-amber-500 hover:bg-amber-500/10',
                      'disabled:opacity-30 disabled:pointer-events-none',
                    ].join(' ')}
                  >
                    <Unlink className='h-3 w-3' />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
