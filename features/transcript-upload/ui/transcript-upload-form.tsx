'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
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

import type { TeamProps } from '@/entities/team';
import type { CalendarEventListItem } from '@/features/meetings/model/types';

type Mode = 'existing' | 'new';

interface Props {
  meetings: CalendarEventListItem[];
  teams: TeamProps[];
  onClose: () => void;
}

/**
 * RHF-driven form with two modes via discriminated zod union.
 *
 * RHF default shouldUnregister:false preserves field values across mode
 * switches, so a user can type a title, switch to existing-meeting mode,
 * come back, and find their input intact.
 */
export function TranscriptUploadForm({ meetings, teams, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rootError, setRootError] = useState('');

  const newMeetingDisabled = teams.length === 0;
  // Auto-select team when user has exactly one (mirrors backend behaviour).
  const autoSelectedTeamId = teams.length === 1 ? teams[0].id : undefined;

  const [mode, setMode] = useState<Mode>('existing');

  // Sensible defaults for "new meeting" mode: a 30-minute slot ending now.
  // Computed once on first render so re-renders don't reset the user's input.
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
        const userMessage = getUploadErrorMessage(
          result.errorCode,
          result.error,
        );

        // Distribute Laravel-style field errors when present.
        if (result.fieldErrors) {
          for (const [field, msg] of Object.entries(result.fieldErrors)) {
            setError(field as keyof TranscriptUploadFormData, {
              message: msg,
            });
          }
        }

        const onlyFieldErrors =
          result.fieldErrors && Object.keys(result.fieldErrors).length > 0;

        if (onlyFieldErrors) {
          setRootError(userMessage);
        } else {
          toast.error(userMessage);
          setRootError(userMessage);
        }
        return;
      }

      const uploadResponse = result.data;
      if (!uploadResponse) return; // narrow for TS; unreachable in practice

      toast.success('Транскрипт загружен. Саммари появится через 1-2 минуты.');
      onClose();
      router.push(
        ROUTES.DASHBOARD.MEETING_DETAIL_TRANSCRIPT(
          uploadResponse.calendar_event_id,
        ),
      );
    });
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
      toast.error('Файл больше 5 МБ');
      event.target.value = '';
      onChange();
      return;
    }
    onChange(file);
  };

  const meetingOptions = meetings.map((m) => {
    return {
      value: String(m.id),
      label: `${m.title} — ${new Date(m.starts_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`,
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
      {/* Mode tabs */}
      <div
        role='tablist'
        aria-label='Режим загрузки'
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
          К существующей встрече
        </ModeTabButton>
        <ModeTabButton
          isActive={mode === 'new'}
          disabled={newMeetingDisabled}
          tooltip={
            newMeetingDisabled
              ? 'Создайте команду, чтобы загружать транскрипты без встречи'
              : undefined
          }
          onActivate={() => {
            return switchMode('new');
          }}
          onArrow={() => {
            return switchMode('existing');
          }}
        >
          Создать новую
        </ModeTabButton>
      </div>

      <input type='hidden' {...register('mode')} value={mode} readOnly />

      {/* Mode A: existing meeting */}
      {mode === 'existing' && (
        <Controller
          control={control}
          name='calendar_event_id'
          render={({ field }) => {
            return (
              <div className='flex flex-col gap-1.5'>
                <label className='text-sm font-medium text-foreground'>
                  Встреча
                </label>
                <InputDropdown
                  options={meetingOptions}
                  value={field.value === undefined ? '' : String(field.value)}
                  onChange={(v) => {
                    return field.onChange(Number(v));
                  }}
                  placeholder={
                    meetingOptions.length === 0
                      ? 'У вас нет прошедших встреч'
                      : 'Выберите встречу'
                  }
                  searchable
                  error={fieldErrorMessage('calendar_event_id')}
                />
              </div>
            );
          }}
        />
      )}

      {/* Mode B: new meeting */}
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
                    Название встречи
                  </label>
                  <Input
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder='Например: Tribes техсинк'
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
                      Начало
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
                      Окончание
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
                      Команда
                    </label>
                    <InputDropdown
                      options={teamOptions}
                      value={
                        field.value === undefined ? '' : String(field.value)
                      }
                      onChange={(v) => {
                        return field.onChange(Number(v));
                      }}
                      placeholder='Выберите команду'
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

      {/* File input */}
      <Controller
        control={control}
        name='file'
        render={({ field }) => {
          return (
            <div className='flex flex-col gap-1.5'>
              <label
                htmlFor='transcript-upload-file'
                className='text-sm font-medium text-foreground'
              >
                Файл транскрипта
                <span className='ml-2 text-xs font-normal text-muted-foreground'>
                  JSON, TXT, VTT или SRT · до 5 МБ
                </span>
              </label>
              <input
                id='transcript-upload-file'
                type='file'
                accept={ACCEPT_EXTENSIONS}
                onChange={(e) => {
                  return handleFileChange(e, field.onChange);
                }}
                className='text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90'
              />
              {field.value && (
                <p className='text-xs text-muted-foreground'>
                  {field.value.name} · {(field.value.size / 1024).toFixed(1)} КБ
                </p>
              )}
              {fieldErrorMessage('file') && (
                <Error id='file-error'>{fieldErrorMessage('file')}</Error>
              )}
            </div>
          );
        }}
      />

      {rootError && <p className='text-sm text-destructive'>{rootError}</p>}

      <div className='flex justify-end gap-2 pt-2'>
        <Button
          type='button'
          variant={BUTTON_VARIANT.secondary}
          onClick={onClose}
          disabled={isPending}
        >
          Отмена
        </Button>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Загрузка…' : 'Загрузить'}
        </Button>
      </div>
    </form>
  );
}

interface ModeTabButtonProps {
  isActive: boolean;
  disabled?: boolean;
  tooltip?: string;
  onActivate: () => void;
  onArrow: () => void;
  children: React.ReactNode;
}

function ModeTabButton({
  isActive,
  disabled,
  tooltip,
  onActivate,
  onArrow,
  children,
}: ModeTabButtonProps) {
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

/**
 * Format a Date as `YYYY-MM-DDTHH:mm` in local time — the value shape
 * `<input type="datetime-local">` expects.
 */
function toDatetimeLocalString(d: Date): string {
  const pad = (n: number) => {
    return String(n).padStart(2, '0');
  };
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
