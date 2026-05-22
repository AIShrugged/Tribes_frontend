'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import { useController, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createAgentProfile,
  updateAgentProfile,
  validateAgentProfilePayload,
} from '@/features/agents/api/agent-profiles';
import { normalizeAllowedTools } from '@/features/agents/lib/format';
import { parseJsonInput, stringifyJson } from '@/features/agents/lib/json';
import {
  agentProfileCreateSchema,
  agentProfileEditSchema,
} from '@/features/agents/model/schemas';
import { AGENT_EXECUTION_MODES } from '@/features/agents/model/types';
import { AgentPromptVersionHistory } from '@/features/agents/ui/agent-prompt-version-history';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/input';
import Input from '@/shared/ui/input/Input';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import InputTextarea from '@/shared/ui/input/InputTextarea';

import type {
  AgentProfileCreateValues,
  AgentProfileEditValues,
} from '@/features/agents/model/schemas';
import type {
  AgentProfile,
  AgentProfileCreatePayload,
  AgentProfileUpdatePayload,
  AgentSelectOption,
} from '@/features/agents/model/types';
import type { Resolver } from 'react-hook-form';

type FormValues = (AgentProfileCreateValues | AgentProfileEditValues) & {
  validation_payload: string;
};

const EXECUTION_MODE_OPTIONS = AGENT_EXECUTION_MODES.map((mode) => {
  return {
    value: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
  };
});

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
  const [isSavePending, startSave] = useTransition();
  const [isValidatePending, startValidate] = useTransition();
  const isEdit = Boolean(profile?.id);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const buildDefaultValues = (p?: AgentProfile): FormValues => {
    return {
      key: p?.key ?? '',
      name: p?.name ?? '',
      description: p?.description ?? '',
      system_prompt: p?.system_prompt ?? '',
      sandbox_profile: p?.sandbox_profile ?? '',
      ...(isEdit
        ? {}
        : { allowed_tools: normalizeAllowedTools(p?.allowed_tools) }),
      allowed_outbound_hosts: (p?.allowed_outbound_hosts ?? []).join('\n'),
      execution_mode: p?.execution_mode ?? null,
      default_model: p?.default_model ?? '',
      enabled: p?.enabled ?? true,
      config_schema: stringifyJson(p?.config_schema),
      task_payload_schema: stringifyJson(p?.task_payload_schema),
      metadata: stringifyJson(p?.metadata),
      validation_payload: '',
    } as FormValues;
  };

  const defaultValues = useMemo<FormValues>(() => {
    return buildDefaultValues(profile);
  }, [profile]);

  const schema = isEdit ? agentProfileEditSchema : agentProfileCreateSchema;

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues,
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const {
    fieldState: { isDirty: isKeyDirty },
  } = useController({
    name: 'key',
    control,
  });

  const nameValue = watch('name');

  useEffect(() => {
    if (!isEdit && !isKeyDirty) {
      const slug = nameValue
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-|-$/g, '');
      setValue('key', slug, { shouldDirty: false });
    }
  }, [nameValue, isEdit, isKeyDirty, setValue]);

  const onSubmit = (values: FormValues) => {
    if (isValidatePending) return;

    startSave(async () => {
      const ac = new AbortController();
      abortRef.current = ac;

      const hostsRaw = values.allowed_outbound_hosts;
      const hosts = hostsRaw
        .split('\n')
        .map((h) => {
          return h.trim();
        })
        .filter(Boolean);
      const hostnameRegex =
        /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      const invalid = hosts.filter((h) => {
        return !hostnameRegex.test(h);
      });

      if (invalid.length > 0) {
        setError('allowed_outbound_hosts', {
          message: `Invalid hostnames: ${invalid.join(', ')}`,
        });

        return;
      }

      let config_schema: Record<string, unknown> | null = null;
      let task_payload_schema: Record<string, unknown> | null = null;
      let metadata: Record<string, unknown> | null = null;

      try {
        config_schema = parseJsonInput(values.config_schema);
      } catch (error) {
        setError('config_schema', { message: (error as Error).message });

        return;
      }

      try {
        task_payload_schema = parseJsonInput(values.task_payload_schema);
      } catch (error) {
        setError('task_payload_schema', { message: (error as Error).message });

        return;
      }

      try {
        metadata = parseJsonInput(values.metadata);
      } catch (error) {
        setError('metadata', { message: (error as Error).message });

        return;
      }

      const updatePayload: AgentProfileUpdatePayload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        system_prompt: values.system_prompt.trim() || null,
        sandbox_profile: values.sandbox_profile || null,
        allowed_outbound_hosts: hosts,
        execution_mode: values.execution_mode ?? null,
        default_model: values.default_model.trim() || null,
        enabled: values.enabled,
        config_schema,
        task_payload_schema,
        metadata,
      };

      const result =
        isEdit && profile
          ? await updateAgentProfile(profile.id, updatePayload)
          : await createAgentProfile({
              ...updatePayload,
              key: (values as AgentProfileCreateValues).key,
              allowed_tools: (values as AgentProfileCreateValues).allowed_tools,
            } as AgentProfileCreatePayload);

      if (ac.signal.aborted) return;

      if (result.error !== null) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          if (field in defaultValues) {
            setError(field as keyof FormValues, { message });
          }
        }
        toast.error(result.error);

        return;
      }

      toast.success(isEdit ? 'Agent profile updated' : 'Agent profile created');
      router.push(ROUTES.DASHBOARD.AGENT_PROFILE_OVERVIEW(result.data.id));
    });
  };

  return (
    <form className='flex flex-col gap-6' onSubmit={handleSubmit(onSubmit)}>
      {/* Section 1 — Identity */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Input
          {...register('name')}
          label='Name'
          value={watch('name')}
          error={errors.name?.message}
        />
        {isEdit ? (
          <div className='flex flex-col gap-1'>
            <p className='text-xs text-muted-foreground'>Key</p>
            <code className='font-mono text-sm text-foreground'>
              {profile?.key}
            </code>
          </div>
        ) : (
          <Input
            {...register('key')}
            label='Key'
            value={watch('key')}
            error={
              (errors as Record<string, { message?: string }>).key?.message
            }
            placeholder='auto-generated from name'
          />
        )}
      </div>

      {/* Section 2 — Behavior */}
      <div className='flex flex-col gap-4 border-t border-border pt-4'>
        <InputTextarea
          {...register('description')}
          label='Description'
          value={watch('description')}
          error={errors.description?.message}
        />

        <div className='flex flex-col gap-1'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-muted-foreground'>System Prompt</span>
            {isEdit && profile && (
              <AgentPromptVersionHistory
                profileId={profile.id}
                currentVersion={profile.version}
                disabled={isDirty}
                onRestored={(restoredProfile) => {
                  reset(buildDefaultValues(restoredProfile));
                }}
              />
            )}
          </div>
          <InputTextarea
            {...register('system_prompt')}
            value={watch('system_prompt')}
            error={errors.system_prompt?.message}
            rows={6}
          />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <InputDropdown
            label='Execution mode'
            options={[
              { value: '', label: '— none —' },
              ...EXECUTION_MODE_OPTIONS,
            ]}
            value={watch('execution_mode') ?? ''}
            onChange={(value) => {
              const v = value as string;
              setValue(
                'execution_mode',
                AGENT_EXECUTION_MODES.includes(
                  v as (typeof AGENT_EXECUTION_MODES)[number],
                )
                  ? (v as (typeof AGENT_EXECUTION_MODES)[number])
                  : null,
                { shouldDirty: true },
              );
            }}
            error={errors.execution_mode?.message}
          />
          <Input
            {...register('default_model')}
            label='Default model'
            value={watch('default_model')}
            error={errors.default_model?.message}
            placeholder='e.g. claude-sonnet-4-6'
          />
        </div>

        <Checkbox
          {...register('enabled')}
          label='Enabled'
          checked={watch('enabled')}
          onChange={(e) => {
            setValue('enabled', e.target.checked, { shouldDirty: true });
          }}
        />
      </div>

      {/* Section 3 — Access & Tools */}
      <div className='flex flex-col gap-4 border-t border-border pt-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <InputDropdown
            label='Sandbox profile'
            options={sandboxOptions}
            value={watch('sandbox_profile')}
            onChange={(value) => {
              setValue('sandbox_profile', value as string, {
                shouldDirty: true,
              });
              clearErrors('sandbox_profile');
            }}
            error={errors.sandbox_profile?.message}
            searchable
          />
          {/* Only on create — backend returns 422 if sent in PATCH */}
          {!isEdit && (
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
              value={
                (watch as (name: string) => string[])('allowed_tools') ?? []
              }
              onChange={(value) => {
                (
                  setValue as (
                    name: string,
                    value: unknown,
                    opts?: object,
                  ) => void
                )('allowed_tools', value, { shouldDirty: true });
                clearErrors('allowed_tools' as keyof FormValues);
              }}
              error={
                (errors as Record<string, { message?: string }>).allowed_tools
                  ?.message
              }
              searchable
              multiple
            />
          )}
        </div>

        <InputTextarea
          {...register('allowed_outbound_hosts')}
          label='Allowed outbound hosts (one per line)'
          value={watch('allowed_outbound_hosts')}
          error={errors.allowed_outbound_hosts?.message}
          placeholder={'api.example.com\n*.partner.io'}
          rows={3}
        />
      </div>

      {/* Section 4 — Schemas & Metadata */}
      <div className='flex flex-col gap-4 border-t border-border pt-4'>
        <InputTextarea
          {...register('config_schema')}
          label='Config Schema JSON'
          value={watch('config_schema')}
          error={errors.config_schema?.message}
          rows={4}
        />

        <InputTextarea
          {...register('task_payload_schema')}
          label='Task Payload Schema JSON'
          value={watch('task_payload_schema')}
          error={errors.task_payload_schema?.message}
          rows={4}
        />

        <InputTextarea
          {...register('metadata')}
          label='Metadata JSON'
          value={watch('metadata')}
          error={errors.metadata?.message}
          rows={3}
        />
      </div>

      {/* Payload validation (edit mode only) */}
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
              loading={isValidatePending}
              onClick={() => {
                startValidate(async () => {
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
          loading={isSavePending}
          disabled={!isDirty && isEdit}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
