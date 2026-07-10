'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.MEETINGS_CALENDAR, label: 'Calendar' },
  { href: ROUTES.DASHBOARD.MEETINGS_LIST, label: 'List' },
  { href: ROUTES.DASHBOARD.MEETINGS_ORGANIZATION, label: 'Organization' },
] as const;

/**
 * MeetingsTabsNav — route-based tab strip for the Meetings section: the personal
 * calendar, the personal list, and the organization calendar. Active tab is
 * derived from the current pathname.
 */
export function MeetingsTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
