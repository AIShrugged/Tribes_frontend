'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { MeetingListItem } from '../model/types';

export async function getRecentMeetings(
  limit: number = 10,
): Promise<MeetingListItem[]> {
  const result = await httpClientList<MeetingListItem>(
    `${API_URL}/calendar-events?limit=${limit}&sort=-starts_at`,
  );
  return result.data;
}

export async function getCalendarEventsByDate(
  date: string,
): Promise<MeetingListItem[]> {
  const params = new URLSearchParams({ date, scope: 'past' });
  const result = await httpClientList<MeetingListItem>(
    `${API_URL}/calendar-events?${params}`,
  );
  return result.data;
}
