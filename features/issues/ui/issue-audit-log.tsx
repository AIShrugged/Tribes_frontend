'use client';

import { useState } from 'react';

import type { IssueAuditEvent } from '@/entities/issue';

const MAX_VISIBLE = 10;

const FIELD_LABELS: Record<string, string> = {
  name: 'Title',
  description: 'Description',
  status: 'Status',
  type: 'Type',
  assignee_id: 'Assignee',
  due_date: 'Due date',
  priority: 'Priority',
  epic_id: 'Epic',
  team_id: 'Team',
  organization_id: 'Organization',
};

interface Props {
  events: IssueAuditEvent[];
}

export function IssueAuditLog({ events }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (events.length === 0) return null;

  const visible = showAll ? events : events.slice(0, MAX_VISIBLE);

  return (
    <section className='flex flex-col gap-3'>
      <h3 className='text-sm font-semibold text-foreground'>Change history</h3>
      <ol className='flex flex-col gap-0'>
        {visible.map((event) => {
          const fieldLabel = FIELD_LABELS[event.field] ?? event.field;
          return (
            <li
              key={event.id}
              className='relative pl-6 pb-3 before:absolute before:left-[7px] before:top-5 before:bottom-0 before:w-px before:bg-border last:before:hidden'
            >
              <div className='absolute left-0 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-muted'>
                <span className='text-[8px] font-bold text-muted-foreground'>
                  {event.user.name[0].toUpperCase()}
                </span>
              </div>
              <div className='flex flex-col gap-0.5'>
                <span className='text-sm text-foreground'>
                  <strong className='font-medium'>{event.user.name}</strong>{' '}
                  changed{' '}
                  <span className='text-muted-foreground'>{fieldLabel}</span>
                  {event.old_value && (
                    <>
                      {' '}
                      from{' '}
                      <code className='rounded bg-muted px-1 text-xs text-muted-foreground'>
                        {event.old_value}
                      </code>
                    </>
                  )}
                  {event.new_value && (
                    <>
                      {' '}
                      to{' '}
                      <code className='rounded bg-muted px-1 text-xs text-foreground'>
                        {event.new_value}
                      </code>
                    </>
                  )}
                </span>
                <time className='text-xs text-muted-foreground'>
                  {new Date(event.created_at).toLocaleString('en-US')}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {events.length > MAX_VISIBLE && !showAll && (
        <button
          type='button'
          onClick={() => {
            setShowAll(true);
          }}
          className='self-start text-xs text-muted-foreground transition-colors hover:text-foreground'
        >
          Show {events.length - MAX_VISIBLE} more
        </button>
      )}
    </section>
  );
}
