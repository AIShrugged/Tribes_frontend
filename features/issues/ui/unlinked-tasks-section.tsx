import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { IssueStatusBadge } from '@/entities/issue';
import { getIssues } from '@/features/issues/api/issues';
import { LinkToEpicButton } from '@/features/issues/ui/link-to-epic-button';
import { ROUTES } from '@/shared/lib/routes';

import type { Issue } from '@/features/issues/model/types';

/**
 * UnlinkedTasksSection — async Server Component.
 * Fetches tasks without epic_id and shows them in a dashed-border block.
 * Because backend has no epic_id=null filter, fetches up to 100 tasks and
 * filters client-side. Shows a warning when more tasks may exist.
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
    <div className='rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-1)]/50 overflow-hidden'>
      <div className='px-4 py-3 flex items-center justify-between'>
        <p className='text-sm font-medium text-[var(--muted-foreground)]'>
          Tasks without a goal
          <span className='ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-3)] px-1.5 text-[10px] font-semibold text-[var(--foreground)]'>
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

      <ul className='divide-y divide-[var(--border)]/50'>
        {unlinked.map((task) => {
          return (
            <li
              key={task.id}
              className='flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--surface-2)] transition-colors'
            >
              <Link
                href={`${ROUTES.DASHBOARD.ISSUES}/${task.id.toString()}`}
                className='flex-1 truncate text-xs text-[var(--foreground)] hover:underline'
              >
                #{task.id} {task.name}
              </Link>
              <div className='flex shrink-0 items-center gap-2'>
                <IssueStatusBadge status={task.status} />
                <LinkToEpicButton taskId={task.id} epics={epics} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
