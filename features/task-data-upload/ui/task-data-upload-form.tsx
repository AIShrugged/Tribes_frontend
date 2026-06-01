'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  getUploadStatus,
  uploadTaskData,
} from '@/features/task-data-upload/api/upload-task-data';
import {
  MAX_FILE_SIZE_BYTES,
  getUploadErrorMessage,
  taskDataUploadSchema,
  type TaskDataUploadFormData,
} from '@/features/task-data-upload/model/schema';
import {
  STATUS_LABELS,
  STATUS_PROGRESS,
  type TaskDataUploadStatusResponse,
  type UploadStatus,
} from '@/features/task-data-upload/model/types';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Error from '@/shared/ui/input/Error';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import type { TeamProps } from '@/entities/team';

type FormPhase = 'form' | 'processing' | 'done' | 'error';

export function TaskDataUploadForm({
  teams,
  onClose,
}: {
  teams: TeamProps[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState('');
  const [phase, setPhase] = useState<FormPhase>('form');
  const [currentStatus, setCurrentStatus] = useState<UploadStatus>('queued');
  const [statusResult, setStatusResult] =
    useState<TaskDataUploadStatusResponse | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    defaultValues: { team_id: autoTeamId },
  });

  const fieldErrorMessage = (key: string): string | undefined => {
    return (errors as Record<string, { message?: string } | undefined>)[key]
      ?.message;
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  // Start polling when uploadId is set
  useEffect(() => {
    if (uploadId === null || phase !== 'processing') return;

    const poll = async () => {
      try {
        const data = await getUploadStatus(uploadId);
        setCurrentStatus(data.status);

        if (data.status === 'done') {
          setStatusResult(data);
          setPhase('done');
          stopPolling();
        } else if (data.status === 'failed') {
          setRootError(
            'Processing failed. Please try again with a different file.',
          );
          setPhase('error');
          stopPolling();
        }
      } catch {
        // Network error during poll — keep trying
      }
    };

    // Initial poll immediately
    poll().catch(() => {});

    // Then every 2 seconds
    pollRef.current = setInterval(() => {
      poll().catch(() => {});
    }, 2000);

    return stopPolling;
  }, [uploadId, phase, stopPolling]);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onChange: (file?: File) => void,
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
    setPhase('processing');
    setCurrentStatus('queued');

    startTransition(async () => {
      const result = await uploadTaskData(data.file, data.team_id);

      if (result.error) {
        const msg = getUploadErrorMessage(result.errorCode, result.error);
        setRootError(msg);
        setPhase('error');
        return;
      }

      const response = result.data;
      if (!response) {
        setPhase('error');
        return;
      }

      setUploadId(response.upload_id);
      // Polling will start via useEffect
    });
  };

  const progressPct = STATUS_PROGRESS[currentStatus] ?? 0;
  const progressLabel = STATUS_LABELS[currentStatus] ?? 'Processing…';

  // ── Done state ──
  if (phase === 'done' && statusResult) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <div className='flex items-center gap-2 text-green-500'>
          <CheckCircle className='size-5' />
          <span className='text-sm font-medium'>Processing complete</span>
        </div>

        <div className='rounded-md border border-border bg-muted/30 p-3 text-sm'>
          <p>
            <strong>{statusResult.issues_created}</strong> new task
            {statusResult.issues_created === 1 ? '' : 's'} created
          </p>
          <p>
            <strong>{statusResult.issues_updated}</strong> existing task
            {statusResult.issues_updated === 1 ? '' : 's'} updated
          </p>
        </div>

        {statusResult.issues && statusResult.issues.length > 0 && (
          <div className='max-h-48 overflow-y-auto text-sm'>
            <p className='mb-1 font-medium text-muted-foreground'>Tasks:</p>
            <ul className='space-y-1'>
              {statusResult.issues.map((issue) => {
                return (
                  <li key={issue.id} className='flex items-center gap-1.5'>
                    <span className='text-green-500'>+ new</span>
                    <span className='truncate'>{issue.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {statusResult.issues_created === 0 &&
          statusResult.issues_updated === 0 && (
            <p className='text-sm text-muted-foreground'>
              No tasks were extracted from this document.
            </p>
          )}

        <div className='flex justify-end pt-2'>
          <Button type='button' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (phase === 'error') {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <div className='flex items-center gap-2 text-destructive'>
          <XCircle className='size-5' />
          <span className='text-sm font-medium'>Processing failed</span>
        </div>
        {rootError && <p className='text-sm text-destructive'>{rootError}</p>}
        <div className='flex justify-end gap-2 pt-2'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.secondary}
            onClick={() => {
              setPhase('form');
              setRootError('');
              setUploadId(null);
            }}
          >
            Try again
          </Button>
          <Button type='button' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload form + processing progress ──
  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4 p-4'>
      {/* Real-time progress from backend */}
      {phase === 'processing' && (
        <div className='rounded-md border border-border bg-muted/30 p-3 text-sm'>
          <div className='flex items-center gap-2 text-foreground'>
            <div className='size-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            {progressLabel}
          </div>
          <div className='mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-primary transition-all duration-700 ease-out'
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

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
                disabled={phase === 'processing'}
                className='text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50'
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

      {/* Team picker */}
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
                  disabled={phase === 'processing'}
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

      {rootError && phase === 'form' && (
        <p className='text-sm text-destructive'>{rootError}</p>
      )}

      <div className='flex justify-end gap-2 pt-2'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          onClick={onClose}
          disabled={phase === 'processing'}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={phase === 'processing' || isPending || teams.length === 0}
        >
          {phase === 'processing' ? 'Processing…' : 'Upload & extract tasks'}
        </Button>
      </div>
    </form>
  );
}
