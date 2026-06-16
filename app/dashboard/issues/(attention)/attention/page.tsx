import { Suspense } from 'react';

import {
  getIssues,
  getIssueStats,
  AttentionTableClient,
  IssueHealthSection,
} from '@/features/issues';
import { getTeams } from '@/features/teams';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const metadata = { title: 'Attention' };

export default async function IssuesAttentionPage() {
  const cookieOrgId = await getOrganizationId();
  const currentUserId = await getCurrentUserId();

  const [issues, stats, teamsResult] = await Promise.all([
    getIssues({
      organization_id: cookieOrgId,
      assignee: currentUserId ?? null,
      sort: 'updated_at',
      order: 'desc',
      offset: 0,
      limit: 20,
    }),
    getIssueStats(),
    getTeams(cookieOrgId),
  ]);

  return (
    <div className='flex flex-col gap-4 px-2 pt-2 pb-6'>
      <Suspense>
        <IssueHealthSection
          teams={teamsResult.data}
          statsOverdue={stats.overdue}
        />
      </Suspense>

      <AttentionTableClient
        initialIssues={issues.data}
        initialTotalCount={issues.totalCount}
        overdue={stats.overdue}
        currentUserId={currentUserId}
        cookieOrgId={cookieOrgId}
      />
    </div>
  );
}
