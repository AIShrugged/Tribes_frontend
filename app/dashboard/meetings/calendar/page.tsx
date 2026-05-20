import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import {
  getSources,
  CalendarAttachedToast,
  OnboardingTrigger,
} from '@/features/calendar';
import { getCalendarEventsForMonth } from '@/features/meetings';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import SpinLoader from '@/shared/ui/layout/spin-loader';
import { CalendarPage } from '@/widgets/calendar-view';

import type { EventProps } from '@/entities/event';

/**
 * Meetings personal calendar tab.
 * Fetches all events for the selected month via parallel per-day requests.
 */
export default async function MeetingsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; attached?: string }>;
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
    const suffix = justAttached ? '&attached=1' : '';

    redirect(`/dashboard/meetings/calendar?month=${currentMonth}${suffix}`);
  }

  const month = params.month ?? new Date().toISOString().slice(0, 7) + '-01';
  const events = await getCalendarEventsForMonth(month);

  return (
    <div className='h-full flex flex-col overflow-hidden'>
      {justAttached && <CalendarAttachedToast />}
      <Suspense
        fallback={
          <div className='flex flex-1 items-center justify-center'>
            <SpinLoader />
          </div>
        }
      >
        <CalendarPage currentMonth={month} events={events as EventProps[]} />
      </Suspense>
    </div>
  );
}
