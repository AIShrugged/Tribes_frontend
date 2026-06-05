import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading fallback for organization sub-pages. Renders inside the layout card
 * shell (CardBody), so it must not wrap itself in another Card.
 * @returns JSX element.
 */
export default function Loading() {
  return (
    <div aria-busy='true' aria-label='Loading content'>
      <SkeletonList rows={4} />
    </div>
  );
}
