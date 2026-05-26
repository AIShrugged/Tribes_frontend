'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { CalendarEventListItem } from '@/entities/event/model/types';

export async function getPastEventsForPicker(
  limit = 50,
): Promise<CalendarEventListItem[]> {
  const params = new URLSearchParams({
    scope: 'past',
    offset: '0',
    limit: String(limit),
  });
  const result = await httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events?${params.toString()}`,
  );
  return result.data;
}
