import { Suspense } from 'react';

import {
  getEpics,
  getPersons,
  IssueHealthSection,
  IssuesLayoutClient,
  IssuesTabsNav,
  IssuesTabsNavSkeleton,
} from '@/features/issues';
import { getTeams } from '@/features/teams';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

import type { PropsWithChildren } from 'react';

export default async function IssuesTabsLayout({
  children,
}: PropsWithChildren) {
  const cookieOrgId = await getOrganizationId();
  const [persons, epics, currentUserId, teamsResult] = await Promise.all([
    getPersons(cookieOrgId),
    getEpics(cookieOrgId),
    getCurrentUserId(),
    getTeams(cookieOrgId),
  ]);

  return (
    <div className='flex flex-col p-2'>
      <div className='shrink-0 mb-4'>
        <IssuesTabsNav />
      </div>
      <Suspense fallback={null}>
        <IssueHealthSection teams={teamsResult.data} />
      </Suspense>
      <Suspense fallback={<IssuesTabsNavSkeleton />}>
        <IssuesLayoutClient
          persons={persons}
          epics={epics}
          currentUserId={currentUserId ?? null}
          cookieOrgId={String(cookieOrgId)}
        >
          {children}
        </IssuesLayoutClient>
      </Suspense>
    </div>
  );
}
