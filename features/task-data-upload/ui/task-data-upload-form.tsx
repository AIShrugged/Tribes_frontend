'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, UploadCloud, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Error from '@/shared/ui/input/Error';

import type { TeamProps } from '@/entities/team';

type FormPhase = 'form' | 'processing' | 'done' | 'error';

/** Validate (size) and hand the file to the form, or clear it. Used by both browse and drop. */
function acceptFile(
  file: File | undefined,
  onChange: (file?: File) => void,
): void {
  if (!file) {
    onChange();
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error('File exceeds 10 MB');
    onChange();
    return;
  }
  onChange(file);
}

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
  const router = useRouter();
  // Guards against the initial poll + interval both firing a redirect before the interval clears.
  const redirectedRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);

  // The team picker is hidden — uploads always go to the org's default ("General") team
  // (every org member belongs to it). The teams list always includes it (Team::visibleFor).
  const defaultTeamId = teams.find((t) => t.is_default)?.id ?? teams[0]?.id;

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TaskDataUploadFormData>({
    resolver: zodResolver(taskDataUploadSchema),
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

        switch (data.status) {
          case 'done': {
            setStatusResult(data);
            setPhase('done');
            stopPolling();
            break;
          }
          case 'pending_review': {
            // Pre-moderation on: extracted tasks await human review — hand off to the review screen.
            if (!redirectedRef.current) {
              redirectedRef.current = true;
              stopPolling();
              onClose();
              router.push(
                ROUTES.DASHBOARD.UPLOAD_DETAIL('task_data', uploadId),
              );
            }
            break;
          }
          case 'failed': {
            setRootError(
              data.error_message ??
                'Processing failed. Please try again with a different file.',
            );
            setPhase('error');
            stopPolling();
            break;
          }
          default: {
            break;
          }
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
  }, [uploadId, phase, stopPolling, router, onClose]);

  const onSubmit = (data: TaskDataUploadFormData) => {
    setRootError('');
    setPhase('processing');
    setCurrentStatus('queued');

    startTransition(async () => {
      const result = await uploadTaskData(data.file, defaultTeamId);

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

        {((statusResult.issues && statusResult.issues.length > 0) ||
          (statusResult.updated_issues &&
            statusResult.updated_issues.length > 0)) && (
          <div className='max-h-48 overflow-y-auto text-sm'>
            <p className='mb-1 font-medium text-muted-foreground'>Tasks:</p>
            <ul className='space-y-1'>
              {statusResult.issues?.map((issue) => {
                return (
                  <li
                    key={`new-${issue.id}`}
                    className='flex items-center gap-1.5'
                  >
                    <span className='text-green-500'>+ new</span>
                    <span className='truncate'>{issue.name}</span>
                  </li>
                );
              })}
              {statusResult.updated_issues?.map((issue) => {
                return (
                  <li
                    key={`updated-${issue.id}`}
                    className='flex items-center gap-1.5'
                  >
                    <span className='text-amber-500'>~ updated</span>
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

      {/* Drag-and-drop zone (click to browse fallback). Team is fixed to the org default. */}
      <Controller
        control={control}
        name='file'
        render={({ field }) => {
          const disabled = phase === 'processing';
          return (
            <div className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium text-foreground'>
                File with task data
                <span className='ml-2 text-xs font-normal text-muted-foreground'>
                  Any text format or archive · up to 10 MB
                </span>
              </span>
              <div
                role='button'
                tabIndex={0}
                aria-label='Drag a file here or click to browse'
                onClick={() => {
                  if (!disabled) fileInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!disabled) fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!disabled) setIsDragging(true);
                }}
                onDragLeave={() => {
                  return setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (!disabled) {
                    acceptFile(e.dataTransfer.files?.[0], field.onChange);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-primary/50'
                }`}
              >
                <UploadCloud className='h-6 w-6 text-muted-foreground' />
                {field.value ? (
                  <p className='text-foreground'>
                    {field.value.name} · {(field.value.size / 1024).toFixed(1)}{' '}
                    KB
                  </p>
                ) : (
                  <p className='text-muted-foreground'>
                    <span className='font-medium text-foreground'>
                      Drag a file here
                    </span>{' '}
                    or click to browse
                  </p>
                )}
                <input
                  id='task-data-upload-file'
                  ref={fileInputRef}
                  type='file'
                  aria-label='Task data file'
                  className='hidden'
                  disabled={disabled}
                  onChange={(e) => {
                    acceptFile(e.target.files?.[0], field.onChange);
                    e.target.value = '';
                  }}
                />
              </div>
              {fieldErrorMessage('file') && (
                <Error id='file-error'>{fieldErrorMessage('file')}</Error>
              )}
            </div>
          );
        }}
      />

      {!defaultTeamId && (
        <p className='text-sm text-destructive'>
          You need to belong to an organization to upload task data.
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
          disabled={phase === 'processing' || isPending || !defaultTeamId}
        >
          {phase === 'processing' ? 'Processing…' : 'Upload & extract tasks'}
        </Button>
      </div>
    </form>
  );
}
