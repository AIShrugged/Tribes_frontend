'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { enableBrainSchema } from '@/features/brain/model/schemas';
import { BUTTON_SIZE, BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { InputPassword } from '@/shared/ui/input';

import type { EnableBrainFormValues } from '@/features/brain/model/schemas';
import type {
  ClaudeAuthType,
  EnableBrainPayload,
} from '@/features/brain/model/types';

const AUTH_OPTIONS: readonly {
  value: ClaudeAuthType;
  title: string;
  hint: string;
}[] = [
  {
    value: 'oauth',
    title: 'Подписка Claude',
    hint: 'Токен подписки Claude Pro/Max (начинается с «sk-ant-oat01-…»). Оплата входит в подписку.',
  },
  {
    value: 'api_key',
    title: 'API-ключ Anthropic',
    hint: 'Ключ Anthropic API (начинается с «sk-ant-api03-…»). Оплата за использование.',
  },
];

interface Props {
  /** Preselected auth type — the current mode when rotating a credential. */
  defaultAuthType?: ClaudeAuthType | null;
  submitLabel: string;
  /**
   * Runs the enable action. Returns `{ fieldErrors }` (from a 422) so the form
   * can highlight the token field; returns void/undefined on success (the
   * parent unmounts the form).
   */
  onSubmit: (
    payload: EnableBrainPayload,
  ) => Promise<{ fieldErrors?: Record<string, string> } | void>;
  onCancel: () => void;
}

/**
 * Credential form for enabling / rotating a second brain: radio choice between
 * a Claude subscription token (oauth) and an Anthropic API key (api_key), plus
 * the secret itself. Used for the first enable and for credential rotation.
 * @param props - Component props.
 * @param props.defaultAuthType - preselected auth type.
 * @param props.submitLabel - submit button text.
 * @param props.onSubmit - runs the enable action.
 * @param props.onCancel - closes the form without submitting.
 */
export function BrainCredentialForm({
  defaultAuthType,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EnableBrainFormValues>({
    resolver: zodResolver(enableBrainSchema),
    defaultValues: {
      claude_auth_type: defaultAuthType ?? 'oauth',
      claude_auth_token: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    const tokenError = result?.fieldErrors?.claude_auth_token;

    if (tokenError) {
      setError('claude_auth_token', { message: tokenError });
    }
  });

  return (
    <form
      onSubmit={submit}
      className='flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--divider)] bg-[var(--surface-2)] p-4'
    >
      <Controller
        control={control}
        name='claude_auth_type'
        render={({ field }) => {
          return (
            <fieldset className='flex flex-col gap-2' disabled={isSubmitting}>
              <legend className='mb-1 text-xs font-medium text-[var(--muted-foreground)]'>
                Тип авторизации
              </legend>
              {AUTH_OPTIONS.map((option) => {
                const isChecked = field.value === option.value;

                return (
                  <label
                    key={option.value}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-[var(--r-md)] border p-3 transition-colors',
                      isChecked
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)]',
                    ].join(' ')}
                  >
                    <input
                      type='radio'
                      name={field.name}
                      value={option.value}
                      checked={isChecked}
                      onChange={() => {
                        field.onChange(option.value);
                      }}
                      onBlur={field.onBlur}
                      className='mt-1 accent-[var(--primary)]'
                    />
                    <span className='flex flex-col gap-0.5'>
                      <span className='text-sm font-medium text-[var(--foreground)]'>
                        {option.title}
                      </span>
                      <span className='text-xs text-[var(--muted-foreground)]'>
                        {option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        }}
      />

      <Controller
        control={control}
        name='claude_auth_token'
        render={({ field }) => {
          return (
            <InputPassword
              label='Токен / API-ключ'
              value={field.value}
              onChange={(event) => {
                field.onChange(event.target.value);
              }}
              onBlur={field.onBlur}
              disabled={isSubmitting}
              autoComplete='off'
              error={errors.claude_auth_token?.message}
            />
          );
        }}
      />

      <div className='flex gap-2'>
        <Button
          type='submit'
          size={BUTTON_SIZE.sm}
          fullWidth={false}
          loading={isSubmitting}
          loadingText='Сохраняем…'
        >
          {submitLabel}
        </Button>
        <Button
          type='button'
          variant={BUTTON_VARIANT.ghost}
          size={BUTTON_SIZE.sm}
          fullWidth={false}
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}
