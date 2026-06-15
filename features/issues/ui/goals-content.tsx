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
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import type { GoalsFilter } from '@/features/issues/model/goals-summary';

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

  return (
    <GoalsFilterableList
      summary={<GoalsSummaryStrip summary={summary} />}
      counts={counts}
      items={items}
    />
  );
}

/**
 * GoalsContent — organization-scoped goals view: a summary strip, filter chips +
 * search, and open epics with their linked tasks. Rendered by the Organization
 * Goals tab (the legacy /today/goals route redirects here).
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
