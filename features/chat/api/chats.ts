'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type { Chat, ChatUpsertDTO } from '@/features/chat/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getChats(
  offset = 0,
  limit = 20,
): Promise<{ data: Chat[]; totalCount: number; hasMore: boolean }> {
  const result = await httpClientList<Chat>(
    `${API_URL}/chats?offset=${offset}&limit=${limit}`,
  );
  // Preserve offset-based hasMore formula — httpClientList uses data.length < totalCount
  // which gives wrong result for partial pages in offset pagination.
  return {
    data: result.data,
    totalCount: result.totalCount,
    hasMore: offset + result.data.length < result.totalCount,
  };
}

export async function getChat(id: number): Promise<Chat> {
  const { data } = await httpClient<Chat>(`${API_URL}/chats/${id}`);
  return data!;
}

export async function createChat(
  payloadOrTitle: Partial<ChatUpsertDTO> | string | null = {},
): Promise<ActionResult<Chat>> {
  const payload =
    typeof payloadOrTitle === 'string' || payloadOrTitle === null
      ? { title: payloadOrTitle }
      : payloadOrTitle;

  const body: Record<string, number | string | null> = {};
  if ('title' in payload) body.title = payload.title ?? null;
  if ('organization_id' in payload)
    body.organization_id = payload.organization_id ?? null;
  if ('team_id' in payload) body.team_id = payload.team_id ?? null;

  try {
    const { data } = await httpClient<Chat>(`${API_URL}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create chat',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}

export async function updateChat(
  id: number,
  payload: Partial<ChatUpsertDTO>,
): Promise<ActionResult<Chat>> {
  const body: Record<string, number | string | null> = {};
  if ('title' in payload) body.title = payload.title ?? null;
  if ('organization_id' in payload)
    body.organization_id = payload.organization_id ?? null;
  if ('team_id' in payload) body.team_id = payload.team_id ?? null;

  try {
    const { data } = await httpClient<Chat>(`${API_URL}/chats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to update chat',
      );
      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }
    throw error;
  }
}

export async function updateChatTitle(
  id: number,
  title: string,
): Promise<void> {
  const result = await updateChat(id, { title });
  if (result.error) throw new Error(result.error);
}

export async function deleteChat(id: number): Promise<void> {
  await httpClient(`${API_URL}/chats/${id}`, { method: 'DELETE' });
}
