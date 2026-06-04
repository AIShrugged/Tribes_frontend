'use client';

import { ROUTES } from '@/shared/lib/routes';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';

/**
 * OrganizationTabsNav — route-based tabs for organization sections.
 * @param props - Component props.
 * @param props.organizationId
 */
export function OrganizationTabsNav({
  organizationId,
}: {
  organizationId: string | number;
}) {
  const tabs = [
    {
      href: ROUTES.DASHBOARD.ORGANIZATION_PEOPLE(organizationId),
      label: 'People',
      match: 'exact',
    },
  ] as const;

  return <PageTabsNav tabs={tabs} variant='underline' />;
}
