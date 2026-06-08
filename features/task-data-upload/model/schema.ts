import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const fileSchema = z
  .instanceof(File, { error: 'Select a file' })
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
    { message: 'File exceeds 10 MB' },
  );

export const taskDataUploadSchema = z.object({
  file: fileSchema,
  team_id: z.number().optional(),
});

export type TaskDataUploadFormData = z.infer<typeof taskDataUploadSchema>;

export const ERROR_CODE_MESSAGES: Record<string, string> = {
  TEAM_ORG_MISMATCH: 'Selected team is not in your organization.',
  TASK_DATA_PARSE_FAILED: 'Could not process the file. Try a different format.',
  CONTENT_NOT_RELEVANT:
    'This file does not appear to be related to your organization’s work. Please upload meeting notes, task lists, or project documents.',
};

export const getUploadErrorMessage = (
  code: string | undefined,
  fallback: string,
): string => {
  return (code && ERROR_CODE_MESSAGES[code]) || fallback;
};
