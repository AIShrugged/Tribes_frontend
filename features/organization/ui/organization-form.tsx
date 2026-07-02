'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useForm, Controller, type UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';

import {
  createOrganization,
  updateOrganization,
} from '@/features/organization/api/organization';
import {
  ORGANIZATION_FIELDS,
  ORGANIZATION_VALUES,
} from '@/features/organization/lib/fields';
import { OrganizationCodeField } from '@/features/organization/ui/organization-code-field';
import { VARIANT_MAPPER, type VariantType } from '@/shared/lib/fieldMapper';
import { ROUTES } from '@/shared/lib/routes';
import { Button } from '@/shared/ui/button/Button';

import type {
  OrganizationDTO,
  OrganizationProps,
} from '@/entities/organization';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * applyCreateErrors — maps a failed createOrganization result onto the form
 * fields. Prefers per-field errors (e.g. 422 errors.code) and falls back to the
 * general message on the name field. No-op on success (error is null).
 * @param result - the ActionResult returned by createOrganization.
 * @param setError - react-hook-form setError.
 */
function applyCreateErrors(
  result: ActionResult<OrganizationProps>,
  setError: UseFormSetError<OrganizationDTO>,
) {
  if (!result.error) return;

  const codeError = result.fieldErrors?.code;
  const nameError = result.fieldErrors?.name;

  if (codeError) setError('code', { message: codeError });
  if (nameError) setError('name', { message: nameError });
  if (!codeError && !nameError) setError('name', { message: result.error });
}

/**
 * OrganizationForm component.
 * @param root0
 * @param root0.values
 */
export default function OrganizationForm({
  values,
}: {
  values?: OrganizationProps;
}) {
  const FORM_ID = 'organization-form';
  const isEdit = Boolean(values?.id);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<OrganizationDTO>({
    defaultValues: values
      ? { name: values.name, code: values.code ?? '' }
      : ORGANIZATION_VALUES,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  /**
   * onSubmit.
   * @param data - data.
   * @returns Result.
   */
  const onSubmit = async (data: OrganizationDTO) => {
    setIsSubmitting(true);

    try {
      if (isEdit && values?.id) {
        // Code is immutable — never sent on update.
        await updateOrganization(values.id, {
          name: data.name,
        });

        toast.success('Organization updated');
        router.refresh();

        return;
      }

      // Empty code → omit so the backend auto-generates the prefix.
      // Success redirects inside the action; only the error path returns here.
      const result = await createOrganization({
        name: data.name,
        code: data.code?.trim() || undefined,
      });

      applyCreateErrors(result, setError);
    } catch (error) {
      setError('name', {
        message: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(onSubmit)}
        className='w-full flex flex-col gap-8 h-full'
      >
        {ORGANIZATION_FIELDS.map((field) => {
          return (
            <Controller
              key={field.name}
              name={field.name as keyof OrganizationDTO}
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

        <OrganizationCodeField control={control} isEdit={isEdit} />

        {isEdit && (
          <div className={'mt-auto w-full md:w-[170px]'}>
            <Button
              type={'submit'}
              form={FORM_ID}
              loading={isSubmitting}
              disabled={isSubmitting || !isDirty}
            >
              {'Save'}
            </Button>
          </div>
        )}
      </form>

      {!isEdit && (
        <div className={'flex flex-col gap-6 mt-12'}>
          <Button
            type={'submit'}
            form={FORM_ID}
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty}
          >
            {'Save'}
          </Button>
          <Link href={ROUTES.AUTH.ORGANIZATION} className='cursor-pointer'>
            <Button variant={'secondary'}>{'Back'}</Button>
          </Link>
        </div>
      )}
    </>
  );
}
