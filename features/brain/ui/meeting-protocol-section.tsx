'use client';

import { Check, FileText } from 'lucide-react';

import { formatDateOnly } from '@/features/brain/lib/format';
import { summaryFromDraftPayload } from '@/features/brain/lib/meeting-drafts';
import { Badge } from '@/shared/ui/badge';
import { MarkdownContent } from '@/shared/ui/markdown-content';

import {
  MeetingArtifactSection,
  RegenerateButton,
} from './meeting-artifact-section';
import { MeetingArtifactState } from './meeting-artifact-state';
import { MeetingDraftCard } from './meeting-draft-card';

import type {
  BrainSuggestion,
  MeetingSummary,
  MeetingSummaryRepeatedDiscussion,
  SaveMeetingSummaryPayload,
} from '@/features/brain/model/types';
import type { ReactNode } from 'react';

interface Props {
  /** The protocol, or `null` when it has not been generated yet (404). */
  summary: MeetingSummary | null;
  /** Pending brain draft for this protocol, or `null`. */
  draft: BrainSuggestion | null;
  /** Whether manager-only regenerate/draft controls are shown. */
  canManage: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
  onApproveDraft: () => void;
  onRejectDraft: () => void;
  /** Whether an approve/reject for the draft is in flight. */
  draftBusy: boolean;
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

/** Renders a protocol draft's payload with the Section 1 layout. */
function ProtocolDraftPreview({ draft }: { draft: BrainSuggestion }) {
  return (
    <ProtocolContent
      summary={summaryFromDraftPayload(
        draft.payload as SaveMeetingSummaryPayload,
      )}
    />
  );
}

/**
 * Protocol section of the "Протокол и агенда" tab — the AI summary of the
 * meeting that just happened. Shows the real `done` protocol; when a brain draft
 * is pending it is offered as an update (approve overwrites). With no real
 * protocol, a pending draft is previewed inline for approval; otherwise a
 * spinner / retry plate / empty state.
 * @param root0 - props.
 * @param root0.summary - the protocol or `null` (not generated).
 * @param root0.draft - pending brain draft or `null`.
 * @param root0.canManage - whether regenerate/draft controls are shown.
 * @param root0.onRegenerate - triggers a protocol regeneration.
 * @param root0.regenerating - whether a regeneration is in flight.
 * @param root0.onApproveDraft - approves the pending draft.
 * @param root0.onRejectDraft - rejects the pending draft.
 * @param root0.draftBusy - whether a draft action is in flight.
 */
export function MeetingProtocolSection({
  summary,
  draft,
  canManage,
  onRegenerate,
  regenerating,
  onApproveDraft,
  onRejectDraft,
  draftBusy,
}: Props) {
  const doneSummary = summary?.status === 'done' ? summary : null;
  const activeDraft = canManage ? draft : null;

  const headerAction =
    doneSummary && canManage ? (
      <RegenerateButton onClick={onRegenerate} busy={regenerating} />
    ) : undefined;

  let body: ReactNode;

  if (doneSummary) {
    body = (
      <div className='flex flex-col gap-4'>
        {activeDraft && (
          <MeetingDraftCard
            suggestion={activeDraft}
            variant='update'
            onApprove={onApproveDraft}
            onReject={onRejectDraft}
            busy={draftBusy}
          >
            <ProtocolDraftPreview draft={activeDraft} />
          </MeetingDraftCard>
        )}
        <ProtocolContent summary={doneSummary} />
      </div>
    );
  } else if (activeDraft) {
    body = (
      <MeetingDraftCard
        suggestion={activeDraft}
        variant='primary'
        onApprove={onApproveDraft}
        onReject={onRejectDraft}
        busy={draftBusy}
      >
        <ProtocolDraftPreview draft={activeDraft} />
      </MeetingDraftCard>
    );
  } else {
    body = (
      <MeetingArtifactState
        status={summary?.status ?? null}
        emptyIcon={FileText}
        emptyTitle='Протокол пока не сгенерирован'
        emptyDescription='Он появится после обработки транскрипта встречи.'
        canManage={canManage}
        onGenerate={onRegenerate}
        generating={regenerating}
        generateLabel='Сгенерировать протокол'
      />
    );
  }

  return (
    <MeetingArtifactSection
      label='Протокол'
      labelIcon={FileText}
      headerAction={headerAction}
    >
      {body}
    </MeetingArtifactSection>
  );
}
