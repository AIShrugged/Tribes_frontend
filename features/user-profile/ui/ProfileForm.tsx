'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { updateProfile } from '@/features/user-profile/api/profile';
import { Button } from '@/shared/ui/button/Button';
import Input from '@/shared/ui/input/Input';

import type { UserProps } from '@/entities/user';

interface ProfileFormData {
  name: string;
}

/**
 * ProfileForm component.
 * @param props - Component props.
 * @param props.user - The current authenticated user.
 */
export function ProfileForm({ user }: { user: UserProps }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { isDirty, errors },
  } = useForm<ProfileFormData>({
    defaultValues: { name: user.name },
  });
  /**
   * onSubmit.
   * @param data - Form data.
   * @returns {void}
   */
  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);

    try {
      const result = await updateProfile(data);

      if (result.error) {
        toast.error(result.error);

        return;
      }

      toast.success('Profile updated successfully');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-6'>
      <Input
        {...register('name', { required: 'Name is required' })}
        label='Name'
        value={watch('name')}
        error={errors.name?.message}
      />

      <div className='w-full md:w-[170px]'>
        <Button
          type='submit'
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
