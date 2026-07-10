'use client';

import { Check, Loader2, Sparkles, X } from 'lucide-react';

import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

import type { BrainSuggestion } from '@/features/brain/model/types';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  suggestion: BrainSuggestion;
  /**
   * - `primary`: the artifact itself is a draft (no real `done` version) — full
   *   preview shown inline.
   * - `update`: a real artifact exists; the draft is an alternative — preview is
   *   collapsed behind a disclosure.
   */
  variant?: 'primary' | 'update';
  /** Whether the Approve button is shown (hidden when approve would 422). */
  canApprove?: boolean;
  onApprove: () => void;
  onReject: () => void;
  /** Whether an approve/reject for this draft is in flight. */
  busy: boolean;
}>;

/**
 * A pending second-brain draft shown in place of (or alongside) a real artifact:
 * "Предложено вторым мозгом" header with confidence and reasoning, the payload
 * preview, and Approve / Reject controls.
 * @param root0 - props.
 * @param root0.suggestion - the pending suggestion.
 * @param root0.variant - primary (inline preview) or update (collapsed).
 * @param root0.canApprove - whether the Approve button is shown.
 * @param root0.onApprove - approves the draft.
 * @param root0.onReject - rejects the draft.
 * @param root0.busy - whether an action is in flight.
 * @param root0.children - the rendered payload preview.
 */
export function MeetingDraftCard({
  suggestion,
  variant = 'primary',
  canApprove = true,
  onApprove,
  onReject,
  busy,
  children,
}: Props) {
  const heading =
    variant === 'update'
      ? 'Второй мозг предлагает обновлённую версию'
      : 'Предложено вторым мозгом';

  const preview = (
    <div className='rounded-[var(--radius-card)] border border-border bg-card px-4 py-3'>
      {children}
    </div>
  );

  return (
    <div className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--primary)]/40 bg-[var(--primary-soft)]/20 px-4 py-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Sparkles className='h-4 w-4 text-[var(--primary)]' />
        <span className='text-sm font-medium text-foreground'>{heading}</span>
        {typeof suggestion.confidence === 'number' && (
          <Badge variant='primary'>Уверенность {suggestion.confidence}%</Badge>
        )}
      </div>

      {suggestion.reasoning && (
        <p className='text-xs text-muted-foreground'>{suggestion.reasoning}</p>
      )}

      {children &&
        (variant === 'update' ? (
          <details>
            <summary className='cursor-pointer text-xs font-medium text-[var(--primary)] hover:underline'>
              Показать превью
            </summary>
            <div className='mt-3'>{preview}</div>
          </details>
        ) : (
          preview
        ))}

      <div className='flex flex-wrap items-center gap-2'>
        {canApprove && (
          <Button
            variant={BUTTON_VARIANT.primary}
            size={BUTTON_SIZE.sm}
            onClick={onApprove}
            disabled={busy}
          >
            <Check className='h-4 w-4' />
            Одобрить
          </Button>
        )}
        <Button
          variant={BUTTON_VARIANT.secondary}
          size={BUTTON_SIZE.sm}
          onClick={onReject}
          disabled={busy}
        >
          <X className='h-4 w-4' />
          Отклонить
        </Button>
        {busy && (
          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
        )}
      </div>
    </div>
  );
}
