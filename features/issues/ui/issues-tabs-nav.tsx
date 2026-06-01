'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.ISSUES_KANBAN, label: 'Kanban' },
  { href: ROUTES.DASHBOARD.ISSUES_LIST, label: 'Tasktracker' },
] as const;

/**
 * IssuesTabsNav — route-based tab strip for the issues section.
 * Carries current URL filter params when switching tabs.
 */
export function IssuesTabsNav() {
  return <PageTabsNav tabs={TABS} preserveSearchParams />;
}
