import { endOfMonth, format, startOfMonth } from 'date-fns';
import { redirect } from 'next/navigation';

import { getSources, OnboardingTrigger } from '@/features/calendar';
import { getAllOrgCalendarEvents, OrgCalendarView } from '@/features/meetings';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';

const MONTH_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function OrganizationCalendarPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const [sources, orgId] = await Promise.all([
    getSources(),
    getOrganizationId(),
  ]);
  const isCalendarAttached = sources.some(
    (s) => {return s.is_connected === '1' || s.is_connected === true},
  );

  if (!isCalendarAttached) {
    return <OnboardingTrigger organizationId={+orgId} />;
  }

  if (!params.month || !MONTH_RE.test(params.month)) {
    const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-01');
    redirect(`${ROUTES.DASHBOARD.MEETINGS_ORGANIZATION}?month=${currentMonth}`);
  }

  const currentMonth = params.month;
  const monthStart = startOfMonth(new Date(currentMonth));
  const dateFrom = format(monthStart, 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(monthStart), 'yyyy-MM-dd');

  const allMeetings = await getAllOrgCalendarEvents(dateFrom, dateTo);

  return (
    <div className='h-full flex flex-col overflow-hidden'>
      <OrgCalendarView events={allMeetings} currentMonth={currentMonth} />
    </div>
  );
}
