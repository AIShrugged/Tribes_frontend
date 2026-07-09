'use client';

import { Check, FileText } from 'lucide-react';

import { formatDateOnly } from '@/features/brain/lib/format';
import { Badge } from '@/shared/ui/badge';
import { MarkdownContent } from '@/shared/ui/markdown-content';

import { MeetingArtifactSection } from './meeting-artifact-section';

import type {
  MeetingSummary,
  MeetingSummaryRepeatedDiscussion,
} from '@/features/brain/model/types';

interface Props {
  /** The protocol, or `null` when it has not been generated yet (404). */
  summary: MeetingSummary | null;
  /** Whether manager-only regenerate controls are shown. */
  canManage: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}

/** Small uppercase sub-heading used inside the protocol content. */
function SubLabel({ children }: { children: string }) {
  return (
    <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
      {children}
    </h3>
  );
}

function RepeatedDiscussions({
  items,
}: {
  items: MeetingSummaryRepeatedDiscussion[];
}) {
  return (
    <div className='rounded-[var(--radius-card)] border border-[var(--warning-bg)] bg-[var(--warning-bg)]/40 px-4 py-3'>
      <SubLabel>Повторяющиеся обсуждения</SubLabel>
      <ul className='flex flex-col gap-3'>
        {items.map((item, index) => {
          return (
            <li key={index} className='text-sm'>
              {item.new_decision && (
                <p className='text-foreground'>{item.new_decision}</p>
              )}
              {item.previous_decision && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Ранее
                  {item.previous_date
                    ? ` (${formatDateOnly(item.previous_date)})`
                    : ''}
                  : {item.previous_decision}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProtocolContent({ summary }: { summary: MeetingSummary }) {
  const attendees = summary.attendees.filter((attendee) => {
    return Boolean(attendee.name);
  });

  return (
    <div className='flex flex-col gap-5'>
      {summary.title && (
        <h2 className='text-lg font-semibold text-foreground'>
          {summary.title}
        </h2>
      )}

      {summary.summary && (
        <div className='text-sm'>
          <MarkdownContent>{summary.summary}</MarkdownContent>
        </div>
      )}

      {summary.key_points.length > 0 && (
        <div>
          <SubLabel>Ключевые тезисы</SubLabel>
          <ul className='flex flex-col gap-1.5'>
            {summary.key_points.map((point, index) => {
              return (
                <li
                  key={index}
                  className='flex items-start gap-2 text-sm text-foreground'
                >
                  <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary' />
                  <span>{point}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {summary.decisions.length > 0 && (
        <div>
          <SubLabel>Решения</SubLabel>
          <ul className='flex flex-col gap-1.5'>
            {summary.decisions.map((decision, index) => {
              return (
                <li
                  key={index}
                  className='flex items-start gap-2 text-sm text-foreground'
                >
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]' />
                  <span>{decision}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {summary.repeated_discussions.length > 0 && (
        <RepeatedDiscussions items={summary.repeated_discussions} />
      )}

      {attendees.length > 0 && (
        <div>
          <SubLabel>Участники</SubLabel>
          <div className='flex flex-wrap gap-1.5'>
            {attendees.map((attendee, index) => {
              return (
                <Badge key={index} variant='neutral'>
                  {attendee.name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Protocol section of the "Протокол и агенда" tab — the AI summary of the
 * meeting that just happened. Renders content on `done`, otherwise a spinner /
 * retry plate / empty state (via {@link MeetingArtifactSection}).
 * @param root0 - props.
 * @param root0.summary - the protocol or `null` (not generated).
 * @param root0.canManage - whether regenerate controls are shown.
 * @param root0.onRegenerate - triggers a protocol regeneration.
 * @param root0.regenerating - whether a regeneration is in flight.
 */
export function MeetingProtocolSection({
  summary,
  canManage,
  onRegenerate,
  regenerating,
}: Props) {
  return (
    <MeetingArtifactSection
      label='Протокол'
      labelIcon={FileText}
      status={summary?.status ?? null}
      canManage={canManage}
      onRegenerate={onRegenerate}
      regenerating={regenerating}
      emptyIcon={FileText}
      emptyTitle='Протокол пока не сгенерирован'
      emptyDescription='Он появится после обработки транскрипта встречи.'
      generateLabel='Сгенерировать протокол'
    >
      {summary && <ProtocolContent summary={summary} />}
    </MeetingArtifactSection>
  );
}
