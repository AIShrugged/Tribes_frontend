'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.TELEGRAM_CHATS, label: 'Telegram chats' },
  { href: ROUTES.DASHBOARD.TELEGRAM_NOTIFICATIONS, label: 'Notifications' },
] as const;

/**
 * TelegramTabsNav — route-based tab strip for the Telegram section.
 * Active tab is derived from the current pathname.
 */
export function TelegramTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
