import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getTeams } from '@/entities/team/api/team';
import {
  getSources,
  CalendarAttachedToast,
  OnboardingTrigger,
} from '@/features/calendar';
import {
  getCalendarEventsForMonth,
  MeetingsCalendarFiltersBar,
  parseCalendarFilters,
} from '@/features/meetings';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import SpinLoader from '@/shared/ui/layout/spin-loader';
import { CalendarPage } from '@/widgets/calendar-view';

/**
 * Meetings personal calendar tab.
 * Fetches all events for the selected month via parallel per-day requests.
 * Supports team_id and user_id filter params.
 */
export default async function MeetingsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    attached?: string;
    team_id?: string;
    user_id?: string;
  }>;
}) {
  const params = await searchParams;
  const justAttached = params.attached === '1';

  const [sources, orgId] = await Promise.all([
    getSources(),
    getOrganizationId(),
  ]);
  const isCalendarAttached = sources.some((s) => {
    return s.is_connected === '1' || s.is_connected === true;
  });

  if (!isCalendarAttached) {
    return <OnboardingTrigger organizationId={+orgId} />;
  }

  if (!params.month) {
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const redirectParams = new URLSearchParams({ month: currentMonth });
    if (params.team_id) redirectParams.set('team_id', params.team_id);
    if (params.user_id) redirectParams.set('user_id', params.user_id);
    if (justAttached) redirectParams.set('attached', '1');

    redirect(`/dashboard/meetings/calendar?${redirectParams.toString()}`);
  }

  const month = params.month;
  const calendarFilters = parseCalendarFilters(params);

  const [events, teamsResult] = await Promise.all([
    getCalendarEventsForMonth(month, calendarFilters),
    getTeams(orgId),
  ]);

  const initialTeams = teamsResult.data ?? [];

  return (
    <div className='h-full flex flex-col overflow-hidden'>
      {justAttached && <CalendarAttachedToast />}
      <Suspense
        fallback={<div className='h-[57px] border-b border-border bg-card' />}
      >
        <MeetingsCalendarFiltersBar
          filters={calendarFilters}
          cookieOrgId={orgId}
          initialTeams={initialTeams}
        />
      </Suspense>
      <Suspense
        fallback={
          <div className='flex flex-1 items-center justify-center'>
            <SpinLoader />
          </div>
        }
      >
        <CalendarPage currentMonth={month} events={events} />
      </Suspense>
    </div>
  );
}
