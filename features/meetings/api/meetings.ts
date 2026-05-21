'use server';

import { toEventProps } from '@/features/meetings/model/utils';
import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';


import type { EventProps } from '@/entities/event';
import type { MeetingsListFilters } from '@/features/meetings/model/filters';
import type { CalendarEventListItem } from '@/features/meetings/model/types';
import type { PaginatedResult } from '@/shared/types/common';

function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * Get all personal calendar events for a single day.
 * Backend supports ?date=YYYY-MM-DD (max limit 50 per day).
 */
export async function getMeetingsForDate(
  date: Date,
): Promise<CalendarEventListItem[]> {
  const dateParam = toDateParam(date);
  const params = new URLSearchParams({ date: dateParam, limit: '50' });
  const result = await httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events?${params.toString()}`,
  );

  return result.data;
}

/**
 * Fetch personal calendar events for yesterday, today, and tomorrow in parallel.
 * Returns a tuple of [yesterday, today, tomorrow] event arrays.
 */
export async function getMeetingsForThreeDays(): Promise<{
  yesterday: CalendarEventListItem[];
  today: CalendarEventListItem[];
  tomorrow: CalendarEventListItem[];
}> {
  const now = new Date();

  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  const tomorrow = new Date(now);

  tomorrow.setDate(now.getDate() + 1);

  const [yesterdayData, todayData, tomorrowData] = await Promise.all([
    getMeetingsForDate(yesterday),
    getMeetingsForDate(now),
    getMeetingsForDate(tomorrow),
  ]);

  return {
    yesterday: yesterdayData,
    today: todayData,
    tomorrow: tomorrowData,
  };
}

/**
 * Fetch a filtered, paginated list of calendar events.
 * Supports scope (past/upcoming), team_id, user_id, and standard offset/limit pagination.
 */
export async function getMeetingsList(
  filters: MeetingsListFilters,
): Promise<PaginatedResult<CalendarEventListItem>> {
  const params = new URLSearchParams();

  if (filters.scope !== 'all') {
    params.set('scope', filters.scope);
  }
  if (filters.team_id != null) {
    params.set('team_id', String(filters.team_id));
  }
  if (filters.user_id != null) {
    params.set('user_id', String(filters.user_id));
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;

  params.set('offset', String(offset));
  params.set('limit', String(limit));

  return httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events?${params.toString()}`,
  );
}

/**
 * Fetch all personal calendar events for a given month by fetching each day in parallel.
 * Uses ?date=YYYY-MM-DD (one request per day) since the backend has no range filter.
 * Only days in the month are fetched. Empty days return [].
 */
export async function getCalendarEventsForMonth(
  month: string,
): Promise<EventProps[]> {
  // Parse the month string arithmetically to avoid timezone-dependent Date construction.
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const dayRequests = Array.from({ length: daysInMonth }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, '0');
    const monStr = String(monthNum).padStart(2, '0');
    const dateStr = `${year}-${monStr}-${dayStr}`;

    return getMeetingsForDate(new Date(`${dateStr}T00:00:00`));
  });

  const results = await Promise.all(dayRequests);

  return results.flat().map((item) => {return toEventProps(item)});
}
