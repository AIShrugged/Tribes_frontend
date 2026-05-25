'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { resetLlmPrompt, updateLlmPrompt } from '@/features/llm-prompts/api/llm-prompts';
import {
  buildSegments,
  diffPlaceholders,
  extractPlaceholders,
  PLACEHOLDER_PATTERN,
} from '@/features/llm-prompts/lib/placeholders';
import { llmPromptUpdateSchema } from '@/features/llm-prompts/model/schemas';
import { useDebounce } from '@/shared/hooks';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import ButtonBack from '@/shared/ui/button/button-back';
import ButtonCopy from '@/shared/ui/button/button-copy';

import type { LlmPromptUpdatePayload } from '@/features/llm-prompts/model/schemas';
import type { LlmPromptProps } from '@/features/llm-prompts/model/types';
import type { TextareaHTMLAttributes } from 'react';

const HIGHLIGHT_DEBOUNCE_MS = 250;

// ResetState machine prevents double-boolean bugs
type ResetState = 'idle' | 'confirming' | 'submitting';

interface HighlightedTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

/**
 * HighlightedTextarea — textarea with a mirror div that highlights {placeholder} tokens in violet.
 * Mirror div uses React JSX children — never innerHTML (XSS-safe).
 * @param root0 - Component props.
 * @param root0.value - Current textarea value.
 * @param root0.onChange - Change callback (string value).
 * @param root0.disabled - Whether the textarea is disabled.
 * @param root0.hasError - Whether to show error border.
 * @returns JSX element.
 */
function HighlightedTextarea({
  value,
  onChange,
  disabled = false,
  hasError = false,
  ...rest
}: HighlightedTextareaProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedValue = useDebounce(value, HIGHLIGHT_DEBOUNCE_MS);

  const segments = debouncedValue
    ? buildSegments(debouncedValue, PLACEHOLDER_PATTERN)
    : [{ text: '', isToken: false }];

  // Apply computed font metrics from textarea to mirror (prevents font drift)
  useEffect(() => {
    const ta = textareaRef.current;
    const m = mirrorRef.current;

    if (!ta || !m) return;

    const s = getComputedStyle(ta);

    m.style.fontFamily = s.fontFamily;
    m.style.fontSize = s.fontSize;
    m.style.lineHeight = s.lineHeight;
    m.style.letterSpacing = s.letterSpacing;
    m.style.padding = s.padding;
  }, []);

  // Scroll sync — passive + rAF to avoid jank
  useEffect(() => {
    const ta = textareaRef.current;
    const m = mirrorRef.current;

    if (!ta || !m) return;

    let rafId: number;

    const syncScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (m && ta) m.scrollTop = ta.scrollTop;
      });
    };

    ta.addEventListener('scroll', syncScroll, { passive: true });

    return () => {
      ta.removeEventListener('scroll', syncScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ResizeObserver to re-sync font metrics when user resizes the textarea
  useEffect(() => {
    const ta = textareaRef.current;
    const m = mirrorRef.current;

    if (!ta || !m) return;

    const observer = new ResizeObserver(() => {
      const s = getComputedStyle(ta);

      m.style.fontFamily = s.fontFamily;
      m.style.fontSize = s.fontSize;
      m.style.lineHeight = s.lineHeight;
      m.style.letterSpacing = s.letterSpacing;
      m.style.padding = s.padding;
    });

    observer.observe(ta);

    return () => {
      observer.disconnect();
    };
  }, []);

  const borderClass = hasError
    ? 'border-destructive'
    : 'border-border focus-within:border-[var(--ring)]';

  return (
    <div
      className={`relative overflow-hidden rounded-md border bg-background transition-colors ${borderClass}`}
    >
      {/* Mirror div — aria-hidden so screen readers skip it */}
      <div
        ref={mirrorRef}
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words text-transparent'
        style={{
          margin: 0,
          borderRadius: 0,
          WebkitAppearance: 'none' as never,
          boxSizing: 'border-box',
          wordBreak: 'break-word',
        }}
      >
        {segments.map((seg, i) => {
          return seg.isToken ? (
            <mark
              key={i}
              className='rounded-sm bg-violet-500/20 px-0.5 text-transparent'
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          );
        })}
        {/* Trailing newline fix — prevents 1-line height misalignment */}
        {'​'}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled}
        maxLength={100_000}
        className='relative z-10 min-h-[280px] w-full resize-y bg-transparent font-mono text-sm leading-relaxed focus:outline-none'
        style={{
          margin: 0,
          borderRadius: 0,
          WebkitAppearance: 'none' as never,
          boxSizing: 'border-box',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          padding: '12px',
        }}
        {...rest}
      />
    </div>
  );
}

