import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the Temp section.
 */
export default function Loading() {
  return <SkeletonList rows={5} />;
}
