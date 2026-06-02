'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

const TABS = [
  { href: ROUTES.DASHBOARD.UPLOADS_TRANSCRIPTS, label: 'Transcript' },
  { href: ROUTES.DASHBOARD.UPLOADS_TASKS, label: 'Task data' },
  { href: ROUTES.DASHBOARD.UPLOADS_LOG, label: 'Log' },
] as const;

/**
 * UploadsTabsNav — route-based tab strip for the Uploads section.
 * Active tab is derived from the current pathname.
 */
export function UploadsTabsNav() {
  return <PageTabsNav tabs={TABS} />;
}
