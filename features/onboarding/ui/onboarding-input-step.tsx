'use client';

import { Link2, Plus, X } from 'lucide-react';

import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import { ButtonIcon } from '@/shared/ui/button/button-icon';
import { Pill } from '@/shared/ui/common';
import Input from '@/shared/ui/input/Input';
import Textarea from '@/shared/ui/input/textarea';

import { OnboardingFileUpload } from './onboarding-file-upload';

import type { InputState, NeedsInfoData, TemplateValue } from '../model/types';

const TEMPLATE_OPTIONS: Array<{ value: TemplateValue; label: string }> = [
  { value: 'IT', label: 'IT' },
];

const MAX_LINKS = 5;

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
        <h1 className='text-2xl font-semibold text-foreground'>
          {isRefine
            ? 'A few more details needed'
            : 'Tell us about your organization'}
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {isRefine
            ? 'Our AI needs a bit more context to generate the best structure for you.'
            : 'Describe your company, team, or project. The more detail you provide, the better.'}
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

      <Textarea
        label='Description'
        value={state.description}
        placeholder='e.g. We are a 40-person SaaS company building HR tools for enterprise clients...'
        onChange={(e) => {
          return onDescriptionChange(e.target.value);
        }}
      />

      <fieldset className='border-none m-0 p-0 flex flex-col gap-2'>
        <legend className='text-sm font-medium text-foreground mb-2'>
          Industry template
        </legend>
        <div className='flex flex-wrap gap-2'>
          {TEMPLATE_OPTIONS.map((t) => {
            return (
              <Pill
                key={t.value}
                active={template === t.value}
                onClick={() => {
                  return onTemplateChange(
                    template === t.value ? null : t.value,
                  );
                }}
              >
                {t.label}
              </Pill>
            );
          })}
        </div>
      </fieldset>

      {/* URL slots */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-foreground'>
            Links{' '}
            <span className='text-muted-foreground'>
              ({state.links.length}/{MAX_LINKS})
            </span>
          </span>
          {state.links.length < MAX_LINKS && (
            <Button
              type='button'
              variant={BUTTON_VARIANT.secondary}
              fullWidth={false}
              className='h-7 gap-1 px-2 text-xs'
              onClick={onLinkAdd}
            >
              <Plus className='h-3 w-3' />
              Add link
            </Button>
          )}
        </div>

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

      <div className='flex items-center justify-between gap-3 pt-2'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.ghost}
          className='text-muted-foreground'
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          type='button'
          variant={BUTTON_VARIANT.primary}
          disabled={isSubmitting || hasFilePending || !hasAnyInput}
          onClick={onSubmit}
        >
          {getSubmitLabel(isSubmitting, hasFilePending, isRefine)}
        </Button>
      </div>
    </div>
  );
}
