import { SkeletonList } from '@/shared/ui/layout/skeleton';

export default function Loading() {
  return (
    <div className='px-5 py-4'>
      <SkeletonList rows={6} />
    </div>
  );
}
