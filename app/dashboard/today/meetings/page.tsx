import { getTodayBriefing } from '@/features/today-briefing';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { Card } from '@/shared/ui/card';

import { MeetingsContent } from './meetings-content';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Meetings' };

/**
 * Server component — reads searchParams on every navigation so the date
 * param is always fresh, then passes fetched data down to the client view.
 */
export default async function TodayMeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const { date } = (await searchParams) ?? {};
  const [data, orgId] = await Promise.all([
    getTodayBriefing(date),
    getOrganizationId(),
  ]);

  return (
    <Card className='h-full flex flex-col'>
      <MeetingsContent key={data.date} data={data} organizationId={orgId} />
    </Card>
  );
}
