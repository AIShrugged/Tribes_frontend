'use client';

import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  Link2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import { ButtonIcon } from '@/shared/ui/button/button-icon';
import Input from '@/shared/ui/input/Input';

import { OnboardingFileUpload } from './onboarding-file-upload';

import type { InputState, NeedsInfoData, TemplateValue } from '../model/types';

const TEMPLATE_OPTIONS: Array<{
  value: TemplateValue;
  label: string;
  description: string;
}> = [
  {
    value: 'IT',
    label: 'IT & Software',
    description: 'Engineering teams',
  },
];

const MAX_LINKS = 5;
const DESCRIPTION_MAX_LENGTH = 20_000;

function getSubmitLabel(
  isSubmitting: boolean,
  hasFilePending: boolean,
  isRefine: boolean,
) {
  if (isSubmitting) return 'Generating...';
  if (hasFilePending) return 'Uploading file...';

  return isRefine ? 'Regenerate' : 'Generate structure';
}

interface Props {
  state: InputState;
  needsInfoData?: NeedsInfoData;
  isSubmitting: boolean;
  hasFilePending: boolean;
  template: TemplateValue | null;
  organizationId: number;
  onTemplateChange: (value: TemplateValue | null) => void;
  onDescriptionChange: (value: string) => void;
  onLinkAdd: () => void;
  onLinkChange: (index: number, value: string) => void;
  onLinkRemove: (index: number) => void;
  onUploaded: (attachment: InputState['attachments'][number]) => void;
  onDeleted: (attachmentId: number) => void;
  onPendingChange: (hasPending: boolean) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export function OnboardingInputStep({
  state,
  needsInfoData,
  isSubmitting,
  hasFilePending,
  template,
  organizationId,
  onTemplateChange,
  onDescriptionChange,
  onLinkAdd,
  onLinkChange,
  onLinkRemove,
  onUploaded,
  onDeleted,
  onPendingChange,
  onSubmit,
  onSkip,
}: Props) {
  const isRefine = Boolean(needsInfoData);

  const hasAnyInput =
    state.description.trim().length > 0 ||
    state.attachments.length > 0 ||
    state.links.some(Boolean) ||
    template !== null;

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-[clamp(1.375rem,2vw,1.75rem)] font-semibold leading-tight tracking-normal text-foreground'>
          {isRefine
            ? 'A few more details needed'
            : 'Tell us about your organization'}
        </h1>
        <p className='mt-2 text-[clamp(0.875rem,1.2vw,1rem)] leading-6 text-muted-foreground'>
          {isRefine
            ? 'Our AI needs a bit more context to generate the best structure for you.'
            : 'The more detail you give, the better the first draft will be.'}
        </p>
      </div>

      {needsInfoData && (
        <div className='rounded-[var(--radius-card)] border border-border bg-surface/40 p-4 flex flex-col gap-3'>
          <p className='text-sm text-foreground'>{needsInfoData.message}</p>
          {needsInfoData.questions.length > 0 && (
            <ul className='flex flex-col gap-1.5 pl-4'>
              {needsInfoData.questions.map((q, i) => {
                return (
                  <li
                    key={i}
                    className='text-sm text-muted-foreground list-disc'
                  >
                    {q}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <label className='flex flex-col gap-2'>
        <span className='flex items-center justify-between gap-3 text-sm font-semibold text-foreground'>
          Description
          <span className='text-xs font-normal text-[var(--neutral-500)]'>
            Required · ⌘+Enter to submit
          </span>
        </span>
        <span className='overflow-hidden rounded-[var(--r-lg)] border border-input bg-[var(--surface-2)] transition-shadow focus-within:border-ring focus-within:shadow-[var(--shadow-focus)]'>
          <textarea
            value={state.description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="e.g. We're a 40-person SaaS company building HR tools for enterprise clients. Our top priority this quarter is shipping the new onboarding flow and reducing churn in the SMB segment."
            className='min-h-[150px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 text-foreground outline-none placeholder:text-[var(--neutral-500)] sm:min-h-[170px]'
            onChange={(e) => {
              return onDescriptionChange(e.target.value);
            }}
          />
          <span className='flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-[var(--neutral-500)]'>
            <span className='inline-flex items-center gap-1.5'>
              <Sparkles className='h-3.5 w-3.5' />
              Tip: mention team size, goals and timelines
            </span>
            <span className='font-semibold tabular-nums text-foreground'>
              {state.description.length} / {DESCRIPTION_MAX_LENGTH}
            </span>
          </span>
        </span>
      </label>

      <fieldset className='border-none m-0 p-0 flex flex-col gap-2'>
        <legend className='mb-1 text-sm font-semibold text-foreground'>
          Industry template
          <span className='ml-2 font-normal text-muted-foreground'>
            Optional
          </span>
        </legend>
        <div className='grid gap-3 sm:grid-cols-2'>
          {TEMPLATE_OPTIONS.map((t) => {
            const isActive = template === t.value;

            return (
              <button
                key={t.value}
                type='button'
                className={[
                  'relative flex min-h-[88px] items-center gap-3 rounded-[var(--r-lg)] border p-4 text-left transition-transform hover:-translate-y-0.5',
                  isActive
                    ? 'border-primary bg-[color-mix(in_oklab,var(--primary)_12%,var(--surface-2))] shadow-[inset_0_0_0_1px_var(--primary)]'
                    : 'border-border bg-[var(--surface-2)] hover:border-[var(--neutral-700)]',
                ].join(' ')}
                onClick={() => {
                  return onTemplateChange(
                    template === t.value ? null : t.value,
                  );
                }}
              >
                <span className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] text-[var(--primary-300)]'>
                  <Building2 className='h-4 w-4' />
                </span>
                <span className='min-w-0'>
                  <span className='block text-sm font-semibold text-foreground'>
                    {t.label}
                  </span>
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {t.description}
                  </span>
                </span>
                {isActive && (
                  <span className='absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                    <Check className='h-3 w-3' />
                  </span>
                )}
              </button>
            );
          })}
          <button
            type='button'
            className='flex min-h-[88px] items-center gap-3 rounded-[var(--r-lg)] border border-border bg-[var(--surface-2)] p-4 text-left text-muted-foreground transition-colors hover:border-primary hover:text-foreground'
            onClick={() => {
              return onTemplateChange(null);
            }}
          >
            <span className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-dashed border-[var(--neutral-700)]'>
              <Plus className='h-4 w-4' />
            </span>
            <span>
              <span className='block text-sm font-semibold'>More soon</span>
              <span className='mt-1 block text-xs'>
                Marketing, Ops, Design...
              </span>
            </span>
          </button>
        </div>
      </fieldset>

      <section className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-foreground'>Add context</h2>
          <span className='text-sm text-muted-foreground'>
            Optional · helps the AI
          </span>
        </div>
        <div className='overflow-hidden rounded-[var(--r-lg)] border border-border bg-[var(--surface-2)]'>
          <div className='flex flex-wrap gap-2 border-b border-border bg-[color-mix(in_oklab,var(--surface-2)_60%,var(--background))] p-2'>
            <span className='inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-[inset_0_1px_0_var(--border)]'>
              <Link2 className='h-3.5 w-3.5' />
              Links
              <span className='rounded-full bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] px-2 py-0.5 text-xs text-[var(--primary-300)]'>
                {state.links.length}/{MAX_LINKS}
              </span>
            </span>
            <span className='inline-flex items-center gap-2 rounded-[var(--r-sm)] px-3 py-1.5 text-sm font-medium text-muted-foreground'>
              <FileText className='h-3.5 w-3.5' />
              Files
              <span className='rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground'>
                {state.attachments.length}
              </span>
            </span>
          </div>

          <div className='flex flex-col gap-3 p-3'>
            <div className='flex flex-col gap-2'>
              {state.links.map((link, index) => {
                return (
                  <div key={index} className='flex items-center gap-2'>
                    <Input
                      value={link}
                      placeholder='https://...'
                      startAdornment={
                        <Link2 className='h-3.5 w-3.5 text-muted-foreground' />
                      }
                      endAdornment={
                        <ButtonIcon
                          icon={<X className='h-3.5 w-3.5' />}
                          aria-label='Remove link'
                          variant='ghost'
                          size='sm'
                          onClickAction={() => {
                            return onLinkRemove(index);
                          }}
                        />
                      }
                      onChange={(e) => {
                        return onLinkChange(index, e.target.value);
                      }}
                    />
                  </div>
                );
              })}

              {state.links.length < MAX_LINKS && (
                <button
                  type='button'
                  className='inline-flex w-fit items-center gap-2 rounded-[var(--r-md)] border border-dashed border-border px-3 py-2 text-sm font-medium text-[var(--primary-300)] transition-colors hover:border-primary hover:bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]'
                  onClick={onLinkAdd}
                >
                  <Plus className='h-4 w-4' />
                  Add another link
                </button>
              )}
            </div>

            {state.uploadToken && (
              <OnboardingFileUpload
                uploadToken={state.uploadToken}
                attachments={state.attachments}
                organizationId={organizationId}
                onUploaded={onUploaded}
                onDeleted={onDeleted}
                onPendingChange={onPendingChange}
              />
            )}
          </div>
        </div>
      </section>

      <div className='flex items-center justify-between gap-3 pt-2'>
        <span className='hidden items-center gap-2 text-xs text-[var(--neutral-500)] sm:inline-flex'>
          <Sparkles className='h-3.5 w-3.5' />
          You can edit the generated plan before saving.
        </span>
        <Button
          type='button'
          variant={BUTTON_VARIANT.ghost}
          fullWidth={false}
          className='text-muted-foreground'
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          type='button'
          variant={BUTTON_VARIANT.primary}
          fullWidth={false}
          rightIcon={<ChevronRight className='h-4 w-4' />}
          disabled={isSubmitting || hasFilePending || !hasAnyInput}
          onClick={onSubmit}
        >
          {getSubmitLabel(isSubmitting, hasFilePending, isRefine)}
        </Button>
      </div>
    </div>
  );
}
