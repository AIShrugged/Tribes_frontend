import Link from 'next/link';

import { formatDateTime, formatDuration } from '@/features/agents/lib/format';
import { AgentRunStatusBadge } from '@/features/agents/ui/agent-run-status-badge';
import { DataTable } from '@/shared/ui/table';

import type { AgentTaskRun } from '@/features/agents/model/types';
import type { TableColumn } from '@/shared/ui/table';

function buildColumns(taskId: number): TableColumn<AgentTaskRun>[] {
  return [
    {
      id: 'status',
      header: 'Status',
      renderCell: (run) => {
        return <AgentRunStatusBadge status={run.status} />;
      },
    },
    {
      id: 'attempt',
      header: 'Attempt',
      renderCell: (run) => {
        return run.attempt ?? '—';
      },
    },
    {
      id: 'scheduled_for',
      header: 'Scheduled',
      cellClassName: 'text-muted-foreground',
      renderCell: (run) => {
        return formatDateTime(run.scheduled_for);
      },
    },
    {
      id: 'started_at',
      header: 'Started',
      cellClassName: 'text-muted-foreground',
      renderCell: (run) => {
        return formatDateTime(run.started_at);
      },
    },
    {
      id: 'finished_at',
      header: 'Finished',
      cellClassName: 'text-muted-foreground',
      renderCell: (run) => {
        return formatDateTime(run.finished_at);
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      renderCell: (run) => {
        return formatDuration(run);
      },
    },
    {
      id: 'details',
      header: 'Details',
      renderCell: (run) => {
        const href = `/dashboard/agents/tasks/${taskId}/runs?runId=${run.id}`;

        return (
          <Link href={href} className='text-primary hover:underline'>
            Open run #{run.id}
          </Link>
        );
      },
    },
  ];
}

/**
 * AgentTaskRunsList — renders task runs as a responsive table with mobile card fallback.
 */
export function AgentTaskRunsList({
  taskId,
  runs,
  selectedRunId,
}: {
  taskId: number;
  runs: AgentTaskRun[];
  selectedRunId?: number;
}) {
  const columns = buildColumns(taskId);

  return (
    <DataTable
      columns={columns}
      items={runs}
      keyExtractor={(run) => {
        return run.id;
      }}
      caption='Agent Task Runs'
      captionSrOnly
      tableMinWidth='min-w-[700px]'
      getRowClassName={(run) => {
        return selectedRunId === run.id ? 'bg-accent/20' : '';
      }}
      renderMobileCard={(run) => {
        const href = `/dashboard/agents/tasks/${taskId}/runs?runId=${run.id}`;
        const isSelected = selectedRunId === run.id;

        return (
          <Link
            href={href}
            className={[
              'block rounded-[var(--radius-card)] border border-border p-4 transition-colors',
              isSelected ? 'bg-accent/20' : 'hover:bg-accent/30',
            ].join(' ')}
          >
            <div className='flex items-center justify-between gap-2'>
              <AgentRunStatusBadge status={run.status} />
              <span className='text-xs text-muted-foreground'>
                Run #{run.id}
                {run.attempt == null ? '' : ` · attempt ${run.attempt}`}
              </span>
            </div>
            <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              <span>Started: {formatDateTime(run.started_at)}</span>
              <span>Finished: {formatDateTime(run.finished_at)}</span>
              <span>Duration: {formatDuration(run)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}
