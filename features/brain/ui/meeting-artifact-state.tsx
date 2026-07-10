'use client';

import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import type { MeetingArtifactStatus } from '@/features/brain/model/types';
import type { LucideIcon } from 'lucide-react';

interface Props {
  /**
   * Artifact status (or `null` when nothing exists). `done` never reaches here —
   * the section renders content instead — so it falls through to the spinner.
   */
  status: MeetingArtifactStatus | null;
  /** Icon for the empty state. */
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  /** Whether the generate/retry button is shown (manager-only). */
  canManage: boolean;
  onGenerate: () => void;
  generating: boolean;
  /** Label of the generate button in the empty state (e.g. "Сгенерировать протокол"). */
  generateLabel: string;
}

/**
 * Fallback shown when a meeting artifact is not ready to render its content:
 * spinner while generating, retry plate on failure, empty state when nothing
 * exists yet. Keeps the protocol and agenda sections consistent.
 * @param root0 - props.
 * @param root0.status - artifact status, or null when nothing exists.
 * @param root0.emptyIcon - empty-state icon.
 * @param root0.emptyTitle - empty-state title.
 * @param root0.emptyDescription - empty-state description.
 * @param root0.canManage - whether to show the generate/retry button.
 * @param root0.onGenerate - triggers (re)generation.
 * @param root0.generating - whether a generation request is in flight.
 * @param root0.generateLabel - generate-button label in the empty state.
 */
export function MeetingArtifactState({
  status,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  canManage,
  onGenerate,
  generating,
  generateLabel,
}: Props) {
  if (status == null) {
    return (
      <div className='flex flex-col items-center gap-4'>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
        {canManage && (
          <Button
            variant={BUTTON_VARIANT.secondary}
            size={BUTTON_SIZE.sm}
            onClick={onGenerate}
            loading={generating}
            loadingText='Запуск…'
          >
            <RefreshCw className='h-4 w-4' />
            {generateLabel}
          </Button>
        )}
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className='flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger-bg)] bg-[var(--danger-bg)]/40 py-10 text-center'>
        <TriangleAlert className='h-6 w-6 text-[var(--danger)]' />
        <p className='text-sm font-medium text-foreground'>
          Генерация не удалась
        </p>
        {canManage && (
          <Button
            variant={BUTTON_VARIANT.secondary}
            size={BUTTON_SIZE.sm}
            onClick={onGenerate}
            loading={generating}
            loadingText='Запуск…'
          >
            <RefreshCw className='h-4 w-4' />
            Сгенерировать заново
          </Button>
        )}
      </div>
    );
  }

  // pending / in_progress (done never reaches here).
  return (
    <div className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
      <Loader2 className='h-6 w-6 animate-spin text-[var(--primary)]' />
      <p className='text-sm text-muted-foreground'>Генерируется…</p>
    </div>
  );
}
