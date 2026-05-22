import { Target } from 'lucide-react';
import { Suspense } from 'react';

import { getEpics } from '@/features/issues/api/issues';
import {
  EpicGoalCard,
  EpicGoalCardSkeleton,
} from '@/features/issues/ui/epic-goal-card';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Skeleton } from '@/shared/ui/layout/skeleton';

export const metadata = { title: 'Goals' };

function UnlinkedTasksSkeleton() {
  return (
    <div className='rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-1)]/50 p-4 space-y-2'>
      <Skeleton className='h-4 w-40' />
      {[1, 2, 3].map((i) => {
        return <Skeleton key={i} className='h-8 w-full' />;
      })}
    </div>
  );
}

export default async function GoalsPage() {
  const cookieOrgId = await getOrganizationId();
  const orgId = Number(cookieOrgId);

  const epics = await getEpics(
    Number.isFinite(orgId) && orgId > 0 ? orgId : null,
  );

  if (epics.length === 0) {
    return (
      <div className='p-6'>
        <EmptyState
          icon={Target}
          title='No open goals yet'
          description='Create an epic to start tracking team goals.'
        />
      </div>
    );
  }

  return (
    <div className='space-y-4 p-6'>
      {epics.map((epic) => {
        return (
          <Suspense key={epic.id} fallback={<EpicGoalCardSkeleton />}>
            <EpicGoalCard epic={epic} />
          </Suspense>
        );
      })}

      <Suspense fallback={<UnlinkedTasksSkeleton />}>
        <UnlinkedTasksSection
          orgId={Number.isFinite(orgId) && orgId > 0 ? orgId : 0}
          epics={epics}
        />
      </Suspense>
    </div>
  );
}
