'use client';

import { Unlink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { detachTaskFromEpic } from '@/features/issues/api/issues';
import { formatTaskBreakdown } from '@/features/issues/model/goals-progress';

import { GoalTaskRow } from './goal-task-row';

import type { GoalProgress } from '@/features/issues/model/goals-progress';
import type { Issue } from '@/features/issues/model/types';

/**
 * EpicGoalCardClient — collapsible body of an epic card: the linked-tasks header
 * and the task rows, each with an inline Unlink action. Progress/stat live in
 * the always-visible card header (see EpicGoalCard); this renders nothing when
 * the epic has no tasks.
 * @param props - Component props.
 * @param props.tasks - linked (non-epic) tasks.
 * @param props.progress - computed goal progress (for the header breakdown).
 * @returns JSX element or null.
 */
export function EpicGoalCardClient({
  tasks,
  progress,
}: {
  tasks: Issue[];
  progress: GoalProgress;
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

  if (tasks.length === 0) return null;

  return (
    <div className='border-t border-[var(--border)] bg-[var(--surface-2)]/30'>
      <div className='px-5 pb-1 pt-2.5 text-[11.5px] uppercase tracking-[0.05em] text-[var(--muted-foreground)]'>
        Tasks · {progress.total.toString()} ({formatTaskBreakdown(progress)})
      </div>
      <div className='px-3 pb-3.5 pt-1'>
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
    </div>
  );
}
