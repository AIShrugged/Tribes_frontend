import {
  getOrganization,
  OrganizationDescriptionTab,
} from '@/features/organization';

import type { PageProps } from '@/shared/types/common';

export const metadata = { title: 'Description' };

/**
 * Organization Description tab — shows the description entered during
 * onboarding (persisted as the organization `context`).
 * @param props - Component props.
 * @param props.params - Route params holding the organization id.
 */
export default async function OrganizationDescriptionPage({
  params,
}: PageProps) {
  const { id } = await params;
  const { data: organization } = await getOrganization(id);

  if (!organization) return null;

  return <OrganizationDescriptionTab context={organization.context} />;
}
