'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createAgentProfile,
  updateAgentProfile,
  validateAgentProfilePayload,
} from '@/features/agents/api/agents';
import { normalizeAllowedTools } from '@/features/agents/lib/format';
import { parseJsonInput, stringifyJson } from '@/features/agents/lib/json';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import Input from '@/shared/ui/input/Input';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import InputTextarea from '@/shared/ui/input/InputTextarea';

import type {
  AgentProfile,
  AgentSelectOption,
} from '@/features/agents/model/types';

interface AgentProfileFormValues {
  name: string;
  description: string;
  system_prompt: string;
  metadata: string;
  sandbox_profile: string;
  allowed_tools: string[];
  model: string;
  config: string;
  validation_payload: string;
}

/**
 *
 * @param root0
 * @param root0.profile
 * @param root0.sandboxOptions
 * @param root0.toolOptions
 */
export function AgentProfileForm({
  profile,
  sandboxOptions,
  toolOptions,
}: {
  profile?: AgentProfile;
  sandboxOptions: AgentSelectOption[];
  toolOptions: AgentSelectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(profile?.id);
  const defaultValues = useMemo<AgentProfileFormValues>(() => {
    return {
      name: profile?.name ?? '',
      description: profile?.description ?? '',
      system_prompt: profile?.system_prompt ?? '',
      metadata: stringifyJson(profile?.metadata),
      sandbox_profile: profile?.sandbox_profile ?? '',
      allowed_tools: normalizeAllowedTools(profile?.allowed_tools),
      model: profile?.model ?? '',
      config: stringifyJson(profile?.config),
      validation_payload: '',
    };
  }, [profile]);
  const {
    register,
    watch,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<AgentProfileFormValues>({
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  /**
   *
   * @param values
   */
  const onSubmit = (values: AgentProfileFormValues) => {
    startTransition(async () => {
      let config: Record<string, unknown> | null = null;
      let metadata: Record<string, unknown> | null = null;

      try {
        config = parseJsonInput(values.config);
      } catch (error) {
        setError('config', { message: (error as Error).message });

        return;
      }

      try {
        metadata = parseJsonInput(values.metadata);
      } catch (error) {
        setError('metadata', { message: (error as Error).message });

        return;
      }

      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        system_prompt: values.system_prompt.trim() || null,
        metadata,
        sandbox_profile: values.sandbox_profile || null,
        allowed_tools: values.allowed_tools,
        ...(values.model.trim() ? { model: values.model.trim() } : {}),
        ...(config ? { config } : {}),
      };
      const result =
        isEdit && profile
          ? await updateAgentProfile(profile.id, payload)
          : await createAgentProfile(payload);

      if (result.error !== null) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          if (field in defaultValues) {
            setError(field as keyof AgentProfileFormValues, { message });
          }
        }
        toast.error(result.error);

        return;
      }

      toast.success(isEdit ? 'Agent profile updated' : 'Agent profile created');
      router.push(`${ROUTES.DASHBOARD.AGENT_PROFILES}/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form className='flex flex-col gap-4' onSubmit={handleSubmit(onSubmit)}>
      <div className='grid gap-4 md:grid-cols-2'>
        <Input
          {...register('name')}
          label='Name'
          value={watch('name')}
          error={errors.name?.message}
        />
        <Input
          {...register('model')}
          label='Model'
          value={watch('model')}
          error={errors.model?.message}
        />
      </div>

      <InputTextarea
        {...register('description')}
        label='Description'
        value={watch('description')}
        error={errors.description?.message}
      />

      <InputTextarea
        {...register('system_prompt')}
        label='System Prompt'
        value={watch('system_prompt')}
        error={errors.system_prompt?.message}
      />

      <InputTextarea
        {...register('metadata')}
        label='Metadata JSON'
        value={watch('metadata')}
        error={errors.metadata?.message}
      />

      <div className='grid gap-4 md:grid-cols-2'>
        <InputDropdown
          label='Sandbox profile'
          options={sandboxOptions}
          value={watch('sandbox_profile')}
          onChange={(value) => {
            setValue('sandbox_profile', value as string, { shouldDirty: true });
            clearErrors('sandbox_profile');
          }}
          error={errors.sandbox_profile?.message}
          searchable
        />
        <InputDropdown
          label='Allowed tools'
          options={toolOptions.map((tool) => {
            return {
              value: tool.value,
              label: tool.description
                ? `${tool.label} — ${tool.description}`
                : tool.label,
            };
          })}
          value={watch('allowed_tools')}
          onChange={(value) => {
            setValue('allowed_tools', value as string[], { shouldDirty: true });
            clearErrors('allowed_tools');
          }}
          error={errors.allowed_tools?.message}
          searchable
          multiple
        />
      </div>

      <InputTextarea
        {...register('config')}
        label='Config JSON'
        value={watch('config')}
        error={errors.config?.message}
      />

      {isEdit ? (
        <div className='rounded-[var(--radius-card)] border border-border p-4'>
          <InputTextarea
            {...register('validation_payload')}
            label='Validate payload JSON'
            value={watch('validation_payload')}
            error={errors.validation_payload?.message}
          />
          <div className='mt-3 flex justify-end'>
            <Button
              type='button'
              variant={BUTTON_VARIANT.secondary}
              className='w-auto'
              loading={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const payload = parseJsonInput(watch('validation_payload'));

                    if (!profile) return;

                    const result = await validateAgentProfilePayload(
                      profile.id,
                      payload,
                    );

                    if (result.error !== null) {
                      toast.error(result.error);

                      return;
                    }

                    toast.success('Payload is valid');
                  } catch (error) {
                    setError('validation_payload', {
                      message: (error as Error).message,
                    });
                  }
                });
              }}
            >
              Validate payload
            </Button>
          </div>
        </div>
      ) : null}

      <div className='flex justify-end'>
        <Button
          type='submit'
          className='w-auto'
          loading={isPending}
          disabled={!isDirty && isEdit}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
