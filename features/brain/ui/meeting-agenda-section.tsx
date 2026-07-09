'use client';

import { CalendarClock, ListChecks } from 'lucide-react';

import { formatDateOnly } from '@/features/brain/lib/format';
import { Badge } from '@/shared/ui/badge';
import { MarkdownContent } from '@/shared/ui/markdown-content';

import { MeetingArtifactSection } from './meeting-artifact-section';

import type {
  AgendaCommitmentCheck,
  AgendaDiscussionTopic,
  AgendaRawJson,
  MeetingAgenda,
} from '@/features/brain/model/types';

interface Props {
  /** The `general` agenda, or `null` when there is none / next meeting missing. */
  agenda: MeetingAgenda | null;
  canManage: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}

function SubLabel({ children }: { children: string }) {
  return (
    <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
      {children}
    </h3>
  );
}

function DiscussionTopics({ topics }: { topics: AgendaDiscussionTopic[] }) {
  return (
    <div>
      <SubLabel>Темы обсуждения</SubLabel>
      <ul className='flex flex-col gap-2.5'>
        {topics.map((topic, index) => {
          return (
            <li
              key={index}
              className='flex items-start gap-2 text-sm text-foreground'
            >
              <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary' />
              <div className='min-w-0'>
                {topic.title && (
                  <p className='font-medium text-foreground'>{topic.title}</p>
                )}
                {topic.description && (
                  <p className='mt-0.5 text-muted-foreground'>
                    {topic.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CommitmentsTable({ rows }: { rows: AgendaCommitmentCheck[] }) {
  return (
    <div>
      <SubLabel>Проверка обязательств</SubLabel>
      <div className='overflow-x-auto rounded-[var(--radius-card)] border border-border'>
        <table className='w-full border-collapse text-sm'>
          <thead>
            <tr className='border-b border-border bg-[var(--surface-3)]'>
              {['Кто', 'Обязательство', 'Срок', 'Статус', 'Вопрос'].map(
                (heading) => {
                  return (
                    <th
                      key={heading}
                      className='px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground'
                    >
                      {heading}
                    </th>
                  );
                },
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              return (
                <tr
                  key={index}
                  className='border-b border-border/50 last:border-b-0 align-top'
                >
                  <td className='whitespace-nowrap px-3 py-2 font-medium text-foreground'>
                    {row.person ?? '—'}
                  </td>
                  <td className='px-3 py-2 text-foreground'>
                    {row.commitment ?? '—'}
                  </td>
                  <td className='whitespace-nowrap px-3 py-2 text-muted-foreground'>
                    {row.deadline ? formatDateOnly(row.deadline) : '—'}
                  </td>
                  <td className='px-3 py-2'>
                    {row.status ? (
                      <Badge variant='neutral'>{row.status}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className='px-3 py-2 text-muted-foreground'>
                    {row.question ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionsRecap({ decisions }: { decisions: string[] }) {
  return (
    <div>
      <SubLabel>Решения прошлой встречи</SubLabel>
      <ul className='flex flex-col gap-1.5'>
        {decisions.map((decision, index) => {
          return (
            <li
              key={index}
              className='flex items-start gap-2 text-sm text-foreground'
            >
              <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground' />
              <span>{decision}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The structured agenda body, assembled from the `raw_json` fields. */
function StructuredAgenda({ raw }: { raw: AgendaRawJson }) {
  const topics = raw.discussion_topics ?? [];
  const commitments = raw.commitments_check ?? [];
  const decisionsRecap = raw.decisions_recap ?? [];

  return (
    <div className='flex flex-col gap-5'>
      {raw.meeting_goal && (
        <div>
          <SubLabel>Цель встречи</SubLabel>
          <p className='text-base font-medium text-foreground'>
            {raw.meeting_goal}
          </p>
        </div>
      )}

      {raw.main_problem && (
        <div>
          <SubLabel>Главная проблематика</SubLabel>
          <p className='text-sm text-foreground'>{raw.main_problem}</p>
        </div>
      )}

      {topics.length > 0 && <DiscussionTopics topics={topics} />}

      {commitments.length > 0 && <CommitmentsTable rows={commitments} />}

      {decisionsRecap.length > 0 && (
        <DecisionsRecap decisions={decisionsRecap} />
      )}
    </div>
  );
}

/** True when `raw_json` carries at least one structured field worth rendering. */
function hasStructuredAgenda(raw: AgendaRawJson): boolean {
  return Boolean(
    raw.meeting_goal ||
      raw.main_problem ||
      (raw.discussion_topics?.length ?? 0) > 0 ||
      (raw.commitments_check?.length ?? 0) > 0 ||
      (raw.decisions_recap?.length ?? 0) > 0,
  );
}

function AgendaContent({ agenda }: { agenda: MeetingAgenda }) {
  const raw = agenda.raw_json ?? {};

  if (hasStructuredAgenda(raw)) {
    return <StructuredAgenda raw={raw} />;
  }

  // Fall back to the pre-rendered Markdown agenda when there is no structure.
  if (agenda.content) {
    return (
      <div className='text-sm'>
        <MarkdownContent>{agenda.content}</MarkdownContent>
      </div>
    );
  }

  return (
    <p className='text-sm text-muted-foreground'>
      Агенда сформирована, но не содержит данных.
    </p>
  );
}

/**
 * Agenda section of the "Протокол и агенда" tab — the agenda of the NEXT meeting
 * in the series. Prefers the structured `raw_json` render, falling back to the
 * pre-rendered Markdown `content`. Renders content on `done`, otherwise a
 * spinner / retry plate / empty state.
 * @param root0 - props.
 * @param root0.agenda - the general agenda or `null`.
 * @param root0.canManage - whether regenerate controls are shown.
 * @param root0.onRegenerate - triggers an agenda regeneration.
 * @param root0.regenerating - whether a regeneration is in flight.
 */
export function MeetingAgendaSection({
  agenda,
  canManage,
  onRegenerate,
  regenerating,
}: Props) {
  return (
    <MeetingArtifactSection
      label='Агенда следующей встречи'
      labelIcon={ListChecks}
      status={agenda?.status ?? null}
      canManage={canManage}
      onRegenerate={onRegenerate}
      regenerating={regenerating}
      emptyIcon={CalendarClock}
      emptyTitle='Агенды нет'
      emptyDescription='Нет следующей встречи серии, для которой её можно собрать.'
      generateLabel='Сгенерировать агенду'
    >
      {agenda && <AgendaContent agenda={agenda} />}
    </MeetingArtifactSection>
  );
}
