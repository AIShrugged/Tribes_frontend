import { z } from 'zod';

export const addTelegramChatSchema = z.object({
  // Handled with register + setValueAs so empty input sends undefined (not NaN)
  telegram_chat_id: z
    .number({ error: 'Required — enter a group Chat ID' })
    .int(),
  message_thread_id: z
    .number()
    .int()
    .positive({ message: 'Topic ID must be a positive number' })
    .optional()
    .nullable()
    .transform((v) => {
      return v ?? null;
    }),
  name: z
    .string()
    .max(255)
    .optional()
    .transform((v) => {
      return v === '' || v === undefined ? null : v;
    }),
});

export type AddTelegramChatFormValues = z.infer<typeof addTelegramChatSchema>;
export type AddTelegramChatFormInput = z.input<typeof addTelegramChatSchema>;
