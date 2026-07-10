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

/** Backend limit cap for a single page of the viewable list (1–100). */
const ORG_PICKER_PAGE_SIZE = 100;

/**
 * Fetches ONE page of the meetings VIEWABLE by the current user. Unlike
 * {@link getPastEventsForPicker} (only one's own events) this returns every
 * meeting the second brain can process — colleagues' bot meetings AND manual
 * transcript uploads — ordered by `starts_at` desc. The read endpoints
 * (`/{id}/meeting-summary`, `/{id}/agendas`) use the same `viewableBy` scope, so
 * every id here resolves to a real artifact rather than a 404.
 * @param offset - items to skip.
 * @param limit - page size (1–100; larger 422s).
 */
async function getOrgEventsPage(offset: number, limit: number) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return httpClientList<CalendarEventListItem>(
    `${API_URL}/calendar-events/viewable?${params.toString()}`,
  );
}

/**
 * Fetches EVERY viewable meeting for the picker via parallel pagination: the
 * first page establishes the total, remaining pages load concurrently
 * (`allSettled` so one failed page does not discard the rest). Loading all pages
 * matters — a manual upload can sit far down the list, and a client-only search
 * over a single page would never surface it. Newest first.
 */
export async function getOrgEventsForPicker(): Promise<
  CalendarEventListItem[]
> {
  const first = await getOrgEventsPage(0, ORG_PICKER_PAGE_SIZE);
  const results: CalendarEventListItem[] = [...first.data];
  const { totalCount } = first;

  if (results.length >= totalCount) {
    return results;
  }

  const offsets: number[] = [];

  for (
    let offset = ORG_PICKER_PAGE_SIZE;
    offset < totalCount;
    offset += ORG_PICKER_PAGE_SIZE
  ) {
    offsets.push(offset);
  }

  const pages = await Promise.allSettled(
    offsets.map((offset) => {
      return getOrgEventsPage(offset, ORG_PICKER_PAGE_SIZE);
    }),
  );

  for (const page of pages) {
    if (page.status === 'fulfilled') {
      results.push(...page.value.data);
    }
  }

  return results;
}
