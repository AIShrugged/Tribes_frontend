import { PageContainer } from '@/shared/ui/layout/page-container';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

/**
 * Loading skeleton for the LLM prompts list page.
 * @returns JSX element.
 */
export default function Loading() {
  return (
    <PageContainer>
      <SkeletonList rows={8} />
    </PageContainer>
  );
}
