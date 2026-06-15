import { Skeleton } from '@/shared/ui/layout/skeleton';

import { EpicGoalCardSkeleton } from './epic-goal-card';

/**
 * GoalsHeaderSkeleton — placeholder for the summary strip + filter bar + a
 * couple of epic cards. Used by both loading.tsx (route nav) and GoalsContent's
 * inner Suspense fallback so the chrome doesn't pop in late during streaming.
 * @returns JSX element.
 */
export function GoalsHeaderSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-[88px] w-full rounded-[var(--r-lg)]' />
      <div className='flex gap-2'>
        <Skeleton className='h-7 w-16 rounded-full' />
        <Skeleton className='h-7 w-20 rounded-full' />
        <Skeleton className='h-7 w-24 rounded-full' />
      </div>
      <div className='space-y-4'>
        {[1, 2].map((i) => {
          return <EpicGoalCardSkeleton key={i} />;
        })}
      </div>
    </div>
  );
}
