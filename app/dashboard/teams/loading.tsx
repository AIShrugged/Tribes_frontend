import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the teams single-page view.
 */
export default function Loading() {
  return (
    <Card
      className='h-full flex flex-col'
      aria-busy='true'
      aria-label='Loading team details'
    >
      {/* Page header */}
      <div className='px-4 py-3 border-b border-border'>
        <Skeleton className='h-6 w-24' />
      </div>

      {/* Team selector header */}
      <div className='flex items-center gap-3 px-4 py-2 border-b border-border'>
        <Skeleton className='h-10 w-56' />
        <Skeleton className='h-8 w-24 ml-auto' />
      </div>

      {/* KPIs row */}
      <div className='px-6 py-4 border-b border-border'>
        <div className='flex gap-4'>
          <Skeleton className='h-20 flex-1' />
          <Skeleton className='h-20 flex-1' />
          <Skeleton className='h-20 flex-1' />
        </div>
      </div>

      {/* Tab strip */}
      <div className='flex gap-1 px-6 py-2 border-b border-border'>
        {Array.from({ length: 5 }).map((_, i) => {
          return <Skeleton key={i} className='h-8 w-20' />;
        })}
      </div>

      {/* Tab content */}
      <div className='flex-1 px-6 py-4 flex flex-col gap-3'>
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    </Card>
  );
}
