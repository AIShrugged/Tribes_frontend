import { ChangelogListClient } from '@/features/commit-reports';
import { getCommitReports } from '@/features/commit-reports/api/commit-reports';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Changelog' };

/**
 * Commit-analysis log (daily git changelog) as a Dashboard sub-tab.
 * The list is org-scoped; each row opens a report detail with matched tasks +
 * architect review.
 */
export default async function TodayChangelogPage() {
  const orgId = await getOrganizationId();
  const initial = await getCommitReports(orgId, { offset: 0, limit: 50 });

  return (
    <ChangelogListClient
      orgId={orgId}
      initialItems={initial.data}
      initialTotalCount={initial.totalCount}
      initialHasMore={initial.hasMore}
    />
  );
}
