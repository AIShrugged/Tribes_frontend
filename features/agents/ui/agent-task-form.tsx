'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { getTeams } from '@/entities/team/api/team';
import {
  createAgentTask,
  updateAgentTask,
} from '@/features/agents/api/agent-tasks';
import { validateAgentProfilePayload } from '@/features/agents/api/agent-profiles';
import { normalizeAllowedTools } from '@/features/agents/lib/format';
import { parseJsonInput, stringifyJson } from '@/features/agents/lib/json';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/input';
import Input from '@/shared/ui/input/Input';
import InputDropdown from '@/shared/ui/input/InputDropdown';
import InputTextarea from '@/shared/ui/input/InputTextarea';
import { TenantScopeFields } from '@/shared/ui/input/tenant-scope-fields';

import type { OrganizationProps } from '@/entities/organization';
import type {
  AgentProfile,
  AgentSelectOption,
  AgentTask,
} from '@/features/agents/model/types';

interface AgentTaskFormValues {
  name: string;
  prompt: string;
  organization_id: string;
  team_id: string;
  agent_profile_id: string;
  schedule_type: string;
  interval_seconds: string;
  execution_mode: string;
  agent_task_type: string;
  output_mode: string;
  allowed_tools: string[];
  input_payload: string;
  metadata: string;
  enabled: boolean;
}

/**
 *
 * @param root0
 * @param root0.task
 * @param root0.organizations
 * @param root0.profiles
 * @param root0.executionModeOptions
 * @param root0.scheduleTypeOptions
 * @param root0.taskTypeOptions
 * @param root0.outputModeOptions
 * @param root0.toolOptions
 */
