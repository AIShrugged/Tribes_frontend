import { Target } from 'lucide-react';
import { Suspense } from 'react';

import { getEpics } from '@/features/issues/api/issues';
import {
  EpicGoalCard,
  EpicGoalCardSkeleton,
} from '@/features/issues/ui/epic-goal-card';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Skeleton } from '@/shared/ui/layout/skeleton';

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

async function EpicsList({ orgId }: { orgId: number }) {
  const epics = await getEpics(orgId);

  if (epics.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title='No open goals yet'
        description='Create an epic to start tracking team goals.'
      />
    );
  }

  return (
    <div className='space-y-4'>
      {epics.map((epic) => {
        return (
          <Suspense key={epic.id} fallback={<EpicGoalCardSkeleton />}>
            <EpicGoalCard epic={epic} />
          </Suspense>
        );
      })}

      <Suspense fallback={<UnlinkedTasksSkeleton />}>
        <UnlinkedTasksSection orgId={orgId} epics={epics} />
      </Suspense>
    </div>
  );
}

/**
 * GoalsContent — organization-scoped goals view: open epics with their linked
 * tasks plus a section for unlinked tasks. Streams the epics list via Suspense.
 * Shared by the Today goals redirect target and the Organization Goals tab.
 * @param props - Component props.
 * @param props.orgId - Organization to scope epics/tasks to.
 */
export function GoalsContent({ orgId }: { orgId: number }) {
  return (
    <Suspense fallback={<EpicGoalCardSkeleton />}>
      <EpicsList orgId={orgId} />
    </Suspense>
  );
}
