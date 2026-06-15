import { Target } from 'lucide-react';
import { Suspense } from 'react';

import { getEpics } from '@/features/issues/api/issues';
import {
  epicFilterCounts,
  filterEpics,
  summarizeEpics,
} from '@/features/issues/model/goals-summary';
import {
  EpicGoalCard,
  EpicGoalCardSkeleton,
} from '@/features/issues/ui/epic-goal-card';
import {
  GoalsFilterableList,
  type GoalsListItem,
} from '@/features/issues/ui/goals-filterable-list';
import { GoalsHeaderSkeleton } from '@/features/issues/ui/goals-header-skeleton';
import { GoalsSummaryStrip } from '@/features/issues/ui/goals-summary-strip';
import { UnlinkedTasksSection } from '@/features/issues/ui/unlinked-tasks-section';
import { EmptyState } from '@/shared/ui/feedback/empty-state';
import { Skeleton } from '@/shared/ui/layout/skeleton';

import type { GoalsFilter } from '@/features/issues/model/goals-summary';

function UnlinkedTasksSkeleton() {
  return (
    <div className='space-y-2 rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-4'>
      <Skeleton className='h-4 w-40' />
      {[1, 2, 3].map((i) => {
        return <Skeleton key={i} className='h-8 w-full' />;
      })}
    </div>
  );
}

async function EpicsList({
  orgId,
  filter,
  currentUserId,
}: {
  orgId: number;
  filter: GoalsFilter;
  currentUserId: number | null;
}) {
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

  const summary = summarizeEpics(epics);
  const counts = epicFilterCounts(epics, currentUserId);
  const filtered = filterEpics(epics, { filter, currentUserId });

  const items: GoalsListItem[] = filtered.map((epic) => {
    return {
      id: epic.id,
      name: epic.name,
      node: (
        <Suspense fallback={<EpicGoalCardSkeleton />}>
          <EpicGoalCard epic={epic} />
        </Suspense>
      ),
    };
  });

  // Unlinked tasks are not part of a "my/overdue goals" view; only show them in
  // the unfiltered list. Pass the UNFILTERED epics so link targets stay complete.
  const unlinked =
    filter === 'all' ? (
      <Suspense fallback={<UnlinkedTasksSkeleton />}>
        <UnlinkedTasksSection orgId={orgId} epics={epics} />
      </Suspense>
    ) : null;

  return (
    <GoalsFilterableList
      summary={<GoalsSummaryStrip summary={summary} />}
      counts={counts}
      items={items}
      unlinked={unlinked}
    />
  );
}

/**
 * GoalsContent — organization-scoped goals view: a summary strip, filter chips +
 * search, open epics with their linked tasks, and a section for unlinked tasks.
 * Rendered by the Organization Goals tab (the legacy /today/goals route
 * redirects here).
 * @param props - Component props.
 * @param props.orgId - organization to scope epics/tasks to.
 * @param props.filter - active chip filter from the URL.
 * @param props.currentUserId - current user id, for the "Mine" filter.
 * @returns JSX element.
 */
export function GoalsContent({
  orgId,
  filter,
  currentUserId,
}: {
  orgId: number;
  filter: GoalsFilter;
  currentUserId: number | null;
}) {
  return (
    <Suspense fallback={<GoalsHeaderSkeleton />}>
      <EpicsList orgId={orgId} filter={filter} currentUserId={currentUserId} />
    </Suspense>
  );
}
