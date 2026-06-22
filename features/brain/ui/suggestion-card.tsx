'use client';

import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  Sparkles,
  X,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  approveBrainSuggestion,
  rejectBrainSuggestion,
} from '@/features/brain/api/suggestions';
import {
  formatDateTime,
  formatRunUuid,
  getAddCommentText,
  getApproveConfirmText,
  getSuggestionPreview,
  stripBrainPrefix,
} from '@/features/brain/lib/format';
import { Button } from '@/shared/ui/button';

import { ConfidenceMeter } from './confidence-meter';
import { SuggestionEvidence } from './suggestion-evidence';
import { SuggestionKeyBadge } from './suggestion-key-badge';
import { SuggestionResult } from './suggestion-result';
import { SuggestionStatusBadge } from './suggestion-status-badge';

import type { BrainSuggestion } from '@/features/brain/model/types';

interface Props {
  suggestion: BrainSuggestion;
  /** Called with the resolved suggestion after a successful approve/reject. */
  onResolved?: (updated: BrainSuggestion) => void;
  /** Called when the backend reports the row is already resolved (409). */
  onConflict?: () => void;
}

/**
 * A single suggestion card: action preview, reasoning/evidence, confidence and —
 * for pending items — approve (with inline confirm) / reject controls. Holds its
 * own copy of the suggestion so it can reflect the resolved state in place.
 * @param root0 - props.
 * @param root0.suggestion - the initial suggestion.
 * @param root0.onResolved - resolved callback for the parent list.
 * @param root0.onConflict - conflict callback for the parent list.
 */
