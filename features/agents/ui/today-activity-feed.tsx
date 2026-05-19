'use client';

import { Activity, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { formatDateTime } from '@/features/agents/lib/format';
import { AgentJsonPreview } from '@/features/agents/ui/agent-json-preview';
import { AgentRunStatusBadge } from '@/features/agents/ui/agent-run-status-badge';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import type {
  AgentRunStatus,
  AgentTaskActivityItem,
  AgentTaskLatestRun,
} from '@/features/agents/model/types';

const STATUS_EMPTY_MESSAGE: Record<AgentRunStatus, string> = {
  queued: 'Run is queued — activity will appear once it starts.',
  processing: 'Run is in progress — refresh the page to see new activity.',
  running: 'Run is in progress — refresh the page to see new activity.',
  completed: 'This run completed with no recorded tool calls.',
  success: 'This run completed successfully with no recorded tool calls.',
  failed: 'Run failed with no recorded activity.',
  error: 'Run encountered an error with no recorded activity.',
};

/**
 *
 * @param root0
 * @param root0.run
 */
function RunStatusHeader({ run }: { run: AgentTaskLatestRun }) {
  const startedLabel = formatDateTime(run.started_at);
  const finishedLabel = formatDateTime(run.finished_at);

  return (
    <div className='mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card px-4 py-3'>
      <AgentRunStatusBadge status={run.status ?? 'unknown'} />
      {run.started_at && (
        <span className='text-xs text-muted-foreground'>
          Started: {startedLabel}
          {run.finished_at && ` → ${finishedLabel}`}
        </span>
      )}
      {run.status === 'processing' && (
        <span className='ml-auto flex items-center gap-1 text-xs text-muted-foreground'>
          <RefreshCw className='h-3 w-3' />
          Refresh to see new activity
        </span>
      )}
      {run.status === 'failed' && run.error_message && (
        <span className='w-full text-xs text-destructive'>
          Error: {run.error_message}
        </span>
      )}
    </div>
  );
}

/**
 *
 * @param root0
 * @param root0.item
 */
function ActivityItemCard({ item }: { item: AgentTaskActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = item.tool_result !== null;

  return (
    <article className='relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-card p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={item.success ? 'success' : 'destructive'}>
              {item.success ? 'Success' : 'Failed'}
            </Badge>
            <span className='text-xs uppercase tracking-wide text-muted-foreground'>
              {item.tool_name}
            </span>
          </div>
          <p className='mt-3 break-words text-sm leading-6 text-foreground'>
            {item.description}
          </p>
          {hasResult && (
            <Button
              type='button'
              variant='ghost'
              size='xs'
              fullWidth={false}
              className='mt-3'
              leftIcon={
                expanded ? (
                  <ChevronDown className='h-3 w-3' />
                ) : (
                  <ChevronRight className='h-3 w-3' />
                )
              }
              onClick={() => {
                setExpanded((prev) => {
                  return !prev;
                });
              }}
            >
              {expanded ? 'Hide result' : 'Show result'}
            </Button>
          )}
          {hasResult && expanded && (
            <div className='mt-3'>
              <AgentJsonPreview title='Tool result' value={item.tool_result} />
            </div>
          )}
          <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
            <span>{formatDateTime(item.created_at)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

type Props = {
  run: AgentTaskLatestRun;
  items: AgentTaskActivityItem[];
};

/**
 *
 * @param root0
 * @param root0.run
 * @param root0.items
 */
export function TodayActivityFeed({ run, items }: Props) {
  const emptyMessage = run.status
    ? STATUS_EMPTY_MESSAGE[run.status]
    : 'No activity recorded for this run.';

  if (items.length === 0) {
    return (
      <>
        <RunStatusHeader run={run} />
        <EmptyState
          icon={Activity}
          title='No activity recorded'
          description={emptyMessage}
        />
      </>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <RunStatusHeader run={run} />
      {items.map((item) => {
        return <ActivityItemCard key={item.id} item={item} />;
      })}
    </div>
  );
}
