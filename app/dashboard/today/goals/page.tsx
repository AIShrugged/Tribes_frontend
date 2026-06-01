import { Target } from 'lucide-react';
import { Suspense } from 'react';

import { getEpics } from '@/features/issues/api/issues';
import {
  EpicGoalCard,
  EpicGoalCardSkeleton,
} from '@/features/issues/ui/epic-goal-card';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { InsightProfileSection } from '@/features/today-briefing/ui/insight-profile-section';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Skeleton } from '@/shared/ui/layout/skeleton';

export const dynamic = 'force-dynamic';
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

function InsightSkeleton() {
  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2 mb-3'>
        <Skeleton className='h-4 w-4 rounded-full' />
        <Skeleton className='h-4 w-32' />
      </div>
      {[1, 2, 3].map((i) => {
        return (
          <div
            key={i}
            className='rounded-[var(--radius-card)] border border-border bg-card p-4'
          >
            <Skeleton className='h-3.5 w-36 mb-3' />
            <div className='flex flex-wrap gap-2'>
              <Skeleton className='h-5 w-24 rounded-full' />
              <Skeleton className='h-5 w-32 rounded-full' />
              <Skeleton className='h-5 w-20 rounded-full' />
            </div>
          </div>
        );
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

export default async function GoalsPage() {
  // Cookie read only — no network, resolves immediately
  const orgId = await getOrganizationId();

  return (
    <div className='space-y-6 p-6'>
      {/* Goals section — streams independently */}
      <Suspense fallback={<EpicGoalCardSkeleton />}>
        <EpicsList orgId={orgId} />
      </Suspense>

      <hr className='border-border' />

      {/* Personal AI Insight — streams independently, in parallel with goals */}
      <Suspense fallback={<InsightSkeleton />}>
        <InsightProfileSection />
      </Suspense>
    </div>
  );
}
