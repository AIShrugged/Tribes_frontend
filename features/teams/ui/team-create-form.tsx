'use client';

import { useRouter } from 'next/navigation';
import React, { useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { createTeam, updateTeam } from '@/features/teams/api/team';
import { TEAM_CREATE_FIELDS } from '@/features/teams/model/fields';
import { VARIANT_MAPPER, type VariantType } from '@/shared/lib/fieldMapper';
import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button/Button';

import type { TeamCreateDTO, TeamProps } from '@/entities/team';

/**
 * TeamCreateForm component.
 * @param root0
 * @param root0.values
 * @param root0.organization_id
 */
export default function TeamCreateForm({
  values,
  organization_id,
  onSuccess,
}: {
  values: TeamProps;
  organization_id: string;
  onSuccess?: (teamId: number) => void;
}) {
  const FORM_ID = 'team-create-form';
  const isEdit = Boolean(values?.id);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<TeamCreateDTO>({
    defaultValues: values,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  /**
   * onSubmit.
   * @param data - data.
   * @returns Result.
   */
  const onSubmit = (data: TeamCreateDTO) => {
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateTeam(values.id, data);

          if (onSuccess) {
            onSuccess(values.id);
          } else {
            router.push(ROUTES.DASHBOARD.TEAMS);
          }
        } else {
          const result = await createTeam(organization_id, data);

          if (result.error) {
            toast.error(result.error);

            return;
          }

          if (onSuccess && result.data) {
            onSuccess(result.data.id);
          } else {
            router.push(ROUTES.DASHBOARD.TEAMS);
          }
        }
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  };

  return (
    <form
      id={FORM_ID}
      onSubmit={handleSubmit(onSubmit)}
      className='flex flex-col flex-1 gap-8'
    >
      {TEAM_CREATE_FIELDS.map((field) => {
        return (
          <Controller
            key={field.name}
            name={field.name as keyof TeamCreateDTO}
            control={control}
            rules={field.rules}
            render={({ field: hookField, fieldState }) => {
              const variant: VariantType = field.variant;
              const Component = VARIANT_MAPPER[variant];

              return (
                <Component
                  field={hookField}
                  fieldState={fieldState}
                  config={field}
                />
              );
            }}
          />
        );
      })}
      <div className={'mt-auto w-full md:w-[170px]'}>
        <Button
          loading={isPending}
          disabled={isPending || !isDirty}
          type='submit'
        >
          {'Save'}
        </Button>
      </div>
    </form>
  );
}
