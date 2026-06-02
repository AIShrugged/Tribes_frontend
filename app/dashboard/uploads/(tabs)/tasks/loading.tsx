import { SkeletonList } from '@/shared/ui/layout/skeleton';

export default function Loading() {
  return (
    <div className='mx-auto max-w-2xl p-4'>
      <SkeletonList rows={4} />
    </div>
  );
}
