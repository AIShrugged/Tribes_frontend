'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type {
  TeamNotificationSetting,
  TeamNotificationSettingCreateDTO,
  TeamNotificationSettingUpdateDTO,
} from '@/features/teams/model/types';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * Fetch all notification settings for a team.
 */
export async function getTeamNotificationSettings(
  teamId: number | string,
): Promise<TeamNotificationSetting[]> {
  const { data } = await httpClient<TeamNotificationSetting[]>(
    `${API_URL}/teams/${teamId}/notification-settings`,
  );
  return data ?? [];
}

/**
 * Create a notification setting for a team.
 */
export async function createTeamNotificationSetting(
  teamId: number | string,
  payload: TeamNotificationSettingCreateDTO,
): Promise<ActionResult<TeamNotificationSetting>> {
  try {
    const { data } = await httpClient<TeamNotificationSetting>(
      `${API_URL}/teams/${teamId}/notification-settings`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    revalidatePath('/dashboard/teams', 'page');

    if (!data) {
      return { data: null, error: 'Empty response from server' };
    }

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create notification setting',
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

/**
 * Update an existing notification setting (enabled flag and/or minutes_before).
 */
export async function updateTeamNotificationSetting(
  teamId: number | string,
  settingId: number,
  payload: TeamNotificationSettingUpdateDTO,
): Promise<ActionResult<TeamNotificationSetting>> {
  try {
    const { data } = await httpClient<TeamNotificationSetting>(
      `${API_URL}/teams/${teamId}/notification-settings/${settingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    revalidatePath('/dashboard/teams', 'page');

    if (!data) {
      return { data: null, error: 'Empty response from server' };
    }

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to update notification setting',
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

/**
 * Delete a notification setting.
 */
export async function deleteTeamNotificationSetting(
  teamId: number | string,
  settingId: number,
): Promise<ActionResult<null>> {
  try {
    await httpClient<null>(
      `${API_URL}/teams/${teamId}/notification-settings/${settingId}`,
      { method: 'DELETE' },
    );

    revalidatePath('/dashboard/teams', 'page');

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete notification setting',
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
