'use server';

import { revalidatePath } from 'next/cache';
import { cache } from 'react';

import { clearSession } from '@/shared/api/session';
import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  AgentProfile,
  AgentProfilePayload,
  AgentTask,
  AgentTaskPayload,
  AgentTaskRun,
  AgentTasksMeta,
  AgentToolDefinition,
} from '@/features/agents/model/types';
import type { ApiResponse } from '@/shared/types/common';
import type { ActionResult } from '@/shared/types/server-action';

async function actionAgentApi<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<ActionResult<T>> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) await clearSession();

    const text = await response.text();
    const parsed = parseApiError(text, fallbackMessage);

    if (response.status === 403 || response.status === 422) {
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw new ServerError(parsed.message, {
      status: response.status,
      url: response.url,
      responseBody: text,
    });
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    return {
      data: null,
      error: json.error ?? fallbackMessage,
    };
  }

  return { data: json.data as T, error: null };
}

export async function getAgentProfiles(limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const params = new URLSearchParams({ offset: '0', limit: String(safeLimit) });
  const { data, totalCount } = await httpClientList<AgentProfile>(
    `${API_URL}/agent-profiles?${params}`,
  );

  return { data, totalCount };
}

export async function getAgentProfile(id: number) {
  const { data } = await httpClient<AgentProfile>(
    `${API_URL}/agent-profiles/${id}`,
  );

  return data as AgentProfile;
}

export async function createAgentProfile(payload: AgentProfilePayload) {
  const result = await actionAgentApi<AgentProfile>(
    '/agent-profiles',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create agent profile',
  );

  if (result.error === null) {
    revalidatePath('/dashboard/agents/profiles', 'layout');
  }

  return result;
}

export async function updateAgentProfile(
  id: number,
  payload: Partial<AgentProfilePayload>,
) {
  const result = await actionAgentApi<AgentProfile>(
    `/agent-profiles/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update agent profile',
  );

  if (result.error === null) {
    revalidatePath(`/dashboard/agents/profiles/${id}`, 'layout');
  }

  return result;
}

export async function deleteAgentProfile(
  id: number,
): Promise<ActionResult<null>> {
  try {
    await httpClient(`${API_URL}/agent-profiles/${id}`, { method: 'DELETE' });
    revalidatePath('/dashboard/agents/profiles', 'layout');

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete agent profile',
      );

      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

export async function validateAgentProfilePayload(
  id: number,
  payload: Record<string, unknown> | null,
) {
  return actionAgentApi<unknown>(
    `/agent-profiles/${id}/validate-payload`,
    { method: 'POST', body: JSON.stringify({ payload }) },
    'Failed to validate payload',
  );
}

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
  const result = await actionAgentApi<AgentTask>(
    '/agent-tasks',
    { method: 'POST', body: JSON.stringify(payload) },
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
  const result = await actionAgentApi<AgentTask>(
    `/agent-tasks/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
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
  const result = await actionAgentApi<unknown>(
    `/agent-tasks/${id}/dispatch`,
    { method: 'POST', body: JSON.stringify({}) },
    'Failed to dispatch agent task',
  );

  if (result.error === null) {
    revalidatePath(`/dashboard/agents/tasks/${id}`, 'layout');
  }

  return result;
}

export async function getAgentTasksMeta() {
  const { data } = await httpClient<AgentTasksMeta>(
    `${API_URL}/agent-tasks/meta`,
  );

  return (data ?? {}) as AgentTasksMeta;
}

export async function getAgentTools() {
  const { data } = await httpClient<AgentToolDefinition[]>(
    `${API_URL}/agent-tools`,
  );

  return data ?? [];
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
