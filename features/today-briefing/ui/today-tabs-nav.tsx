'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  {
    href: ROUTES.DASHBOARD.TODAY_MEETINGS,
    label: 'Meetings',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_PROGRESS,
    label: 'Tasks',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_ACTIVITY,
    label: 'Critical Path',
    match: 'exact' as const,
  },
  {
    href: ROUTES.DASHBOARD.TODAY_GOALS,
    label: 'Goals',
    match: 'exact' as const,
  },
] as const;

/**
 * TodayTabsNav — route-based tab strip for the today dashboard section.
 * Active tab is derived from the current pathname. Preserves date query param.
 */
export function TodayTabsNav() {
  return <PageTabsNav tabs={TABS} preserveSearchParams />;
}
