'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type { MeetingSummary } from '@/features/brain/model/types';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * Fetches the meeting protocol (AI summary) for a calendar event. The backend
 * scopes to the current user's OWN events and returns 404 both when no summary
 * has been generated yet and when the event is not the user's — both cases map
 * to `null` (render an empty state, not an error).
 * @param calendarEventId - the calendar event id.
 */
export async function getMeetingSummary(
  calendarEventId: number,
): Promise<MeetingSummary | null> {
  try {
    const { data } = await httpClient<MeetingSummary>(
      `${API_URL}/calendar-events/${calendarEventId}/meeting-summary`,
    );

    return data;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

/**
 * Manually (re)generates the protocol — manager-only, for testing/regeneration.
 * Runs synchronously on the backend and returns the fresh summary.
 * @param calendarEventId - the calendar event id.
 */
export async function generateMeetingSummary(
  calendarEventId: number,
): Promise<ActionResult<MeetingSummary>> {
  try {
    const { data } = await httpClient<MeetingSummary>(
      `${API_URL}/calendar-events/${calendarEventId}/meeting-summary/generate`,
      { method: 'POST' },
    );

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Не удалось сгенерировать протокол',
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
