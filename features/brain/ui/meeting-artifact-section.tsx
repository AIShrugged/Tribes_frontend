'use client';

import { RefreshCw } from 'lucide-react';

import { MeetingArtifactState } from './meeting-artifact-state';

import type { ArtifactStateKind } from './meeting-artifact-state';
import type { MeetingArtifactStatus } from '@/features/brain/model/types';
import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  /** Section heading (e.g. "Протокол"). */
  label: string;
  labelIcon: LucideIcon;
  /** Artifact status, or `null` when the artifact does not exist yet. */
  status: MeetingArtifactStatus | null;
  canManage: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  generateLabel: string;
}>;

/** Maps an artifact status (or its absence) to the fallback state to render. */
function resolveFallbackKind(
  status: MeetingArtifactStatus | null,
): ArtifactStateKind {
  if (status === 'failed') return 'failed';

  if (status == null) return 'empty';

  return 'in_progress';
}

/**
 * Card shell shared by the protocol and agenda sections: an uppercase label with
 * a manager-only "Пересобрать" control, and the content/loading/failed/empty
 * body driven by `status`. Content (`children`) shows only on `done`; every
 * other state renders the matching {@link MeetingArtifactState} fallback.
 * @param root0 - props.
 * @param root0.label - section heading.
 * @param root0.labelIcon - heading icon.
 * @param root0.status - artifact status or null.
 * @param root0.canManage - whether regenerate controls are shown.
 * @param root0.onRegenerate - triggers (re)generation.
 * @param root0.regenerating - whether a regeneration is in flight.
 * @param root0.emptyIcon - empty-state icon.
 * @param root0.emptyTitle - empty-state title.
 * @param root0.emptyDescription - empty-state description.
 * @param root0.generateLabel - generate-button label.
 * @param root0.children - content rendered when done.
 */
export function MeetingArtifactSection({
  label,
  labelIcon: LabelIcon,
  status,
  canManage,
  onRegenerate,
  regenerating,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  generateLabel,
  children,
}: Props) {
  const isDone = status === 'done';
  const fallbackKind = resolveFallbackKind(status);

  return (
    <section className='rounded-[var(--radius-card)] border border-border bg-card px-5 py-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          <LabelIcon className='h-3.5 w-3.5' />
          {label}
        </div>
        {canManage && isDone && (
          <button
            type='button'
            onClick={onRegenerate}
            disabled={regenerating}
            className='inline-flex items-center gap-1.5 rounded-[var(--radius-button)] px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--secondary)] hover:text-foreground disabled:cursor-wait disabled:opacity-60'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`}
            />
            Пересобрать
          </button>
        )}
      </div>

      <div className='mt-4'>
        {isDone ? (
          children
        ) : (
          <MeetingArtifactState
            kind={fallbackKind}
            emptyIcon={emptyIcon}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            canManage={canManage}
            onGenerate={onRegenerate}
            generating={regenerating}
            generateLabel={generateLabel}
          />
        )}
      </div>
    </section>
  );
}
