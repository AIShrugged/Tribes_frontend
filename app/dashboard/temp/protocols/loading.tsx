import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the protocol & agenda tab.
 */
export default function Loading() {
  return <SkeletonList rows={6} />;
}
