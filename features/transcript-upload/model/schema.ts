import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ACCEPT_EXTENSIONS = '.json,.txt,.vtt,.srt';
export const MAX_ENTRIES = 10_000;

const fileSchema = z
  .instanceof(File, { error: 'Выберите файл транскрипта' })
  .refine((f) => f.size > 0, { message: 'Файл пустой' })
  .refine((f) => f.size <= MAX_FILE_SIZE_BYTES, {
    message: 'Файл больше 5 МБ',
  });

const existingMeetingSchema = z.object({
  mode: z.literal('existing'),
  calendar_event_id: z.number({ error: 'Выберите встречу' }),
  file: fileSchema,
});

const newMeetingSchema = z
  .object({
    mode: z.literal('new'),
    title: z
      .string({ error: 'Укажите название встречи' })
      .min(1, 'Укажите название встречи')
      .max(255, 'Название слишком длинное'),
    starts_at: z
      .string({ error: 'Укажите начало встречи' })
      .min(1, 'Укажите начало встречи'),
    ends_at: z
      .string({ error: 'Укажите окончание встречи' })
      .min(1, 'Укажите окончание встречи'),
    team_id: z.number().optional(),
    file: fileSchema,
  })
  .refine((v) => new Date(v.ends_at) >= new Date(v.starts_at), {
    message: 'Окончание должно быть не раньше начала',
    path: ['ends_at'],
  });

export const transcriptUploadSchema = z.discriminatedUnion('mode', [
  existingMeetingSchema,
  newMeetingSchema,
]);

export type TranscriptUploadFormData = z.infer<typeof transcriptUploadSchema>;

export const ERROR_CODE_MESSAGES: Record<string, string> = {
  NO_SOURCE: 'Подключите календарь, чтобы загружать транскрипты.',
  TRANSCRIPT_PARSE_FAILED:
    'Не удалось разобрать файл. Проверьте формат: JSON Recall, TXT, VTT или SRT.',
  TOO_MANY_ENTRIES: `В транскрипте слишком много строк (лимит ${MAX_ENTRIES.toLocaleString('ru-RU')}).`,
  UNSUPPORTED_FORMAT: 'Формат файла не поддерживается.',
};

export const getUploadErrorMessage = (
  code: string | undefined,
  fallback: string,
): string => (code && ERROR_CODE_MESSAGES[code]) || fallback;
