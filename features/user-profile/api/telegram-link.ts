'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type { TelegramLinkData } from '@/features/user-profile/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function generateTelegramLink(): Promise<
  ActionResult<TelegramLinkData>
> {
  try {
    const { data } = await httpClient<TelegramLinkData>(
      `${API_URL}/telegram/link`,
      { method: 'POST' },
    );
    if (!data) {
      return { data: null, error: 'No link data returned from server.' };
    }
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to generate Telegram link',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}