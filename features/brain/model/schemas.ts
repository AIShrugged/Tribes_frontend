import { z } from 'zod';

/**
 * Credential form schema for enabling / rotating an organization's second brain.
 * `claude_auth_token` requires min length 8 (matches the backend FormRequest).
 * Both fields are always present in the form; the api layer omits them for a
 * plain re-enable (`{}`).
 */
export const enableBrainSchema = z.object({
  claude_auth_type: z.enum(['oauth', 'api_key'], {
    error: 'Выберите тип авторизации',
  }),
  claude_auth_token: z
    .string()
    .min(8, 'Токен должен содержать минимум 8 символов'),
});

export type EnableBrainFormValues = z.infer<typeof enableBrainSchema>;
