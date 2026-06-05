import { Skeleton } from '@/shared/ui/layout/skeleton';

export default function OrganizationDescriptionLoading() {
  return (
    <div className='max-w-3xl space-y-3'>
      <Skeleton className='h-4 w-full' />
      <Skeleton className='h-4 w-11/12' />
      <Skeleton className='h-4 w-10/12' />
      <Skeleton className='h-4 w-9/12' />
    </div>
  );
}
