'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { TeamNotificationSetting } from '@/entities/team-notification-setting';
import type { ActionResult } from '@/shared/types/server-action';

const CHANNEL = 'telegram';

/**
 * All notification settings for a team (read-only, called from a Server Component).
 */
export async function getTeamNotificationSettings(
  teamId: number | string,
): Promise<TeamNotificationSetting[]> {
  const { data } = await httpClientList<TeamNotificationSetting>(
    `${API_URL}/teams/${teamId}/notification-settings`,
  );
  return data ?? [];
}

/**
 * Replace the full set of recipient chats for one event_type (1:M, R1/R4).
 * Atomic on the backend — existing rows keep their `enabled`/`minutes_before`.
 */
export async function syncChatNotifications(
  teamId: number,
  eventType: string,
  chatIds: number[],
): Promise<ActionResult<TeamNotificationSetting[]>> {
  return putList(`${API_URL}/teams/${teamId}/notification-settings/sync`, {
    event_type: eventType,
    channel_type: CHANNEL,
    chat_ids: chatIds,
  });
}

/**
 * Enable/disable an entire event_type without losing its recipient set (R2).
 */
export async function setEventEnabled(
  teamId: number,
  eventType: string,
  enabled: boolean,
): Promise<ActionResult<TeamNotificationSetting[]>> {
  return putList(`${API_URL}/teams/${teamId}/notification-settings/set-enabled`, {
    event_type: eventType,
    channel_type: CHANNEL,
    enabled,
  });
}

/**
 * Set the lead time (minutes before the meeting) for an event_type — agenda / pre-brief.
 */
export async function setEventMinutesBefore(
  teamId: number,
  eventType: string,
  minutesBefore: number | null,
): Promise<ActionResult<TeamNotificationSetting[]>> {
  return putList(
    `${API_URL}/teams/${teamId}/notification-settings/set-minutes-before`,
    {
      event_type: eventType,
      channel_type: CHANNEL,
      minutes_before: minutesBefore,
    },
  );
}

async function putList(
  url: string,
  body: Record<string, unknown>,
): Promise<ActionResult<TeamNotificationSetting[]>> {
  try {
    const { data } = await httpClientList<TeamNotificationSetting>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    revalidatePath(ROUTES.DASHBOARD.TELEGRAM_NOTIFICATIONS);

    return { data: data ?? [], error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to update notifications',
      );
      return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
    }
    throw error;
  }
}
