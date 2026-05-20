import { PageContainer } from '@/shared/ui/layout/page-container';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

export default function Loading() {
  return (
    <PageContainer>
      <SkeletonList rows={5} />
    </PageContainer>
  );
}
