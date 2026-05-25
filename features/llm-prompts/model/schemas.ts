import { z } from 'zod';

export const llmPromptUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Max 255 characters'),
  prompt: z.string().min(1, 'Prompt is required').max(100_000, 'Prompt too long'),
});

export type LlmPromptUpdatePayload = z.infer<typeof llmPromptUpdateSchema>;
