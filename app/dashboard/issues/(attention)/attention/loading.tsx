import { Skeleton } from '@/shared/ui/layout/skeleton';

export default function IssuesAttentionLoading() {
  return (
    <div className='flex flex-col gap-2 px-2 pt-2'>
      {Array.from({ length: 3 }).map((_, i) => {
        return (
          <div
            key={i}
            className='rounded-[var(--radius-card)] border border-orange-500/25 bg-orange-950/10 px-4 py-3'
          >
            <div className='flex items-center gap-2.5'>
              <Skeleton className='h-4 w-4 rounded-full' />
              <Skeleton className='h-4 w-32' />
              <Skeleton className='ml-auto h-5 w-24 rounded-full' />
            </div>
          </div>
        );
      })}
    </div>
  );
}
