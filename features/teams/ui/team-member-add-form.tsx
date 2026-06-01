'use client';

import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { sendInvite } from '@/features/teams/api/team';
import {
  TEAM_MEMBER_ADD_FIELDS,
  TEAM_MEMBER_ADD_VALUES,
} from '@/features/teams/model/fields';
import { VARIANT_MAPPER, type VariantType } from '@/shared/lib/fieldMapper';
import { Button } from '@/shared/ui/button/Button';

import type { TeamAddMemberDTO } from '@/entities/team';

const FORM_ID = 'team-member-add-form';

/**
 * TeamMemberAddForm component.
 * @param props - Component props.
 * @param props.close
 * @param props.teamId
 */
export default function TeamMemberAddForm({
  close,
  teamId,
}: {
  close: () => void;
  teamId: number;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<TeamAddMemberDTO>({
    defaultValues: TEAM_MEMBER_ADD_VALUES,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  /**
   * onSubmit.
   * @param data - data.
   * @returns Result.
   */
  const onSubmit = async (data: TeamAddMemberDTO) => {
    setIsSubmitting(true);

    try {
      const result = await sendInvite(teamId, data);

      if (result.error) {
        setError('email', { message: result.error });
        return;
      }

      toast.success('Invitation sent');
      close();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id={FORM_ID}
      onSubmit={handleSubmit(onSubmit)}
      className='w-full flex flex-col gap-8'
    >
      {TEAM_MEMBER_ADD_FIELDS.map((field) => {
        return (
          <Controller
            key={field.name}
            name={field.name as keyof TeamAddMemberDTO}
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
      <div className={'flex flex-col gap-3'}>
        <Button loading={isSubmitting} disabled={isSubmitting || !isDirty}>
          {'Invite'}
        </Button>
      </div>
    </form>
  );
}
