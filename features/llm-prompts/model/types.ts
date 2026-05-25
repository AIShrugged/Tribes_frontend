export interface LlmPromptProps {
  id: number;
  organization_id: number | null;
  slug: string;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

export interface LlmPromptSeedStats {
  created: number;
  updated: number;
  skipped: number;
}

export const LLM_PROMPT_GROUPS = [
  'agent',
  'agenda',
  'chat',
  'critical_path',
  'decisions',
  'demo',
  'digest',
  'followup',
  'issue',
  'meeting',
  'methodology',
  'onboarding',
  'telegram',
  'today',
] as const;

export type LlmPromptGroup = (typeof LLM_PROMPT_GROUPS)[number];
