import { Suspense } from 'react';

import {
  getEpics,
  getPersons,
  IssuesLayoutClient,
  IssuesTabsNav,
  IssuesTabsNavSkeleton,
} from '@/features/issues';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

import type { PropsWithChildren } from 'react';

export default async function IssuesTabsLayout({
  children,
}: PropsWithChildren) {
  const cookieOrgId = await getOrganizationId();
  const [persons, epics, currentUserId] = await Promise.all([
    getPersons(cookieOrgId),
    getEpics(cookieOrgId),
    getCurrentUserId(),
  ]);

  return (
    <div className='flex flex-col p-2'>
      <div className='shrink-0 mb-4'>
        <IssuesTabsNav />
      </div>
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
