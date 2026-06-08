'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { IssueStatusBadge as TaskStatusBadge } from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';
import { MarkdownContent } from '@/shared/ui/markdown-content';

import type { MeetingTask } from '../model/types';

interface AgendaListProps {
  tasks: MeetingTask[];
  totalCount: number;
  doneCount: number;
  meetingState: string;
  label?: string;
  emptyText?: string;
}

export function AgendaList({
  tasks,
  totalCount,
  meetingState,
  label: labelOverride,
  emptyText: emptyTextOverride,
}: AgendaListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const isReady = meetingState === 'ready';
  const label =
    labelOverride ??
    (isReady ? 'Action items from this meeting' : 'Tasks from last sync');
  const emptyText =
    emptyTextOverride ??
    (isReady ? 'No tasks from this meeting' : 'No tasks from previous meeting');

  if (totalCount === 0) {
    return <p className='text-xs text-muted-foreground italic'>{emptyText}</p>;
  }
  return (
    <CollapsibleSection label={label} extraContent={null}>
      <div className='flex flex-col gap-1'>
        {tasks.map((task, i) => {
          const isExpanded = expandedId === task.id;
          return (
            <button
              key={task.id}
              type='button'
              onClick={() => {
                return setExpandedId(isExpanded ? null : task.id);
              }}
              className='flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50 transition-colors w-full'
            >
              <span className='text-xs text-muted-foreground mt-0.5 w-4 shrink-0'>
                {i + 1}.
              </span>
              <div className='min-w-0 flex-1'>
                <div className='flex items-start gap-2'>
                  <span className='text-sm text-foreground flex-1'>
                    <Link
                      href={`${ROUTES.DASHBOARD.ISSUES}/${task.id}`}
                      onClick={(e) => {
                        return e.stopPropagation();
                      }}
                      className='hover:text-primary hover:underline transition-colors'
                    >
                      {task.name}
                    </Link>
                    {task.assignee_name && (
                      <span className='text-muted-foreground'>
                        {' '}
                        — {task.assignee_name}
                      </span>
                    )}
                  </span>
                  {task.is_epic && (
                    <span className='shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-violet-500/15 text-violet-400 leading-none'>
                      Epic
                    </span>
                  )}
                  <TaskStatusBadge
                    status={task.status}
                    isOverdue={task.is_overdue}
                    className='shrink-0 text-[10px]'
                  />
                </div>
                {isExpanded && task.description && (
                  <div className='mt-1.5'>
                    <MarkdownContent>{task.description}</MarkdownContent>
                  </div>
                )}
              </div>
              {task.description && (
                <span className='mt-0.5 shrink-0 text-muted-foreground'>
                  {isExpanded ? (
                    <ChevronDown className='h-3.5 w-3.5' />
                  ) : (
                    <ChevronRight className='h-3.5 w-3.5' />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