export function SuggestionCard({ suggestion, onResolved, onConflict }: Props) {
  const [current, setCurrent] = useState<BrainSuggestion>(suggestion);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false);
  const [isApproving, startApprove] = useTransition();
  const [isRejecting, startReject] = useTransition();

  const isPending = current.status === 'pending';
  const isBusy = isApproving || isRejecting;
  const title = stripBrainPrefix(current.title) || current.title;
  const preview = getSuggestionPreview(current);
  const commentText = getAddCommentText(current);
  const commentIsLong = Boolean(commentText && commentText.length > 160);
  const hasDetails =
    Boolean(current.reasoning) || Boolean(current.evidence) || commentIsLong;

  const handleApprove = () => {
    startApprove(async () => {
      const outcome = await approveBrainSuggestion(current.id);
      setIsConfirmingApprove(false);

      switch (outcome.kind) {
        case 'applied': {
          setCurrent(outcome.suggestion);
          toast.success('Предложение применено');
          onResolved?.(outcome.suggestion);
          break;
        }
        case 'failed': {
          setCurrent(outcome.suggestion);
          toast.error(
            outcome.suggestion.failure_reason ??
              'Не удалось применить предложение',
          );
          onResolved?.(outcome.suggestion);
          break;
        }
        case 'conflict': {
          if (outcome.suggestion) setCurrent(outcome.suggestion);
          toast.error(outcome.message || 'Предложение уже обработано');
          onConflict?.();
          break;
        }
        default: {
          toast.error(outcome.message);
        }
      }
    });
  };

  const handleReject = () => {
    startReject(async () => {
      const outcome = await rejectBrainSuggestion(current.id);

      switch (outcome.kind) {
        case 'rejected': {
          setCurrent(outcome.suggestion);
          toast.success('Предложение отклонено');
          onResolved?.(outcome.suggestion);
          break;
        }
        case 'conflict': {
          if (outcome.suggestion) setCurrent(outcome.suggestion);
          toast.error(outcome.message || 'Предложение уже обработано');
          onConflict?.();
          break;
        }
        default: {
          toast.error(outcome.message);
        }
      }
    });
  };

  return (
    <article className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4'>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <SuggestionKeyBadge suggestionKey={current.key} />
        <SuggestionStatusBadge status={current.status} />
      </header>

      <div className='flex flex-col gap-2'>
        <h3 className='text-base font-medium leading-6 text-[var(--foreground)]'>
          {title}
        </h3>
        {current.summary && (
          <p className='text-sm text-[var(--muted-foreground)]'>
            {current.summary}
          </p>
        )}
        <div className='flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2'>
          <Sparkles
            className='mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--primary)]'
            aria-hidden='true'
          />
          <p className='text-sm font-medium text-[var(--foreground)]'>
            {preview}
          </p>
        </div>
        {commentText && (
          <div className='flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--border)] px-3 py-2'>
            <MessageSquareText
              className='mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]'
              aria-hidden='true'
            />
            <p
              className={clsx(
                'text-sm leading-6 text-[var(--foreground)]',
                isExpanded ? 'whitespace-pre-line' : 'line-clamp-3',
              )}
            >
              {commentText}
            </p>
          </div>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <ConfidenceMeter value={current.confidence} />
        <span className='text-xs text-[var(--muted-foreground)]'>
          {formatDateTime(current.created_at)}
        </span>
        {current.run_uuid && (
          <span
            className='font-mono text-xs text-[var(--muted-foreground)]'
            title={current.run_uuid}
          >
            run {formatRunUuid(current.run_uuid)}
          </span>
        )}
      </div>

      {hasDetails && (
        <div className='flex flex-col gap-3'>
          <button
            type='button'
            onClick={() => {
              setIsExpanded((value) => {
                return !value;
              });
            }}
            className='inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:rounded-[var(--r-sm)]'
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className='h-3.5 w-3.5' aria-hidden='true' />
            ) : (
              <ChevronDown className='h-3.5 w-3.5' aria-hidden='true' />
            )}
            {isExpanded ? 'Свернуть' : 'Подробнее'}
          </button>
          {isExpanded && (
            <div className='flex flex-col gap-3 border-l-2 border-[var(--divider)] pl-3'>
              {current.reasoning && (
                <p className='whitespace-pre-line text-sm leading-6 text-[var(--foreground)]'>
                  {current.reasoning}
                </p>
              )}
              <SuggestionEvidence evidence={current.evidence} />
            </div>
          )}
        </div>
      )}

      {current.status === 'applied' && (
        <SuggestionResult
          suggestionKey={current.key}
          result={current.applied_result}
        />
      )}

      {current.status === 'failed' && current.failure_reason && (
        <div className='flex items-start gap-2 rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]'>
          <AlertTriangle
            className='mt-0.5 h-4 w-4 flex-shrink-0'
            aria-hidden='true'
          />
          <span>{current.failure_reason}</span>
        </div>
      )}

      {isPending && (
        <footer className='flex flex-col gap-3 border-t border-[var(--divider)] pt-3'>
          {isConfirmingApprove ? (
            <div className='flex flex-col gap-2'>
              <p className='text-sm text-[var(--foreground)]'>
                {getApproveConfirmText(current)}
              </p>
              {commentText && (
                <p className='line-clamp-3 rounded-[var(--r-md)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--muted-foreground)]'>
                  {commentText}
                </p>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  fullWidth={false}
                  loading={isApproving}
                  loadingText='Применяем…'
                  leftIcon={<Check className='h-4 w-4' aria-hidden='true' />}
                  onClick={handleApprove}
                >
                  Применить
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  fullWidth={false}
                  disabled={isApproving}
                  onClick={() => {
                    setIsConfirmingApprove(false);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                size='sm'
                fullWidth={false}
                disabled={isBusy}
                leftIcon={<Check className='h-4 w-4' aria-hidden='true' />}
                onClick={() => {
                  setIsConfirmingApprove(true);
                }}
              >
                Подтвердить
              </Button>
              <Button
                type='button'
                size='sm'
                variant='secondary'
                fullWidth={false}
                loading={isRejecting}
                loadingText='Отклоняем…'
                disabled={isApproving}
                leftIcon={<X className='h-4 w-4' aria-hidden='true' />}
                onClick={handleReject}
              >
                Отклонить
              </Button>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
