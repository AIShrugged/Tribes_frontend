import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the suggestions inbox tab.
 */
export default function Loading() {
  return <SkeletonList rows={4} />;
}
