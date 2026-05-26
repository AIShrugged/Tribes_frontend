'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { ActionResult } from '@/shared/types/server-action';

export async function executeAiAction(
  name: string,
  prompt: string,
): Promise<ActionResult<{ task_id: number }>> {
  try {
    const organizationId = await getOrganizationId();

    // Create agent task
    const { data: task } = await httpClient<{ id: number }>(
      `${API_URL}/agent-tasks`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          prompt,
          organization_id: organizationId,
          schedule_type: 'one_off',
          enabled: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!task?.id) {
      return { data: null, error: 'Failed to create agent task' };
    }

    // Dispatch immediately
    await httpClient(`${API_URL}/agent-tasks/${task.id}/dispatch`, {
      method: 'POST',
    });

    return { data: { task_id: task.id }, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to execute AI action',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}
