'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type PropsWithChildren, useMemo, useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { uploadTranscript } from '@/features/transcript-upload/api/upload-transcript';
import {
  ACCEPT_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  getUploadErrorMessage,
  transcriptUploadSchema,
  type TranscriptUploadFormData,
} from '@/features/transcript-upload/model/schema';
import { ROUTES } from '@/shared/lib/routes';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Error from '@/shared/ui/input/Error';
import Input from '@/shared/ui/input/Input';
import InputDropdown from '@/shared/ui/input/InputDropdown';

import type { CalendarEventListItem } from '@/entities/event';
import type { TeamProps } from '@/entities/team';

type Mode = 'existing' | 'new';

function handleFileChange(
  event: React.ChangeEvent<HTMLInputElement>,
  onChange: (file?: File) => void,
) {
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
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function applyFieldErrors(
  fieldErrors: Record<string, string>,
  setError: (field: keyof TranscriptUploadFormData, error: { message: string }) => void,
) {
  for (const [field, msg] of Object.entries(fieldErrors)) {
    setError(field as keyof TranscriptUploadFormData, { message: msg });
  }
}

export function TranscriptUploadForm({
  meetings,
  teams,
  onClose,
}: {
  meetings: CalendarEventListItem[];
  teams: TeamProps[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState('');

  const newMeetingDisabled = teams.length === 0;
  const autoSelectedTeamId = teams.length === 1 ? teams[0].id : undefined;

  const [mode, setMode] = useState<Mode>('existing');

  // Computed once so re-renders don't reset user's input.
  const dateDefaults = useMemo(() => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    return {
      startsAt: toDatetimeLocalString(thirtyMinAgo),
      endsAt: toDatetimeLocalString(now),
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TranscriptUploadFormData>({
    resolver: zodResolver(transcriptUploadSchema),
    defaultValues: {
      mode: 'existing',
      starts_at: dateDefaults.startsAt,
      ends_at: dateDefaults.endsAt,
    } as unknown as TranscriptUploadFormData,
  });

  // Discriminated-union forms make `errors.X` access type-narrow; this helper
  // dodges that since the form's render branches are guarded at runtime.
  const fieldErrorMessage = (key: string): string | undefined => {
    return (errors as Record<string, { message?: string } | undefined>)[key]
      ?.message;
  };

  const switchMode = (next: Mode) => {
    if (next === 'new' && newMeetingDisabled) return;
    setMode(next);
    setValue('mode', next, { shouldValidate: false });
    if (next === 'new' && autoSelectedTeamId !== undefined) {
      setValue('team_id', autoSelectedTeamId);
    }
  };

  const onSubmit = (data: TranscriptUploadFormData) => {
    setRootError('');
    startTransition(async () => {
      const result = await uploadTranscript(data);
      if (result.error) {
        const userMessage = getUploadErrorMessage(result.errorCode, result.error);
        if (result.fieldErrors) applyFieldErrors(result.fieldErrors, setError);
        const hasOnlyFieldErrors =
          result.fieldErrors && Object.keys(result.fieldErrors).length > 0;
        if (!hasOnlyFieldErrors) toast.error(userMessage);
        setRootError(userMessage);
        return;
      }
      const uploadResponse = result.data;
      if (!uploadResponse) return;
      toast.success('Transcript uploaded. Summary will appear in 1–2 minutes.');
      onClose();
      router.push(
        ROUTES.DASHBOARD.MEETING_DETAIL_TRANSCRIPT(uploadResponse.calendar_event_id),
      );
    });
  };

  const meetingOptions = meetings.map((m) => {
    return {
      value: String(m.id),
      label: `${m.title} — ${new Date(m.starts_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`,
    };
  });
  const teamOptions = teams.map((t) => {
    return {
      value: String(t.id),
      label: t.name,
    };
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4 p-4'>
      <div
        role='tablist'
        aria-label='Upload mode'
        className='flex rounded-md border border-border bg-background p-1'
      >
        <ModeTabButton
          isActive={mode === 'existing'}
          onActivate={() => {
            return switchMode('existing');
          }}
          onArrow={() => {
            return switchMode('new');
          }}
        >
          Attach to existing meeting
        </ModeTabButton>
        <ModeTabButton
          isActive={mode === 'new'}
          disabled={newMeetingDisabled}
          tooltip={
            newMeetingDisabled
              ? 'Create a team to upload transcripts without an existing meeting'
              : undefined
          }
          onActivate={() => {
            return switchMode('new');
          }}
          onArrow={() => {
            return switchMode('existing');
          }}
        >
          Create new meeting
        </ModeTabButton>
      </div>

      <input type='hidden' {...register('mode')} value={mode} readOnly />

      {mode === 'existing' && (
        <Controller
          control={control}
          name='calendar_event_id'
          render={({ field }) => {
            return (
              <div className='flex flex-col gap-1.5'>
                <label className='text-sm font-medium text-foreground'>
                  Meeting
                </label>
                <InputDropdown
                  options={meetingOptions}
                  value={field.value === undefined ? '' : String(field.value)}
                  onChange={(v) => {
                    return field.onChange(Number(v));
                  }}
                  placeholder={
                    meetingOptions.length === 0
                      ? 'No past meetings'
                      : 'Select a meeting'
                  }
                  searchable
                  error={fieldErrorMessage('calendar_event_id')}
                />
              </div>
            );
          }}
        />
      )}

      {mode === 'new' && (
        <>
          <Controller
            control={control}
            name='title'
            defaultValue=''
            render={({ field }) => {
              return (
                <div className='flex flex-col gap-1.5'>
                  <label className='text-sm font-medium text-foreground'>
                    Meeting title
                  </label>
                  <Input
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder='e.g. Tribes tech sync'
                    error={fieldErrorMessage('title')}
                  />
                </div>
              );
            }}
          />
          <div className='grid grid-cols-2 gap-3'>
            <Controller
              control={control}
              name='starts_at'
              render={({ field }) => {
                return (
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-sm font-medium text-foreground'>
                      Start
                    </label>
                    <Input
                      type='datetime-local'
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldErrorMessage('starts_at')}
                    />
                  </div>
                );
              }}
            />
            <Controller
              control={control}
              name='ends_at'
              render={({ field }) => {
                return (
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-sm font-medium text-foreground'>
                      End
                    </label>
                    <Input
                      type='datetime-local'
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldErrorMessage('ends_at')}
                    />
                  </div>
                );
              }}
            />
          </div>
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
                      value={
                        field.value === undefined ? '' : String(field.value)
                      }
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
        </>
      )}

      <FilePickerField
        control={control}
        fieldErrorMessage={fieldErrorMessage}
      />

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
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}

function FilePickerField({
  control,
  fieldErrorMessage,
}: {
  control: ReturnType<typeof useForm<TranscriptUploadFormData>>['control'];
  fieldErrorMessage: (key: string) => string | undefined;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Controller
      control={control}
      name='file'
      render={({ field }) => {
        return (
          <div className='flex flex-col gap-1.5'>
            <span className='text-sm font-medium text-foreground'>
              Transcript file
              <span className='ml-2 text-xs font-normal text-muted-foreground'>
                Any text format or archive · up to 10 MB
              </span>
            </span>
            <input
              ref={fileInputRef}
              type='file'
              accept={ACCEPT_EXTENSIONS}
              aria-label='Transcript file'
              className='sr-only'
              onChange={(e) => {
                return handleFileChange(e, field.onChange);
              }}
            />
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => {
                  return fileInputRef.current?.click();
                }}
                className='inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70'
              >
                <Upload className='size-3.5' />
                Choose file
              </button>
              <span className='text-sm text-muted-foreground'>
                {field.value ? (
                  <>
                    {field.value.name}
                    <span className='ml-1 text-xs'>
                      · {(field.value.size / 1024).toFixed(1)} KB
                    </span>
                  </>
                ) : (
                  'No file chosen'
                )}
              </span>
            </div>
            {fieldErrorMessage('file') && (
              <Error id='file-error'>{fieldErrorMessage('file')}</Error>
            )}
          </div>
        );
      }}
    />
  );
}

interface ModeTabButtonProps {
  isActive: boolean;
  disabled?: boolean;
  tooltip?: string;
  onActivate: () => void;
  onArrow: () => void;
}

function ModeTabButton({
  isActive,
  disabled,
  tooltip,
  onActivate,
  onArrow,
  children,
}: PropsWithChildren<ModeTabButtonProps>) {
  return (
    <button
      type='button'
      role='tab'
      aria-selected={isActive}
      aria-disabled={disabled}
      title={tooltip}
      onClick={() => {
        return !disabled && onActivate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onArrow();
      }}
      className={[
        'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}
