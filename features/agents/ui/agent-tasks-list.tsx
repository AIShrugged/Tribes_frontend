'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { getAgentTasks } from '@/features/agents/api/agent-tasks';
import {
  formatBooleanLabel,
  formatDateTime,
  getLatestRunStatus,
  getOrganizationLabel,
  getTeamLabel,
} from '@/features/agents/lib/format';
import { useInfiniteScroll } from '@/shared/hooks';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';
import { DataTable } from '@/shared/ui/table';

import type { AgentTask } from '@/features/agents/model/types';
import type { TableColumn } from '@/shared/ui/table';

const PAGE_SIZE = 20;

function getTaskStatusVariant(enabled: boolean) {
  return enabled ? 'success' : 'warning';
}

const COLUMNS: TableColumn<AgentTask>[] = [
  {
    id: 'name',
    header: 'Name',
    renderCell: (task) => {
      return (
        <Link
          href={`${ROUTES.DASHBOARD.AGENT_TASKS}/${task.id}`}
          className='font-medium text-primary hover:underline'
        >
          {task.name}
        </Link>
      );
    },
  },
  {
    id: 'organization',
    header: 'Organization',
    renderCell: (task) => {
      return getOrganizationLabel(task.organization, task.organization_id);
    },
  },
  {
    id: 'team',
    header: 'Team',
    renderCell: (task) => {
      return getTeamLabel(task.team, task.team_id);
    },
  },
  {
    id: 'profile',
    header: 'Profile',
    renderCell: (task) => {
      return (
        task.agent_profile?.name ??
        (task.agent_profile_id ? `Profile #${task.agent_profile_id}` : '—')
      );
    },
  },
  {
    id: 'execution',
    header: 'Execution',
    renderCell: (task) => {
      return task.execution_mode || '—';
    },
  },
  {
    id: 'schedule',
    header: 'Schedule',
    renderCell: (task) => {
      return task.schedule_type || '—';
    },
  },
  {
    id: 'state',
    header: 'State',
    renderCell: (task) => {
      return (
        <Badge variant={getTaskStatusVariant(task.enabled)}>
          {formatBooleanLabel(task.enabled)}
        </Badge>
      );
    },
  },
  {
    id: 'next_run_at',
    header: 'Next run',
    cellClassName: 'text-muted-foreground',
    renderCell: (task) => {
      return formatDateTime(task.next_run_at);
    },
  },
  {
    id: 'latest_run',
    header: 'Latest run',
    renderCell: (task) => {
      return getLatestRunStatus(task);
    },
  },
  {
    id: 'updated_at',
    header: 'Updated',
    cellClassName: 'text-muted-foreground',
    renderCell: (task) => {
      return formatDateTime(task.updated_at);
    },
  },
];

interface Props {
  initialTasks: AgentTask[];
  totalCount: number;
}

export function AgentTasksList({ initialTasks, totalCount }: Props) {
  const fetchMore = useCallback(async (offset: number) => {
    const result = await getAgentTasks(offset, PAGE_SIZE);
    return { data: result.data, hasMore: result.hasMore };
  }, []);

  const initialHasMore =
    totalCount > 0
      ? initialTasks.length < totalCount
      : initialTasks.length === PAGE_SIZE;

  const {
    items: tasks,
    isLoading,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll({
    fetchMore,
    initialItems: initialTasks,
    initialHasMore,
  });

  return (
    <DataTable
      columns={COLUMNS}
      items={tasks}
      keyExtractor={(task) => {
        return task.id;
      }}
      isLoading={isLoading}
      hasMore={hasMore}
      sentinelRef={sentinelRef}
      caption='Agent Tasks'
      captionSrOnly
      tableMinWidth='min-w-[900px]'
      renderMobileCard={(task) => {
        return (
          <Link
            href={`${ROUTES.DASHBOARD.AGENT_TASKS}/${task.id}`}
            className='block rounded-[var(--radius-card)] border border-border p-4 hover:bg-accent/30 transition-colors'
          >
            <div className='flex items-start justify-between gap-2'>
              <p className='font-medium text-primary'>{task.name}</p>
              <Badge variant={getTaskStatusVariant(task.enabled)}>
                {formatBooleanLabel(task.enabled)}
              </Badge>
            </div>
            <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              <span>
                {getOrganizationLabel(task.organization, task.organization_id)}
              </span>
              {task.team && (
                <span>{getTeamLabel(task.team, task.team_id)}</span>
              )}
            </div>
            <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              {task.execution_mode && (
                <span>Execution: {task.execution_mode}</span>
              )}
              {task.schedule_type && (
                <span>Schedule: {task.schedule_type}</span>
              )}
              {task.agent_task_type && (
                <span>Type: {task.agent_task_type}</span>
              )}
            </div>
            <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              <span>Next run: {formatDateTime(task.next_run_at)}</span>
              <span>Latest: {getLatestRunStatus(task)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}
