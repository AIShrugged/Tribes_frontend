import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the LLM prompt edit page.
 * @returns JSX element.
 */
export default function Loading() {
  return (
    <div className='mx-auto max-w-3xl px-4 py-6'>
      <SkeletonList rows={4} />
    </div>
  );
}
