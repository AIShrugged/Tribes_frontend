'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.TEMP_SETTINGS, label: 'Управление' },
  { href: ROUTES.DASHBOARD.TEMP_SUGGESTIONS, label: 'Предложения' },
  { href: ROUTES.DASHBOARD.TEMP_REASONING, label: 'Журнал размышлений' },
] as const;

/**
 * BrainTabsNav — route-based tab strip for the Temp (second brain) section.
 */
export function BrainTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
