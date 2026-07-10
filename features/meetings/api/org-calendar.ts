'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { CalendarEventListItem } from '@/features/meetings/model/types';

const PAGE_SIZE = 100;

/**
 * Fetch one page of a single organization's bot meetings.
 *
 * Backend contract (GET /calendar-events/organization): `organization_id` is
 * required and scopes the list to meetings where the creator connected the bot
 * from that organization. A 403 means the user is not a member of it.
 * @param organizationId - organization whose calendar to list.
 * @param offset - items to skip.
 * @param limit - page size (1–100).
 * @param range - optional date bounds (YYYY-MM-DD).
 */
export async function getOrgCalendarEvents(
  organizationId: number,
  offset: number,
  limit: number,
  range?: { from?: string; to?: string },
) {
  const params = new URLSearchParams({
    organization_id: String(organizationId),
    offset: String(offset),
    limit: String(limit),
  });

  if (range?.from) params.set('date_from', range.from);
  if (range?.to) params.set('date_to', range.to);

  return httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events/organization?${params.toString()}`,
  );
}

/**
 * Fetch ALL of an organization's calendar events for a date range via parallel
 * pagination. First request establishes totalCount, then remaining pages load in
 * parallel. Uses Promise.allSettled so a single failing page doesn't discard all
 * data.
 * @param organizationId - organization whose calendar to list.
 * @param dateFrom - lower bound (YYYY-MM-DD).
 * @param dateTo - upper bound (YYYY-MM-DD).
 */
export async function getAllOrgCalendarEvents(
  organizationId: number,
  dateFrom: string,
  dateTo: string,
): Promise<CalendarEventListItem[]> {
  const range = { from: dateFrom, to: dateTo };
  const first = await getOrgCalendarEvents(organizationId, 0, PAGE_SIZE, range);
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
      return getOrgCalendarEvents(organizationId, offset, PAGE_SIZE, range);
    }),
  );

  for (const page of pages) {
    if (page.status === 'fulfilled') {
      results.push(...page.value.data);
    }
  }

  return results;
}
