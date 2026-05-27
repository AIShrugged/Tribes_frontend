import { Suspense } from 'react';

import {
  getEpics,
  getPersons,
  IssuesLayoutClient,
  IssuesTabsNav,
  IssuesTabsNavSkeleton,
} from '@/features/issues';
import { getOrganizations } from '@/features/organization';
import { TaskDataUploadButton } from '@/features/task-data-upload';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

import type { PropsWithChildren } from 'react';

export default async function IssuesTabsLayout({
  children,
}: PropsWithChildren) {
  const [organizationsResponse, persons, epics, currentUserId, cookieOrgId] =
    await Promise.all([
      getOrganizations(),
      getPersons(),
      getEpics(),
      getCurrentUserId(),
      getOrganizationId(),
    ]);

  return (
    <div className='flex flex-col h-full overflow-hidden p-2'>
      <div className='shrink-0 mb-4 flex items-center justify-between gap-3'>
        <IssuesTabsNav />
        <TaskDataUploadButton organizationId={String(cookieOrgId)} />
      </div>
      <div className='flex-1 overflow-y-auto'>
        <Card className='overflow-hidden'>
          <Suspense fallback={<IssuesTabsNavSkeleton />}>
            <IssuesLayoutClient
              organizations={organizationsResponse.data ?? []}
              persons={persons}
              epics={epics}
              currentUserId={currentUserId ?? null}
              cookieOrgId={String(cookieOrgId)}
            >
              {children}
            </IssuesLayoutClient>
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
