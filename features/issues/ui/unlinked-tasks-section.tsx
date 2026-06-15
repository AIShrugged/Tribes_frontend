import { AlertCircle } from 'lucide-react';

import { getIssues } from '@/features/issues/api/issues';
import { LinkToEpicButton } from '@/features/issues/ui/link-to-epic-button';

import { GoalTaskRow } from './goal-task-row';

import type { Issue } from '@/features/issues/model/types';

/**
 * UnlinkedTasksSection — async Server Component. Fetches tasks without an epic
 * and shows them in a dashed-border block. Because the backend has no
 * epic_id=null filter, it fetches up to 100 tasks and filters client-side,
 * showing an honest caveat when more may exist.
 * @param props - Component props.
 * @param props.orgId - organization scope.
 * @param props.epics - UNFILTERED epics list, used as link targets.
 * @returns JSX element or null when there are no unlinked tasks.
 */
export async function UnlinkedTasksSection({
  orgId,
  epics,
}: {
  orgId: number;
  epics: Issue[];
}) {
  const result = await getIssues({
    organization_id: orgId,
    exclude_archived: true,
    limit: 100,
    offset: 0,
  });

  const unlinked = result.data.filter((t) => {
    return t.type !== 'epic' && t.epic_id === null;
  });

  if (unlinked.length === 0) return null;

  return (
    <div className='overflow-hidden rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)]/50'>
      <div className='flex items-center justify-between px-4 py-3'>
        <p className='flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)]'>
          <span
            aria-hidden='true'
            className='h-1.5 w-1.5 rounded-full bg-amber-500'
          />
          Tasks without a goal
          <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-3)] px-1.5 text-[10px] font-semibold text-[var(--foreground)]'>
            {unlinked.length}
          </span>
        </p>
        {result.hasMore && (
          <span className='flex items-center gap-1 text-[10px] text-amber-500'>
            <AlertCircle className='h-3 w-3' />
            Showing first 100 — some may not appear
          </span>
        )}
      </div>

      <div className='px-2 pb-2'>
        {unlinked.map((task) => {
          return (
            <GoalTaskRow
              key={task.id}
              task={task}
              trailing={<LinkToEpicButton taskId={task.id} epics={epics} />}
            />
          );
        })}
      </div>
    </div>
  );
}