type SetErrorFn = (field: 'name' | 'prompt', config: { message: string }) => void;

function applyFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  setError: SetErrorFn,
): void {
  if (!fieldErrors) return;

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (field === 'name' || field === 'prompt') {
      setError(field, { message });
    }
  }
}

/**
 * LlmPromptForm — edit form for a single LLM prompt.
 * Includes HighlightedTextarea, placeholder warning, and Reset to Default flow.
 * @param root0 - Component props.
 * @param root0.prompt - The prompt to edit.
 * @param root0.canEdit - Whether the current user has manager access.
 * @param root0.organizationId - The active organization's ID.
 * @returns JSX element.
 */
export function LlmPromptForm({
  prompt,
  canEdit,
  organizationId,
}: {
  prompt: LlmPromptProps;
  canEdit: boolean;
  organizationId: number;
}) {
  const router = useRouter();
  const [isSavePending, startSave] = useTransition();
  const [isResetPending, startReset] = useTransition();
  const [resetState, setResetState] = useState<ResetState>('idle');
  const [removedPlaceholders, setRemovedPlaceholders] = useState<string[]>([]);

  const originalPlaceholders = extractPlaceholders(prompt.prompt);

  const {
    handleSubmit,
    register,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<LlmPromptUpdatePayload>({
    defaultValues: {
      name: prompt.name,
      prompt: prompt.prompt,
    },
    resolver: zodResolver(llmPromptUpdateSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const promptValue = watch('prompt');

  const onSubmit = (values: LlmPromptUpdatePayload) => {
    // Check for removed placeholders before saving
    const currentPlaceholders = extractPlaceholders(values.prompt);
    const removed = diffPlaceholders(originalPlaceholders, currentPlaceholders);

    if (removed.length > 0 && removedPlaceholders.length === 0) {
      setRemovedPlaceholders(removed);

      return;
    }

    setRemovedPlaceholders([]);
    startSave(async () => {
      const result = await updateLlmPrompt(organizationId, prompt.id, values);

      if (result.error !== null) {
        applyFieldErrors(result.fieldErrors, setError);
        toast.error(result.error);

        return;
      }

      reset({ name: result.data.name, prompt: result.data.prompt });
      toast.success('Prompt saved');
    });
  };

  const handleReset = () => {
    setResetState('submitting');
    startReset(async () => {
      const result = await resetLlmPrompt(organizationId, prompt.id);

      if (result.error !== null) {
        toast.error(result.error);
        setResetState('idle');

        return;
      }

      reset({ name: result.data.name, prompt: result.data.prompt });
      setResetState('idle');
      toast.success('Prompt reset to default');
    });
  };

  const isPending = isSavePending || isResetPending;

  return (
    <div className='flex flex-col gap-6'>
      {/* Page header */}
      <div className='flex items-start gap-3'>
        <ButtonBack href={ROUTES.DASHBOARD.AGENT_PROMPTS} />
        <div className='flex flex-1 flex-col gap-1'>
          <div className='flex items-center gap-3'>
            <h1 className='text-xl font-semibold'>{prompt.name}</h1>
            {isDirty && (
              <span
                role='status'
                className='flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500'
              >
                <span className='h-1.5 w-1.5 rounded-full bg-amber-500' />
                Unsaved changes
              </span>
            )}
          </div>
          <p className='text-sm text-muted-foreground'>
            LLM Prompt Template
          </p>
        </div>
      </div>

      {/* Slug row (read-only) */}
      <div className='flex flex-col gap-1'>
        <label className='text-xs font-medium text-muted-foreground'>Slug</label>
        <div className='flex items-center gap-2 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2'>
          <code className='flex-1 font-mono text-sm text-foreground'>{prompt.slug}</code>
          <ButtonCopy copyText={prompt.slug} />
        </div>
      </div>

      {canEdit ? (
        <form
          className='flex flex-col gap-6'
          onSubmit={handleSubmit(onSubmit)}
        >
          {/* Name field */}
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground' htmlFor='prompt-name'>
              Name
            </label>
            <input
              id='prompt-name'
              {...register('name')}
              disabled={isPending}
              maxLength={255}
              className='h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50'
            />
            {errors.name?.message && (
              <p className='text-xs text-destructive'>{errors.name.message}</p>
            )}
          </div>

          {/* Prompt field with highlighted textarea */}
          <div className='flex flex-col gap-1'>
            <div className='flex items-center justify-between'>
              <label className='text-xs font-medium text-muted-foreground' htmlFor='prompt-text'>
                Prompt
              </label>
            </div>
            <HighlightedTextarea
              id='prompt-text'
              value={promptValue}
              onChange={(val) => {
                setValue('prompt', val, { shouldDirty: true, shouldValidate: false });
              }}
              disabled={isPending}
              hasError={Boolean(errors.prompt?.message)}
              aria-describedby={errors.prompt?.message ? 'prompt-error' : undefined}
            />
            {errors.prompt?.message && (
              <p id='prompt-error' className='text-xs text-destructive'>
                {errors.prompt.message}
              </p>
            )}
          </div>

          {/* Placeholder removal warning */}
          {removedPlaceholders.length > 0 && (
            <div
              role='alert'
              className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-amber-500/30 bg-amber-500/5 p-4'
            >
              <div className='flex items-start gap-2'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-amber-500' />
                <p className='text-sm text-foreground'>
                  You removed{' '}
                  <strong>{removedPlaceholders.length}</strong>{' '}
                  placeholder{removedPlaceholders.length === 1 ? '' : 's'}:{' '}
                  <code className='text-amber-400'>
                    {removedPlaceholders.join(', ')}
                  </code>
                  . This may break AI responses. Save anyway?
                </p>
              </div>
              <div className='flex gap-2'>
                <Button
                  type='submit'
                  variant={BUTTON_VARIANT.danger}
                  size={BUTTON_SIZE.sm}
                  fullWidth={false}
                  loading={isSavePending}
                >
                  Save anyway
                </Button>
                <Button
                  type='button'
                  variant={BUTTON_VARIANT.ghost}
                  size={BUTTON_SIZE.sm}
                  fullWidth={false}
                  onClick={() => {
                    setRemovedPlaceholders([]);
                  }}
                >
                  Keep editing
                </Button>
              </div>
            </div>
          )}

          {/* Reset to Default state machine */}
          {resetState === 'confirming' && (
            <div
              role='alert'
              className='flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-[var(--surface-2)] p-4'
            >
              <p className='text-sm font-medium'>
                Reset this prompt to its system default?
              </p>
              <p className='text-xs text-muted-foreground'>
                All your customizations will be replaced with the original system prompt text.
              </p>
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant={BUTTON_VARIANT.danger}
                  size={BUTTON_SIZE.sm}
                  fullWidth={false}
                  loading={isResetPending}
                  onClick={handleReset}
                >
                  Confirm Reset
                </Button>
                <Button
                  type='button'
                  variant={BUTTON_VARIANT.ghost}
                  size={BUTTON_SIZE.sm}
                  fullWidth={false}
                  disabled={isResetPending}
                  onClick={() => {
                    setResetState('idle');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {resetState !== 'confirming' && (
            <div className='flex items-center gap-2 border-t border-border pt-4'>
              <Button
                type='submit'
                fullWidth={false}
                size={BUTTON_SIZE.md}
                loading={isSavePending}
                disabled={!isDirty || isPending}
                leftIcon={<Save className='h-4 w-4' />}
              >
                Save
              </Button>
              <Button
                type='button'
                variant={BUTTON_VARIANT.secondary}
                fullWidth={false}
                size={BUTTON_SIZE.md}
                disabled={isPending}
                leftIcon={<RotateCcw className='h-4 w-4' />}
                onClick={() => {
                  setResetState('confirming');
                }}
              >
                Reset to Default
              </Button>
              <Button
                type='button'
                variant={BUTTON_VARIANT.ghost}
                fullWidth={false}
                size={BUTTON_SIZE.md}
                disabled={isPending}
                onClick={() => {
                  router.push(ROUTES.DASHBOARD.AGENT_PROMPTS);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </form>
      ) : (
        /* Read-only view for non-managers */
        <div className='flex flex-col gap-6'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Name</label>
            <p className='text-sm text-foreground'>{prompt.name}</p>
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Prompt</label>
            <pre className='whitespace-pre-wrap rounded-md border border-border bg-[var(--surface-2)] p-3 font-mono text-sm leading-relaxed text-foreground'>
              {prompt.prompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
