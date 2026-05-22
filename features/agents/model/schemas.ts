import { z } from 'zod';

import { AGENT_EXECUTION_MODES } from './types';

export const jsonStringSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;

    try {
      JSON.parse(value);

      return true;
    } catch {
      return false;
    }
  }, 'Enter valid JSON');

const agentProfileBase = z.object({
  name: z.string().min(2, 'At least 2 characters').max(255),
  description: z.string(),
  system_prompt: z.string().max(32_000),
  sandbox_profile: z.string(),
  allowed_outbound_hosts: z.string(),
  execution_mode: z.enum(AGENT_EXECUTION_MODES).nullable().optional(),
  default_model: z.string().max(120),
  enabled: z.boolean(),
  config_schema: jsonStringSchema,
  task_payload_schema: jsonStringSchema,
  metadata: jsonStringSchema,
});

export const agentProfileCreateSchema = agentProfileBase.extend({
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(255)
    .regex(/^[a-z0-9_-]+$/, 'Lowercase letters, digits, underscores, hyphens only'),
  allowed_tools: z.array(z.string()),
});

export const agentProfileEditSchema = agentProfileBase;

export type AgentProfileCreateValues = z.infer<typeof agentProfileCreateSchema>;
export type AgentProfileEditValues = z.infer<typeof agentProfileEditSchema>;
