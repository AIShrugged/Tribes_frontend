'use server';

import { revalidatePath } from 'next/cache';
import { cache } from 'react';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import {
  httpClient,
  httpClientAction,
  httpClientList,
} from '@/shared/lib/httpClient';

import type {
  AgentTask,
  AgentTaskPayload,
  AgentTaskRun,
} from '@/features/agents/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getAgentTasks(offset = 0, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);
  const params = new URLSearchParams({
    offset: String(safeOffset),
    limit: String(safeLimit),
  });
  const { data, totalCount } = await httpClientList<AgentTask>(
    `${API_URL}/agent-tasks?${params}`,
  );
  const hasTotalCount = Number.isFinite(totalCount) && totalCount > 0;

  return {
    data,
    totalCount,
    hasMore: hasTotalCount
      ? safeOffset + data.length < totalCount
      : data.length === safeLimit,
  };
}

export const getAgentTask = cache(async (id: number) => {
  const { data } = await httpClient<AgentTask>(`${API_URL}/agent-tasks/${id}`);

  return data as AgentTask;
});

export async function createAgentTask(payload: AgentTaskPayload) {
  const result = await httpClientAction<AgentTask>(
    `${API_URL}/agent-tasks`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to create agent task',
  );

  if (result.error === null) {
    revalidatePath('/dashboard/agents/tasks', 'layout');
  }

  return result;
}

export async function updateAgentTask(
  id: number,
  payload: Partial<AgentTaskPayload>,
) {
  const result = await httpClientAction<AgentTask>(
    `${API_URL}/agent-tasks/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to update agent task',
  );

  if (result.error === null) {
    revalidatePath(`/dashboard/agents/tasks/${id}`, 'layout');
  }

  return result;
}

export async function deleteAgentTask(id: number): Promise<ActionResult<null>> {
  try {
    await httpClient(`${API_URL}/agent-tasks/${id}`, { method: 'DELETE' });
    revalidatePath('/dashboard/agents/tasks', 'layout');

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete agent task',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}

export async function dispatchAgentTask(id: number) {
  const result = await httpClientAction<unknown>(
    `${API_URL}/agent-tasks/${id}/dispatch`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    },
    'Failed to dispatch agent task',
  );

  if (result.error === null) {
    revalidatePath(`/dashboard/agents/tasks/${id}`, 'layout');
  }

  return result;
}

export async function getAgentTaskRuns(id: number) {
  const { data, totalCount } = await httpClientList<AgentTaskRun>(
    `${API_URL}/agent-tasks/${id}/runs`,
  );

  return { data, totalCount };
}

export async function getAgentTaskRun(id: number, runId: number) {
  const { data } = await httpClient<AgentTaskRun>(
    `${API_URL}/agent-tasks/${id}/runs/${runId}`,
  );

  return data as AgentTaskRun;
}
