import { PageContainer } from '@/shared/ui/layout/page-container';
import { Skeleton } from '@/shared/ui/layout/skeleton';

function ColumnSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-3'>
      <div className='border-b border-border pb-3'>
        <Skeleton className='h-4 w-20' />
      </div>
      <div className='flex flex-col gap-3'>
        {Array.from({ length: 3 }).map((_, i) => {
          return (
            <Skeleton
              key={i}
              className='h-28 w-full rounded-[var(--radius-card)]'
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Loading state for Meetings list tab — date switcher + 3-column skeleton.
 */
export default function Loading() {
  return (
    <PageContainer>
      <div className='px-6 py-6'>
        {/* DateSwitcher skeleton */}
        <div className='mb-5 flex items-center justify-between gap-4'>
          <Skeleton className='h-8 w-8 rounded-md' />
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-8 w-8 rounded-md' />
        </div>

        <div className='hidden gap-6 md:grid md:grid-cols-3'>
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
        <div className='flex flex-col gap-8 md:hidden'>
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
