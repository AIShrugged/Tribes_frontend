import { Suspense } from 'react';

import {
  getMeetingsForDate,
  getMeetingsList,
  MeetingsColumnView,
} from '@/features/meetings';
import {
  hasActiveFilters,
  parseFilters,
} from '@/features/meetings/model/filters';
import { MeetingsListClient } from '@/features/meetings/ui/meetings-list-client';
import { MeetingsListFiltersBar } from '@/features/meetings/ui/meetings-list-filters-bar';
import { getOrganizations } from '@/features/organization';
import { formatDateLabel, toDateParam } from '@/shared/lib/date-nav';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

/**
 * Meetings list page.
 *
 * Two render modes:
 * - No active filters → existing 3-column view (yesterday/today/tomorrow)
 *   centered on the optional ?date= param.
 * - Active filters (scope or team_id) → flat paginated list fetched via
 *   getMeetingsList. Date param is ignored in this mode.
 */
export default async function MeetingsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const spLike = {
    get(key: string): string | null {
      const v = params[key];
      return typeof v === 'string' ? v : null;
    },
  };
  const filters = parseFilters(spLike);
  const filtersActive = hasActiveFilters(filters);

  const [orgsResponse, cookieOrgId] = await Promise.all([
    getOrganizations(),
    getOrganizationId(),
  ]);
  const organizations = orgsResponse.data ?? [];

  const filtersBar = (
    <div className='flex items-center justify-between gap-3 border-b border-border bg-card pr-3'>
      <Suspense fallback={<div className='h-14 flex-1' />}>
        <MeetingsListFiltersBar
          key={cookieOrgId}
          cookieOrgId={String(cookieOrgId)}
          filters={filters}
          organizations={organizations}
        />
      </Suspense>
    </div>
  );

  if (filtersActive) {
    const initialPage = await getMeetingsList({
      ...filters,
      offset: 0,
      limit: 50,
    });

    return (
      <Card className='h-full flex flex-col overflow-hidden'>
        {filtersBar}
        <div className='flex-1 overflow-y-auto'>
          <MeetingsListClient
            filters={filters}
            initialItems={initialPage.data}
            initialTotalCount={initialPage.totalCount}
            initialHasMore={initialPage.hasMore}
          />
        </div>
      </Card>
    );
  }

  const raw = typeof params.date === 'string' ? params.date : '';
  const isValid =
    /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
    !Number.isNaN(new Date(raw + 'T00:00:00').getTime());

  const centerDate = isValid
    ? new Date(raw + 'T00:00:00')
    : new Date(new Date().toDateString());

  const yesterdayDate = new Date(centerDate);
  yesterdayDate.setDate(centerDate.getDate() - 1);

  const tomorrowDate = new Date(centerDate);
  tomorrowDate.setDate(centerDate.getDate() + 1);

  const [yesterday, today, tomorrow] = await Promise.all([
    getMeetingsForDate(yesterdayDate),
    getMeetingsForDate(centerDate),
    getMeetingsForDate(tomorrowDate),
  ]);

  return (
    <Card className='h-full flex flex-col'>
      {filtersBar}
      <MeetingsColumnView
        yesterday={yesterday}
        today={today}
        tomorrow={tomorrow}
        yesterdayDate={formatDateLabel(yesterdayDate)}
        todayDate={formatDateLabel(centerDate)}
        tomorrowDate={formatDateLabel(tomorrowDate)}
        centerDate={toDateParam(centerDate)}
      />
    </Card>
  );
}
