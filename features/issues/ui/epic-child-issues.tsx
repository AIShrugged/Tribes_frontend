import Link from 'next/link';

import { IssueStatusBadge } from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import { Card, CardBody } from '@/shared/ui/card';

import type { Issue } from '../model/types';

interface EpicChildIssuesProps {
  issues: Issue[];
}

export function EpicChildIssues({ issues }: EpicChildIssuesProps) {
  return (
    <Card>
      <CardBody>
        <div className='flex flex-col gap-4'>
          <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
            Child Tasks
          </p>

          {issues.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No child tasks linked to this epic.
            </p>
          ) : (
            <div className='flex flex-col gap-2'>
              {issues.map((child) => {
                return (
                  <Link
                    key={child.id}
                    href={`${ROUTES.DASHBOARD.ISSUES}/${child.id.toString()}`}
                    className='flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-background/30 px-4 py-3 hover:bg-background/50 transition-colors'
                  >
                    <span className='truncate text-sm font-medium text-foreground'>
                      #{child.id} {child.name}
                    </span>
                    <IssueStatusBadge status={child.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
