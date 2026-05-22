'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { CalendarEventListItem } from '@/features/meetings/model/types';

const PAGE_SIZE = 100;

/**
 * Fetch organization-wide bot meetings from the backend.
 * Returns meetings where required_bot=true across all org users.
 */
export async function getOrgCalendarEvents(
  offset: number,
  limit: number,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  return httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events/organization?${params.toString()}`,
  );
}

/**
 * Fetch ALL org calendar events for a date range via parallel pagination.
 * First request establishes totalCount, then remaining pages load in parallel.
 * Uses Promise.allSettled so a single failing page doesn't discard all data.
 */
export async function getAllOrgCalendarEvents(
  dateFrom: string,
  dateTo: string,
): Promise<CalendarEventListItem[]> {
  const first = await getOrgCalendarEvents(0, PAGE_SIZE, dateFrom, dateTo);
  const results: CalendarEventListItem[] = [...first.data];
  const { totalCount } = first;

  if (totalCount <= PAGE_SIZE) {
    return results;
  }

  const remainingOffsets: number[] = [];

  for (let offset = PAGE_SIZE; offset < totalCount; offset += PAGE_SIZE) {
    remainingOffsets.push(offset);
  }

  const pages = await Promise.allSettled(
    remainingOffsets.map((offset) => {
      return getOrgCalendarEvents(offset, PAGE_SIZE, dateFrom, dateTo);
    }),
  );

  for (const page of pages) {
    if (page.status === 'fulfilled') {
      results.push(...page.value.data);
    }
  }

  return results;
}
