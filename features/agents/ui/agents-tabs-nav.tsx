'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.AGENT_TASKS, label: 'Tasks' },
  { href: ROUTES.DASHBOARD.AGENT_PROFILES, label: 'Agents' },
  { href: ROUTES.DASHBOARD.AGENT_ACTIVITY, label: 'Activity' },
] as const;

/**
 * AgentsTabsNav — route-based tab strip for the agents section.
 * Active tab is derived from the current pathname.
 */
export function AgentsTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
