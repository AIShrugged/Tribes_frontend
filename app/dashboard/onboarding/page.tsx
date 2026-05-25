import { redirect } from 'next/navigation';

import { OnboardingWizard, getLatestDraft } from '@/features/onboarding';
import { getOrganization } from '@/features/organization/api/organization';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';
import { Card, CardBody } from '@/shared/ui/card';

export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage() {
  const orgId = await getOrganizationId();
  const [{ data: org }, initialDraft] = await Promise.all([
    getOrganization(orgId),
    getLatestDraft(orgId),
  ]);

  if (!org || org.onboarded_at) {
    redirect(ROUTES.DASHBOARD.TODAY);
  }

  return (
    <Card>
      <CardBody>
        <OnboardingWizard
          orgId={org.id}
          orgName={org.name}
          initialDraft={initialDraft}
          redirectAfterSkip={ROUTES.DASHBOARD.TODAY}
          redirectAfterAccept={ROUTES.DASHBOARD.TODAY}
        />
      </CardBody>
    </Card>
  );
}
