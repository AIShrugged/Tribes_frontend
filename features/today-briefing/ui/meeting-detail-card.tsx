'use client';

import { differenceInMinutes, format, parseISO } from 'date-fns';
import { Clock, Users, Video } from 'lucide-react';

import { Card } from '@/shared/ui/card';
import { CollapsibleSection } from '@/shared/ui/layout/collapsible-section';
import { MarkdownContent } from '@/shared/ui/markdown-content';

import { AgendaList } from './agenda-list';

import type { TodayEvent } from '../model/types';

interface MeetingDetailCardProps {
  event: TodayEvent;
}

export function MeetingDetailCard({ event }: MeetingDetailCardProps) {
  const start = parseISO(event.starts_at);
  const end = parseISO(event.ends_at);
  const duration = differenceInMinutes(end, start);

  return (
    <Card className='flex flex-col gap-0 overflow-hidden'>
      {/* Header */}
      <div className='px-5 pt-4 pb-3 border-b border-border'>
        {event.meeting_url ? (
          <a
            href={event.meeting_url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-base font-semibold text-foreground hover:text-primary transition-colors'
          >
            {event.title}
          </a>
        ) : (
          <span className='text-base font-semibold text-foreground'>
            {event.title}
          </span>
        )}
        <div className='flex items-center gap-3 mt-1 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            {format(start, 'HH:mm')} — {format(end, 'HH:mm')} ({duration} min)
          </span>
          {event.participants_count > 0 && (
            <span className='flex items-center gap-1'>
              <Users className='h-3 w-3' />
              {event.participants_count} people
            </span>
          )}
          {event.platform && (
            <span className='flex items-center gap-1'>
              <Video className='h-3 w-3' />
              {event.platform.replace('_', ' ')}
            </span>
          )}
        </div>
        {event.summary && event.summary.attendees.length > 0 && (
          <div className='mt-2'>
            <div className='flex flex-wrap gap-1.5'>
              {event.summary.attendees.map((attendee) => {
                return (
                  <span
                    key={attendee.name}
                    className='text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground'
                  >
                    {attendee.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-4 px-5 py-4'>
        {/* Agenda (tasks) — moved to the top so tasks are the first thing shown */}
        <AgendaList
          tasks={event.tasks}
          totalCount={event.total_tasks_count}
          doneCount={event.done_tasks_count}
          meetingState={event.meeting_state}
        />

        {/* Updated (augmented) tasks — pre-existing issues this meeting touched.
            Separate informational list; does NOT count toward the readiness bar. */}
        {(event.updated_tasks ?? []).length > 0 && (
          <AgendaList
            tasks={event.updated_tasks}
            totalCount={event.updated_tasks.length}
            doneCount={0}
            meetingState={event.meeting_state}
            label='Tasks updated in this meeting'
          />
        )}

        {/* Readiness bar */}
        {event.total_tasks_count > 0 && (
          <div className='flex items-center gap-3'>
            <div className='h-2 flex-1 rounded-full bg-muted-foreground/20'>
              <div
                className='h-full rounded-full bg-emerald-500 transition-all'
                style={{
                  width: `${(event.done_tasks_count / event.total_tasks_count) * 100}%`,
                }}
              />
            </div>
            <span className='text-xs text-muted-foreground shrink-0'>
              {event.done_tasks_count} of {event.total_tasks_count} ready
            </span>
          </div>
        )}

        {/* Briefing (from past meeting summary) */}
        {event.summary && (
          <CollapsibleSection label='Briefing' extraContent={null}>
            <div className='flex flex-col gap-3'>
              {event.summary.key_points.length > 0 && (
                <div>
                  <p className='text-xs font-semibold text-foreground mb-1.5'>
                    Key Points
                  </p>
                  <ul className='flex flex-col gap-1'>
                    {event.summary.key_points.map((point, i) => {
                      return (
                        <li
                          key={i}
                          className='flex items-start gap-2 text-sm text-foreground'
                        >
                          <span className='w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0' />
                          <span>{point}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/*
                Decisions section intentionally hidden on the today/meetings page.
                Source data (event.summary.decisions) is still available and the
                section is still rendered on /dashboard/meetings/[id]/overview via
                MeetingDecisionsSection. To restore it here, re-add a block that maps
                event.summary.decisions, mirroring the Key Points block above.
              */}

              {event.summary.repeated_discussions.length > 0 && (
                <div className='rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 flex flex-col gap-2'>
                  <p className='text-xs font-semibold text-amber-700 dark:text-amber-400'>
                    Repeated Discussions
                  </p>
                  <ul className='flex flex-col gap-2'>
                    {event.summary.repeated_discussions.map((item, i) => {
                      return (
                        <li key={i} className='text-sm text-foreground'>
                          <span className='font-medium'>
                            «{item.new_decision}»
                          </span>
                          <span className='text-muted-foreground'>
                            {' '}
                            — похожее решение уже принималось{' '}
                            {format(parseISO(item.previous_date), 'dd.MM.yyyy')}
                            {item.previous_meeting_title
                              ? ` на «${item.previous_meeting_title}»`
                              : ''}
                            : «{item.previous_decision}»
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {event.summary.key_points.length === 0 &&
                event.summary.decisions.length === 0 && (
                  <MarkdownContent>{event.summary.summary}</MarkdownContent>
                )}

              {event.review?.key_insight && (
                <p className='text-md text-foreground'>
                  {event.review.key_insight}
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Agenda content (upcoming/general agenda for future meetings) */}
        {event.meeting_state !== 'ready' && event.agenda_content && (
          <CollapsibleSection label='Agenda' extraContent={null}>
            <p className='text-sm text-foreground whitespace-pre-wrap'>
              {event.agenda_content}
            </p>
          </CollapsibleSection>
        )}
      </div>
    </Card>
  );
}
