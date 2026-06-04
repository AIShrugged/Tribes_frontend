import { redirect } from 'next/navigation';

import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';

/**
 * Organization index — opens the active organization's People tab.
 */
export default async function OrganizationPage() {
  const organizationId = await getOrganizationId();

  redirect(ROUTES.DASHBOARD.ORGANIZATION_PEOPLE(organizationId));
}
