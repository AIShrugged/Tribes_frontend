import { redirect } from 'next/navigation';

import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Legacy goals route — goals now live on the organization page. Redirect any
 * existing links/bookmarks to the active organization's Goals tab.
 */
export default async function GoalsPage() {
  const orgId = await getOrganizationId();

  redirect(ROUTES.DASHBOARD.ORGANIZATION_GOALS(orgId));
}
