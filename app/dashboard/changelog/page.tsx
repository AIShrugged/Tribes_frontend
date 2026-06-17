import { ChangelogListClient } from '@/features/commit-reports';
import { getCommitReports } from '@/features/commit-reports/api/commit-reports';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

export default async function ChangelogPage() {
  const orgId = await getOrganizationId();
  const initial = await getCommitReports(orgId, { offset: 0, limit: 50 });

  return (
    <Card className='flex h-full flex-col overflow-hidden'>
      <div className='flex-1 overflow-y-auto'>
        <ChangelogListClient
          orgId={orgId}
          initialItems={initial.data}
          initialTotalCount={initial.totalCount}
          initialHasMore={initial.hasMore}
        />
      </div>
    </Card>
  );
}
