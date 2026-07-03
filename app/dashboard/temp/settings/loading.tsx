import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the second-brain management tab.
 */
export default function Loading() {
  return <SkeletonList rows={3} />;
}
