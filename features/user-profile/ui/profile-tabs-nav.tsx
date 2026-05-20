'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const BASE_TABS = [
  { href: ROUTES.DASHBOARD.PROFILE_ACCOUNT, label: 'Account' },
  { href: ROUTES.DASHBOARD.PROFILE_CALENDAR, label: 'Calendar' },
  { href: ROUTES.DASHBOARD.PROFILE_PREFERENCES, label: 'Preferences' },
  { href: ROUTES.DASHBOARD.PROFILE_INTEGRATIONS, label: 'Integrations' },
  { href: ROUTES.DASHBOARD.PROFILE_TELEGRAM, label: 'Telegram' },
] as const;

const ONBOARDING_TAB = {
  href: ROUTES.DASHBOARD.PROFILE_ONBOARDING,
  label: 'Onboarding',
} as const;

interface ProfileTabsNavProps {
  showOnboarding?: boolean;
}

export function ProfileTabsNav({ showOnboarding }: ProfileTabsNavProps) {
  const tabs = showOnboarding ? [...BASE_TABS, ONBOARDING_TAB] : BASE_TABS;
  return <PageTabsNav tabs={tabs} />;
}
