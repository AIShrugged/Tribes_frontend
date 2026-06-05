import { getOrganization, OrganizationTabsNav } from '@/features/organization';
import { Card, CardBody } from '@/shared/ui/card';
import PageHeader from '@/widgets/layout/ui/page-header';

import type { PropsWithChildren } from 'react';

/**
 * Organization detail layout — owns the card shell and route-based tab strip
 * (People / Goals / Description) shared by every organization sub-page.
 *
 * Fetches the organization here to enforce membership for EVERY tab: the Goals
 * tab scopes data via the issues endpoint (which silently filters rather than
 * 403s), so without this the org shell would render for non-members. getOrganization
 * throws 403/404 for non-members / missing orgs and is React.cache-wrapped, so the
 * sub-pages that also call it (People / Settings / Description) reuse this fetch.
 * @param props - Component props.
 * @param props.children - Active tab content.
 * @param props.params - Route params holding the organization id.
 */
export default async function OrganizationLayout({
  children,
  params,
}: PropsWithChildren<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { data: organization } = await getOrganization(id);

  if (!organization) return null;

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title='Organization' />
      <div className='px-6'>
        <OrganizationTabsNav organizationId={organization.id} />
      </div>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
