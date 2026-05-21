'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { EventProps } from '@/entities/event';
import type { MeetingTask } from '@/features/meeting/types';
import type {
  CalendarEventDetailResponse,
  CalendarEventListItem,
} from '@/features/meetings/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getEvent(id: string) {
  const { data } = await httpClient<EventProps>(
    `${API_URL}/calendar-events/${id}`,
  );

  return { data };
}

export async function getEvents() {
  const { data } = await httpClient<EventProps[]>(
    `${API_URL}/calendar-events?limit=50`,
  );

  return { data };
}

export async function getCalendarEvents(offset = 0, limit = 20) {
  const { data, totalCount } = await httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events?offset=${offset}&limit=${limit}`,
  );

  return { data, totalCount };
}

export async function getCalendarEventDetail(calendarEventId: string | number) {
  const { data } = await httpClient<CalendarEventDetailResponse>(
    `${API_URL}/calendar-events/${calendarEventId}/detail`,
  );

  return { data };
}

export async function switchBot(
  eventId: number,
  botRequired: boolean,
): Promise<ActionResult<CalendarEventDetailResponse>> {
  try {
    const { data } = await httpClient<CalendarEventDetailResponse>(
      `${API_URL}/calendar-events/${eventId}/bot/require`,
      {
        method: 'POST',
        body: JSON.stringify({ required_bot: botRequired }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!data) {
      return { data: null, error: 'Invalid API response' };
    }

    revalidatePath(ROUTES.DASHBOARD.MEETINGS_CALENDAR);
    revalidatePath(ROUTES.DASHBOARD.MEETINGS_LIST);
    revalidatePath(ROUTES.DASHBOARD.MEETINGS_ORGANIZATION);

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to update bot',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

export async function getMeetingTasks(
  calendarEventId: string,
): Promise<MeetingTask[]> {
  const { data } = await httpClient<MeetingTask[]>(
    `${API_URL}/calendar-events/${calendarEventId}/tasks`,
  );

  return data ?? [];
}
