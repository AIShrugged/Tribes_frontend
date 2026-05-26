import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ACCEPT_EXTENSIONS = '.json,.txt,.vtt,.srt';
export const MAX_ENTRIES = 10_000;

const fileSchema = z
  .instanceof(File, { error: 'Select a transcript file' })
  .refine(
    (f) => {
      return f.size > 0;
    },
    { message: 'File is empty' },
  )
  .refine(
    (f) => {
      return f.size <= MAX_FILE_SIZE_BYTES;
    },
    {
      message: 'File exceeds 5 MB',
    },
  );

const existingMeetingSchema = z.object({
  mode: z.literal('existing'),
  calendar_event_id: z.number({ error: 'Select a meeting' }),
  file: fileSchema,
});

const newMeetingSchema = z
  .object({
    mode: z.literal('new'),
    title: z
      .string({ error: 'Enter a meeting title' })
      .min(1, 'Enter a meeting title')
      .max(255, 'Title is too long'),
    starts_at: z
      .string({ error: 'Enter a start time' })
      .min(1, 'Enter a start time'),
    ends_at: z
      .string({ error: 'Enter an end time' })
      .min(1, 'Enter an end time'),
    team_id: z.number().optional(),
    file: fileSchema,
  })
  .refine(
    (v) => {
      return new Date(v.ends_at) >= new Date(v.starts_at);
    },
    {
      message: 'End time must not be before start time',
      path: ['ends_at'],
    },
  );

export const transcriptUploadSchema = z.discriminatedUnion('mode', [
  existingMeetingSchema,
  newMeetingSchema,
]);

export type TranscriptUploadFormData = z.infer<typeof transcriptUploadSchema>;

export const ERROR_CODE_MESSAGES: Record<string, string> = {
  NO_SOURCE: 'Connect your calendar to upload transcripts.',
  TRANSCRIPT_PARSE_FAILED:
    'Could not parse the file. Check the format: JSON Recall, TXT, VTT, or SRT.',
  TOO_MANY_ENTRIES: `The transcript has too many entries (limit: ${MAX_ENTRIES.toLocaleString('en-US')}).`,
  UNSUPPORTED_FORMAT: 'File format is not supported.',
};

export const getUploadErrorMessage = (
  code: string | undefined,
  fallback: string,
): string => {
  return (code && ERROR_CODE_MESSAGES[code]) || fallback;
};
