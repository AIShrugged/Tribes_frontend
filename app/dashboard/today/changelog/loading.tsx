import { SkeletonList } from '@/shared/ui/layout/skeleton';

export default function Loading() {
  return (
    <div className='px-4 py-4'>
      <SkeletonList rows={8} />
    </div>
  );
}
