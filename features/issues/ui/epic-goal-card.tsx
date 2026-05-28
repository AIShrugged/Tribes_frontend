import { UserCircle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { getIssues } from '@/features/issues/api/issues';
import {
  computeProgress,
  getProgressColor,
} from '@/features/issues/model/goals-progress';
import { ROUTES } from '@/shared/lib/routes';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import { EpicGoalCardClient } from './epic-goal-card-client';

import type { Issue } from '@/features/issues/model/types';

async function EpicTasksList({ epicId }: { epicId: number }) {
  const result = await getIssues({ epic_id: epicId, limit: 100, offset: 0 });
  const tasks = result.data.filter((t) => {
    return t.type !== 'epic';
  });
  const progress = computeProgress(tasks);
  const barColor = getProgressColor(progress);

  return (
    <EpicGoalCardClient tasks={tasks} progress={progress} barColor={barColor} />
  );
}

function EpicTasksListSkeleton() {
  return (
    <div className='px-4 pb-4 space-y-2'>
      <div className='flex items-center justify-between mb-2'>
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-3 w-8' />
      </div>
      <Skeleton className='h-1.5 w-full' />
      <div className='mt-3 space-y-2'>
        {[1, 2, 3].map((i) => {
          return <Skeleton key={i} className='h-8 w-full' />;
        })}
      </div>
    </div>
  );
}

/**
 * EpicGoalCard — async Server Component.
 * Renders one epic as a goal card with progress bar and task list.
 * Wrapped in Suspense by the parent page for streaming.
 */
export async function EpicGoalCard({ epic }: { epic: Issue }) {
  const epicDetailHref = `${ROUTES.DASHBOARD.ISSUES}/${epic.id.toString()}`;
  const kanbanHref = `${ROUTES.DASHBOARD.ISSUES_KANBAN}?epic_id=${epic.id.toString()}`;

  return (
    <div className='group/epic rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden'>
      <div className='flex items-start justify-between gap-4 px-4 py-3'>
        <div className='flex-1 min-w-0'>
          <Link
            href={epicDetailHref}
            className='text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline transition-colors line-clamp-2'
          >
            {epic.name}
          </Link>
          {epic.description && (
            <p className='mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-1'>
              {epic.description}
            </p>
          )}
          {epic.assignee != null && (
            <p className='mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]/70'>
              <UserCircle className='h-3 w-3 shrink-0' aria-hidden='true' />
              <span className='truncate'>{epic.assignee.name}</span>
            </p>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Link
            href={kanbanHref}
            className='rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors'
          >
            Kanban
          </Link>
        </div>
      </div>

      <Suspense fallback={<EpicTasksListSkeleton />}>
        <EpicTasksList epicId={epic.id} />
      </Suspense>
    </div>
  );
}

export function EpicGoalCardSkeleton() {
  return (
    <div className='rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden'>
      <div className='flex items-start justify-between gap-4 px-4 py-3'>
        <div className='flex-1 space-y-1'>
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-3 w-1/2' />
        </div>
      </div>
      <EpicTasksListSkeleton />
    </div>
  );
}
