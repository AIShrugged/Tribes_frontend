'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type { MeetingAgenda } from '@/features/brain/model/types';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * Fetches the agendas for a calendar event — the shared `general` agenda plus
 * the current user's `personal` one (the backend filters by `user_id`). The tab
 * renders the `general` element. A not-found event (not owned) maps to an empty
 * list, matching the empty-state contract.
 * @param calendarEventId - the calendar event id.
 */
export async function getMeetingAgendas(
  calendarEventId: number,
): Promise<MeetingAgenda[]> {
  try {
    const { data } = await httpClientList<MeetingAgenda>(
      `${API_URL}/calendar-events/${calendarEventId}/agendas`,
    );

    return data;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

/**
 * Manually (re)generates the agenda — manager-only. The backend dispatches an
 * async job and answers 202, so the fresh agenda arrives on a later refetch
 * (expect `pending`/`in_progress` immediately after).
 * @param calendarEventId - the calendar event id.
 */
export async function generateMeetingAgenda(
  calendarEventId: number,
): Promise<ActionResult<null>> {
  try {
    await httpClient<null>(
      `${API_URL}/calendar-events/${calendarEventId}/agendas/generate`,
      { method: 'POST' },
    );

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Не удалось запустить генерацию агенды',
      );

      return {
        data: null,
        error: parsed.message,
        errorCode: parsed.errorCode,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}
