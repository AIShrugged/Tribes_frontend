import { Skeleton } from '@/shared/ui/layout/skeleton';

export default function Loading() {
  return (
    <div className='flex flex-col gap-4 p-4'>
      <Skeleton className='h-8 w-48' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
    </div>
  );
}
