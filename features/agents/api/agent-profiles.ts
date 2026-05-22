'use server';

import { revalidatePath } from 'next/cache';
import { cache } from 'react';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientAction, httpClientList } from '@/shared/lib/httpClient';

import type {
  AgentMemory,
  AgentProfile,
  AgentProfileCreatePayload,
  AgentProfilePromptVersion,
  AgentProfileTool,
  AgentProfileUpdatePayload,
  AgentTasksMeta,
  AgentToolDefinition,
} from '@/features/agents/model/types';
import type { PaginatedResult } from '@/shared/types/common';
import type { ActionResult } from '@/shared/types/server-action';

const DEFAULT_MEMORIES_LIMIT = 50;
const MAX_MEMORIES_LIMIT = 200;

export async function getAgentProfiles(limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const params = new URLSearchParams({ offset: '0', limit: String(safeLimit) });
  const { data, totalCount } = await httpClientList<AgentProfile>(
    `${API_URL}/agent-profiles?${params}`,
  );

  return { data, totalCount };
}

export const getAgentProfile = cache(async (id: number) => {
  const { data } = await httpClient<AgentProfile>(
    `${API_URL}/agent-profiles/${id}`,
  );

  if (!data) {
    throw new ServerError('Not found', { status: 404, url: `${API_URL}/agent-profiles/${id}`, responseBody: '' });
  }

  return data;
});

export async function createAgentProfile(payload: AgentProfileCreatePayload) {
  const result = await httpClientAction<AgentProfile>(
    `${API_URL}/agent-profiles`,
    { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } },
    'Failed to create agent profile',
  );

  if (result.error === null) {
    revalidatePath('/dashboard/agents/profiles', 'layout');
  }

  return result;
}

export async function updateAgentProfile(
  id: number,
  payload: AgentProfileUpdatePayload,
) {
  const result = await httpClientAction<AgentProfile>(
    `${API_URL}/agent-profiles/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } },
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
  return httpClientAction<unknown>(
    `${API_URL}/agent-profiles/${id}/validate-payload`,
    { method: 'POST', body: JSON.stringify({ payload }), headers: { 'Content-Type': 'application/json' } },
    'Failed to validate payload',
  );
}

export const getAgentTasksMeta = cache(async () => {
  const { data } = await httpClient<AgentTasksMeta>(
    `${API_URL}/agent-tasks/meta`,
  );

  return (data ?? {}) as AgentTasksMeta;
});

export const getAgentTools = cache(async () => {
  const { data } = await httpClient<AgentToolDefinition[]>(
    `${API_URL}/agent-tools`,
  );

  return data ?? [];
});

export const getAgentProfileTools = cache(async (id: number): Promise<AgentProfileTool[]> => {
  if (!Number.isInteger(id) || id <= 0) return [];
  const { data } = await httpClient<AgentProfileTool[]>(`${API_URL}/agent-profiles/${id}/tools`);

  return data ?? [];
});

export async function getAgentProfilePromptVersions(id: number): Promise<AgentProfilePromptVersion[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  const { data } = await httpClient<AgentProfilePromptVersion[]>(
    `${API_URL}/agent-profiles/${id}/prompt-versions`,
  );

  return data ?? [];
}

export async function restoreAgentProfilePromptVersion(
  profileId: number,
  versionNumber: number,
): Promise<ActionResult<AgentProfile>> {
  if (
    !Number.isInteger(profileId) || profileId <= 0 ||
    !Number.isInteger(versionNumber) || versionNumber <= 0
  ) {
    return { data: null, error: 'Invalid profile or version' };
  }

  const result = await httpClientAction<AgentProfile>(
    `${API_URL}/agent-profiles/${profileId}/prompt-versions/${versionNumber}/restore`,
    { method: 'POST' },
    'Failed to restore prompt version',
  );

  if (result.error === null) {
    revalidatePath(`/dashboard/agents/profiles/${profileId}`, 'layout');
  }

  return result;
}

export async function getProfileMemories(
  profileId: number,
  offset = 0,
  limit = DEFAULT_MEMORIES_LIMIT,
): Promise<PaginatedResult<AgentMemory>> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_MEMORIES_LIMIT);
  const safeOffset = Math.max(offset, 0);
  const params = new URLSearchParams({
    offset: String(safeOffset),
    limit: String(safeLimit),
  });
  const { data, totalCount } = await httpClientList<AgentMemory>(
    `${API_URL}/agent-profiles/${profileId}/memories?${params}`,
  );

  return {
    data,
    totalCount,
    hasMore: safeOffset + data.length < totalCount,
  };
}
