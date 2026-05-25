'use server';

import { revalidatePath } from 'next/cache';

import { getAgentAccessContext } from '@/features/agents/lib/access';
import { isOrgManager } from '@/features/llm-prompts/lib/access';
import { API_URL } from '@/shared/lib/config';
import { httpClientAction } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { LlmPromptUpdatePayload } from '@/features/llm-prompts/model/schemas';
import type { LlmPromptProps, LlmPromptSeedStats } from '@/features/llm-prompts/model/types';
import type { ActionResult } from '@/shared/types/server-action';

const FORBIDDEN_RESULT = { data: null, error: 'You do not have permission to edit prompts.' } as const;

/**
 * updateLlmPrompt — PATCH a single prompt's name and/or prompt text.
 * Requires manager role.
 * @param organizationId - The active organization's ID.
 * @param promptId - The prompt's ID.
 * @param payload - Partial update payload (name, prompt).
 * @returns Promise resolving to ActionResult of LlmPromptProps.
 */
export async function updateLlmPrompt(
  organizationId: number,
  promptId: number,
  payload: Partial<LlmPromptUpdatePayload>,
): Promise<ActionResult<LlmPromptProps>> {
  const ctx = await getAgentAccessContext();

  if (!isOrgManager(ctx.activeOrganization)) {
    return FORBIDDEN_RESULT;
  }

  const result = await httpClientAction<LlmPromptProps>(
    `${API_URL}/organizations/${organizationId}/llm-prompts/${promptId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to update prompt',
  );

  if (result.error === null) {
    revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPT_EDIT(promptId), 'layout');
    revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPTS, 'layout');
  }

  return result;
}

/**
 * resetLlmPrompt — POST to reset a single prompt to its system default.
 * Requires manager role.
 * @param organizationId - The active organization's ID.
 * @param promptId - The prompt's ID.
 * @returns Promise resolving to ActionResult of LlmPromptProps.
 */
export async function resetLlmPrompt(
  organizationId: number,
  promptId: number,
): Promise<ActionResult<LlmPromptProps>> {
  const ctx = await getAgentAccessContext();

  if (!isOrgManager(ctx.activeOrganization)) {
    return FORBIDDEN_RESULT;
  }

  const result = await httpClientAction<LlmPromptProps>(
    `${API_URL}/organizations/${organizationId}/llm-prompts/${promptId}/reset`,
    { method: 'POST' },
    'Failed to reset prompt',
  );

  if (result.error === null) {
    revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPT_EDIT(promptId), 'layout');
    revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPTS, 'layout');
  }

  return result;
}

/**
 * seedLlmPrompts — POST to seed the organization with default prompts.
 * Requires manager role.
 * @param organizationId - The active organization's ID.
 * @param overwrite - When true, overwrites all existing prompts.
 * @returns Promise resolving to ActionResult of LlmPromptSeedStats.
 */
export async function seedLlmPrompts(
  organizationId: number,
  overwrite: boolean,
): Promise<ActionResult<LlmPromptSeedStats>> {
  const ctx = await getAgentAccessContext();

  if (!isOrgManager(ctx.activeOrganization)) {
    return FORBIDDEN_RESULT;
  }

  const result = await httpClientAction<LlmPromptSeedStats>(
    `${API_URL}/organizations/${organizationId}/llm-prompts/seed`,
    {
      method: 'POST',
      body: JSON.stringify({ overwrite }),
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to seed prompts',
  );

  if (result.error === null) {
    revalidatePath(ROUTES.DASHBOARD.AGENT_PROMPTS, 'layout');
  }

  return result;
}
