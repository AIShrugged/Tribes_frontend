'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { login } from '@/features/auth/api/auth';
import { SIGN_IN_FIELDS, SIGN_IN_VALUES } from '@/features/auth/lib/fields';
import { LoginSchema, type LoginInput } from '@/features/auth/model/schemas';
import AuthFormFooter from '@/features/auth/ui/auth-form-footer';
import { VARIANT_MAPPER, type VariantType } from '@/shared/lib/fieldMapper';
import { handleFormError } from '@/shared/lib/formErrors';
import { ROUTES } from '@/shared/lib/routes';

const FORM_ID = 'login-form';

export default function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm<LoginInput>({
    defaultValues: SIGN_IN_VALUES,
    resolver: zodResolver(LoginSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const onSubmit = (data: LoginInput) => {
    startTransition(async () => {
      try {
        await login(data);
        router.push(ROUTES.AUTH.ORGANIZATION);
      } catch (error) {
        handleFormError(error, setError, 'Login failed. Please try again.');
      }
    });
  };

  return (
    <>
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(onSubmit)}
        className='w-full flex flex-col gap-4'
        aria-describedby={errors.root ? 'form-error' : undefined}
      >
        {errors.root?.message && (
          <p
            id='form-error'
            role='alert'
            className='text-sm text-destructive text-center'
          >
            {errors.root.message}
          </p>
        )}
        {SIGN_IN_FIELDS.map((field) => {
          return (
            <Controller
              key={field.name}
              name={field.name as keyof LoginInput}
              control={control}
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
      </form>
      <div className='flex justify-end mt-1 -mb-2'>
        <Link
          href={ROUTES.AUTH.FORGOT_PASSWORD}
          className='text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors'
        >
          Forgot password?
        </Link>
      </div>
      <AuthFormFooter
        loading={isPending}
        disabled={isPending || !isValid}
        formId={FORM_ID}
        primaryButton='Log In'
        primaryText='Register'
        secondaryText="Don't have an account?"
        secondaryRoute={ROUTES.AUTH.REGISTER}
      />
    </>
  );
}
