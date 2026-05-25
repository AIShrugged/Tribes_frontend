'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.PROFILE_ACCOUNT, label: 'Account' },
  { href: ROUTES.DASHBOARD.PROFILE_CALENDAR, label: 'Calendar' },
  { href: ROUTES.DASHBOARD.PROFILE_PREFERENCES, label: 'Preferences' },
  { href: ROUTES.DASHBOARD.PROFILE_INTEGRATIONS, label: 'Integrations' },
  { href: ROUTES.DASHBOARD.PROFILE_TELEGRAM, label: 'Telegram' },
] as const;

export function ProfileTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