export function AgentTaskForm({
  task,
  organizations,
  profiles,
  executionModeOptions,
  scheduleTypeOptions,
  taskTypeOptions,
  outputModeOptions,
  toolOptions,
}: {
  task?: AgentTask;
  organizations: OrganizationProps[];
  profiles: AgentProfile[];
  executionModeOptions: AgentSelectOption[];
  scheduleTypeOptions: AgentSelectOption[];
  taskTypeOptions: AgentSelectOption[];
  outputModeOptions: AgentSelectOption[];
  toolOptions: AgentSelectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(task?.id);
  const defaultValues = useMemo<AgentTaskFormValues>(() => {
    return {
      name: task?.name ?? '',
      prompt: task?.prompt ?? '',
      organization_id: task?.organization_id
        ? String(task.organization_id)
        : '',
      team_id: task?.team_id ? String(task.team_id) : '',
      agent_profile_id: task?.agent_profile_id
        ? String(task.agent_profile_id)
        : '',
      schedule_type: task?.schedule_type ?? '',
      interval_seconds: task?.interval_seconds
        ? String(task.interval_seconds)
        : '',
      execution_mode: task?.execution_mode ?? '',
      agent_task_type: task?.agent_task_type ?? '',
      output_mode: task?.output_mode ?? '',
      allowed_tools: normalizeAllowedTools(task?.allowed_tools),
      input_payload: stringifyJson(task?.input_payload),
      metadata: stringifyJson(task?.metadata),
      enabled: task?.enabled ?? true,
    };
  }, [task]);
  const {
    register,
    watch,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<AgentTaskFormValues>({
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const profileOptions = profiles.map((profile) => {
    return { value: String(profile.id), label: profile.name };
  });
  /**
   *
   * @param values
   */
  const onSubmit = (values: AgentTaskFormValues) => {
    startTransition(async () => {
      if (!values.organization_id) {
        setError('organization_id', { message: 'Organization is required' });

        return;
      }

      if (!values.agent_profile_id) {
        setError('agent_profile_id', { message: 'Agent profile is required' });

        return;
      }

      let inputPayload: Record<string, unknown> | null = null;
      let metadata: Record<string, unknown> | null = null;

      try {
        inputPayload = parseJsonInput(values.input_payload);
      } catch (error) {
        setError('input_payload', { message: (error as Error).message });

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
        prompt: values.prompt.trim() || null,
        organization_id: Number(values.organization_id),
        team_id: values.team_id ? Number(values.team_id) : null,
        agent_profile_id: Number(values.agent_profile_id),
        schedule_type: values.schedule_type,
        interval_seconds:
          values.schedule_type === 'interval' && values.interval_seconds
            ? Number(values.interval_seconds)
            : null,
        execution_mode: values.execution_mode,
        agent_task_type: values.agent_task_type,
        output_mode: values.output_mode || null,
        allowed_tools: values.allowed_tools,
        input_payload: inputPayload,
        metadata,
        enabled: values.enabled,
      };
      const result =
        isEdit && task
          ? await updateAgentTask(task.id, payload)
          : await createAgentTask(payload);

      if (result.error !== null) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          if (field in defaultValues) {
            setError(field as keyof AgentTaskFormValues, { message });
          }
        }
        toast.error(result.error);

        return;
      }

      toast.success(isEdit ? 'Agent task updated' : 'Agent task created');
      router.push(`${ROUTES.DASHBOARD.AGENT_TASKS}/${result.data.id}`);
      router.refresh();
    });
  };
  const allowedToolOptions = toolOptions.map((tool) => {
    return {
      value: tool.value,
      label: tool.description
        ? `${tool.label} — ${tool.description}`
        : tool.label,
    };
  });

  return (
    <form className='flex flex-col gap-4' onSubmit={handleSubmit(onSubmit)}>
      <div className='grid gap-4 md:grid-cols-2'>
        <Input
          {...register('name')}
          label='Name'
          value={watch('name')}
          error={errors.name?.message}
        />
        <InputDropdown
          label='Agent profile'
          options={profileOptions}
          value={watch('agent_profile_id')}
          onChange={(value) => {
            setValue('agent_profile_id', value as string, {
              shouldDirty: true,
            });
            clearErrors('agent_profile_id');
          }}
          error={errors.agent_profile_id?.message}
          searchable
        />
      </div>

      <InputTextarea
        {...register('prompt')}
        label='Prompt'
        value={watch('prompt')}
        error={errors.prompt?.message}
      />

      <TenantScopeFields
        organizations={organizations}
        organizationId={watch('organization_id')}
        teamId={watch('team_id')}
        fetchTeams={getTeams}
        onOrganizationChange={(value) => {
          setValue('organization_id', value, { shouldDirty: true });
          setValue('team_id', '', { shouldDirty: true });
          clearErrors(['organization_id', 'team_id']);
        }}
        onTeamChange={(value) => {
          setValue('team_id', value, { shouldDirty: true });
          clearErrors('team_id');
        }}
        organizationError={errors.organization_id?.message}
        teamError={errors.team_id?.message}
        disabled={isPending}
      />

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <InputDropdown
          label='Schedule type'
          options={scheduleTypeOptions}
          value={watch('schedule_type')}
          onChange={(value) => {
            setValue('schedule_type', value as string, { shouldDirty: true });
            clearErrors('schedule_type');
          }}
          error={errors.schedule_type?.message}
        />
        <Input
          {...register('interval_seconds')}
          label='Interval seconds'
          type='number'
          value={watch('interval_seconds')}
          error={errors.interval_seconds?.message}
        />
        <InputDropdown
          label='Execution mode'
          options={executionModeOptions}
          value={watch('execution_mode')}
          onChange={(value) => {
            setValue('execution_mode', value as string, { shouldDirty: true });
            clearErrors('execution_mode');
          }}
          error={errors.execution_mode?.message}
        />
        <InputDropdown
          label='Task type'
          options={taskTypeOptions}
          value={watch('agent_task_type')}
          onChange={(value) => {
            setValue('agent_task_type', value as string, { shouldDirty: true });
            clearErrors('agent_task_type');
          }}
          error={errors.agent_task_type?.message}
        />
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <InputDropdown
          label='Output mode'
          options={outputModeOptions}
          value={watch('output_mode')}
          onChange={(value) => {
            setValue('output_mode', value as string, { shouldDirty: true });
            clearErrors('output_mode');
          }}
          error={errors.output_mode?.message}
        />
        <InputDropdown
          label='Allowed tools'
          options={allowedToolOptions}
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

      <Checkbox
        label='Enabled'
        checked={watch('enabled')}
        onChange={(event) => {
          setValue('enabled', event.target.checked, { shouldDirty: true });
        }}
      />

      <InputTextarea
        {...register('input_payload')}
        label='Input payload JSON'
        value={watch('input_payload')}
        error={errors.input_payload?.message}
      />

      <div className='flex justify-end'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          className='w-auto'
          loading={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                if (!watch('agent_profile_id')) {
                  setError('agent_profile_id', {
                    message: 'Select an agent profile first',
                  });

                  return;
                }

                const payload = parseJsonInput(watch('input_payload'));
                const result = await validateAgentProfilePayload(
                  Number(watch('agent_profile_id')),
                  payload,
                );

                if (result.error !== null) {
                  toast.error(result.error);

                  return;
                }

                toast.success('Input payload is valid');
              } catch (error) {
                setError('input_payload', {
                  message: (error as Error).message,
                });
              }
            });
          }}
        >
          Validate input payload
        </Button>
      </div>

      <InputTextarea
        {...register('metadata')}
        label='Metadata JSON'
        value={watch('metadata')}
        error={errors.metadata?.message}
      />

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
