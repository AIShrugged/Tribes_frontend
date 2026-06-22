import clsx from 'clsx';

import { getEventTypeMeta } from '@/features/brain/lib/format';

import type { BrainEvent } from '@/features/brain/model/types';

interface Props {
  event: BrainEvent;
  /** Whether this is the last event in its run group (hides the connector line). */
  isLast: boolean;
}

const TOOL_RESULT_LIMIT = 600;

function getDisplayContent(event: BrainEvent): string | null {
  if (!event.content) return null;

  if (
    event.type === 'tool_result' &&
    event.content.length > TOOL_RESULT_LIMIT
  ) {
    return `${event.content.slice(0, TOOL_RESULT_LIMIT)}…`;
  }

  return event.content;
}

/**
 * A single reasoning-log entry rendered as a timeline node: type icon, label,
 * optional tool name, content and tool-call payload.
 * @param root0 - props.
 * @param root0.event - the event to render.
 * @param root0.isLast - whether it is the last node in its group.
 */
export function BrainEventItem({ event, isLast }: Props) {
  const meta = getEventTypeMeta(event.type);
  const Icon = meta.icon;
  const content = getDisplayContent(event);
  const payloadText =
    event.payload && Object.keys(event.payload).length > 0
      ? JSON.stringify(event.payload, null, 2)
      : null;

  return (
    <li className='relative flex gap-3 pb-4 last:pb-0'>
      {!isLast && (
        <span
          className='absolute left-[11px] top-6 bottom-0 w-px bg-[var(--divider)]'
          aria-hidden='true'
        />
      )}
      <span className='relative z-10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]'>
        <Icon
          className={clsx('h-3.5 w-3.5', meta.colorClass)}
          aria-hidden='true'
        />
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span className='text-xs font-medium text-[var(--foreground)]'>
            {meta.label}
          </span>
          {event.tool_name && (
            <span className='font-mono text-xs text-[var(--muted-foreground)]'>
              {event.tool_name}
            </span>
          )}
          <span className='ml-auto text-xs text-[var(--muted-foreground)]'>
            #{event.seq}
          </span>
        </div>
        {content && (
          <p className='mt-1 whitespace-pre-line break-words text-sm leading-6 text-[var(--foreground)]'>
            {content}
          </p>
        )}
        {payloadText && (
          <pre className='mt-1.5 overflow-x-auto rounded-[var(--r-md)] bg-[var(--surface-3)] p-2 font-mono text-xs text-[var(--muted-foreground)]'>
            {payloadText}
          </pre>
        )}
      </div>
    </li>
  );
}
