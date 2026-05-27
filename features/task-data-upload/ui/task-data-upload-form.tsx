'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { uploadTaskData } from '@/features/task-data-upload/api/upload-task-data';
import {
  MAX_FILE_SIZE_BYTES,
  getUploadErrorMessage,
  taskDataUploadSchema,
  type TaskDataUploadFormData,
} from '@/features/task-data-upload/model/schema';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Error from '@/shared/ui/input/Error';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import type { TeamProps } from '@/entities/team';

export function TaskDataUploadForm({
  teams,
  onClose,
}: {
  teams: TeamProps[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoTeamId = teams.length === 1 ? teams[0].id : undefined;
  const teamOptions = teams.map((t) => {
    return {
      value: String(t.id),
      label: t.name,
    };
  });

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TaskDataUploadFormData>({
    resolver: zodResolver(taskDataUploadSchema),
    defaultValues: {
      team_id: autoTeamId,
    },
  });

  const fieldErrorMessage = (key: string): string | undefined => {
    return (errors as Record<string, { message?: string } | undefined>)[key]
      ?.message;
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onChange: (file: File | undefined) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      onChange();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('File exceeds 10 MB');
      event.target.value = '';
      onChange();
      return;
    }
    onChange(file);
  };

  const onSubmit = (data: TaskDataUploadFormData) => {
    setRootError('');

    startTransition(async () => {
      const result = await uploadTaskData(data.file, data.team_id);

      if (result.error) {
        const msg = getUploadErrorMessage(result.errorCode, result.error);
        toast.error(msg);
        setRootError(msg);
        return;
      }

      const uploadResult = result.data;
      if (!uploadResult) return;

      toast.success(
        `Processed: ${uploadResult.issues_created} new task${uploadResult.issues_created === 1 ? '' : 's'}, ${uploadResult.issues_updated} updated.`,
      );
      onClose();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4 p-4'>
      {/* File input */}
      <Controller
        control={control}
        name='file'
        render={({ field }) => {
          return (
            <div className='flex flex-col gap-1.5'>
              <label
                htmlFor='task-data-upload-file'
                className='text-sm font-medium text-foreground'
              >
                File with task data
                <span className='ml-2 text-xs font-normal text-muted-foreground'>
                  Any text format or archive · up to 10 MB
                </span>
              </label>
              <input
                id='task-data-upload-file'
                ref={fileInputRef}
                type='file'
                aria-label='Task data file'
                className='text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90'
                onChange={(e) => {
                  return handleFileChange(e, field.onChange);
                }}
              />
              {field.value && (
                <p className='text-xs text-muted-foreground'>
                  {field.value.name} · {(field.value.size / 1024).toFixed(1)} KB
                </p>
              )}
              {fieldErrorMessage('file') && (
                <Error id='file-error'>{fieldErrorMessage('file')}</Error>
              )}
            </div>
          );
        }}
      />

      {/* Team picker — hidden if user has exactly 1 team */}
      {teams.length > 1 && (
        <Controller
          control={control}
          name='team_id'
          render={({ field }) => {
            return (
              <div className='flex flex-col gap-1.5'>
                <label className='text-sm font-medium text-foreground'>
                  Team
                </label>
                <InputDropdown
                  options={teamOptions}
                  value={field.value === undefined ? '' : String(field.value)}
                  onChange={(v) => {
                    return field.onChange(Number(v));
                  }}
                  placeholder='Select a team'
                  searchable
                  error={fieldErrorMessage('team_id')}
                />
              </div>
            );
          }}
        />
      )}

      {teams.length === 0 && (
        <p className='text-sm text-destructive'>
          You need to be a member of at least one team to upload task data.
        </p>
      )}

      {rootError && <p className='text-sm text-destructive'>{rootError}</p>}

      <div className='flex justify-end gap-2 pt-2'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type='submit' disabled={isPending || teams.length === 0}>
          {isPending ? 'Processing…' : 'Upload & extract tasks'}
        </Button>
      </div>
    </form>
  );
}
