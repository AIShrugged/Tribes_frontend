'use client';

import { format } from 'date-fns';
import Link from 'next/link';

import {
  IssueCodeBadge,
  IssueStatusBadge,
  issueHrefSegment,
} from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { Issue } from '@/features/issues/model/types';

interface ArchivedSectionProps {
  items: Issue[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

/**
 * ArchivedSection renders the list of archived issues below the normal list,
 * with a "Load more" button for pagination (no infinite scroll to avoid sentinel collision).
 */
export function ArchivedSection({
  items,
  loading,
  hasMore,
  onLoadMore,
}: ArchivedSectionProps) {
  if (loading && items.length === 0) {
    return (
      <div className='flex justify-center py-6'>
        <SpinLoader />
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-[var(--radius-card)] border border-dashed border-border/60 bg-card/30'>
      <div className='px-4 py-2 bg-accent/20 border-b border-border/40'>
        <span className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
          Archived · done 14+ days ago
        </span>
      </div>

      {items.length === 0 && !loading ? (
        <div className='px-4 py-6 text-center text-xs text-muted-foreground'>
          No archived issues found.
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[680px] table-fixed text-sm'>
            <colgroup>
              <col className='w-[80px]' />
              <col />
              <col className='w-[110px]' />
              <col className='w-[180px]' />
              <col className='w-[150px]' />
              <col className='w-[150px]' />
            </colgroup>
            <tbody>
              {items.map((issue) => {
                return (
                  <tr
                    key={issue.id}
                    className='border-t border-border/40 hover:bg-accent/10 opacity-75'
                  >
                    <td className='px-4 py-2.5 align-top whitespace-nowrap'>
                      <IssueCodeBadge code={issue.code} id={issue.id} />
                    </td>
                    <td className='max-w-0 overflow-hidden px-4 py-2.5 align-top'>
                      <Link
                        href={`${ROUTES.DASHBOARD.ISSUES}/${issueHrefSegment(issue)}`}
                        className='block truncate font-medium text-muted-foreground hover:text-primary text-sm'
                      >
                        {issue.name}
                      </Link>
                    </td>
                    <td className='max-w-0 truncate px-4 py-2.5 align-top text-xs text-muted-foreground'>
                      {issue.type}
                    </td>
                    <td className='px-4 py-2.5 align-top'>
                      <IssueStatusBadge
                        status={issue.status}
                        className='w-fit'
                      />
                    </td>
                    <td className='px-4 py-2.5 align-top text-xs text-muted-foreground'>
                      {issue.assignee?.name ?? '—'}
                    </td>
                    <td className='px-4 py-2.5 align-top text-xs text-muted-foreground'>
                      {issue.close_date
                        ? format(new Date(issue.close_date), 'dd.MM.yyyy')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(hasMore || loading) && (
        <div className='flex justify-center py-3 border-t border-border/40'>
          {loading ? (
            <SpinLoader />
          ) : (
            <Button
              type='button'
              variant='ghost'
              size='xs'
              fullWidth={false}
              onClick={onLoadMore}
            >
              Load more archived
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
