import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the reasoning log tab.
 */
export default function Loading() {
  return <SkeletonList rows={6} />;
}
