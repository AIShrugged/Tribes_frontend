'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { TelegramChatRegistration } from '@/entities/telegram';
import type { TelegramWorkspaceChatCreatePayload } from '@/features/telegram/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getTelegramChats(organizationId: number) {
  const params = new URLSearchParams({
    organization_id: String(organizationId),
  });

  return httpClientList<TelegramChatRegistration>(
    `${API_URL}/telegram/chats?${params.toString()}`,
  );
}

export async function createTelegramWorkspaceChat(
  payload: TelegramWorkspaceChatCreatePayload,
): Promise<ActionResult<TelegramChatRegistration>> {
  try {
    const { data } = await httpClient<TelegramChatRegistration>(
      `${API_URL}/telegram/chats`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    if (!data) {
      throw new ServerError('Empty response from server', {
        url: `${API_URL}/telegram/chats`,
        status: 200,
      });
    }
    // A new (or newly bound) chat changes both the Chats list and the Notifications
    // matrix's available-chats set.
    revalidatePath(ROUTES.DASHBOARD.TELEGRAM_CHATS);
    revalidatePath(ROUTES.DASHBOARD.TELEGRAM_NOTIFICATIONS);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to register chat',
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

export async function deleteTelegramWorkspaceChat(
  id: number,
): Promise<ActionResult<void>> {
  try {
    await httpClient<null>(`${API_URL}/telegram/chats/${id}`, {
      method: 'DELETE',
    });
    revalidatePath(ROUTES.DASHBOARD.TELEGRAM_CHATS);
    revalidatePath(ROUTES.DASHBOARD.TELEGRAM_NOTIFICATIONS);
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to remove chat',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}
