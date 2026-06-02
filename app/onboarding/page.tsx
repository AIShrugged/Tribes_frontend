import { redirect } from 'next/navigation';

import {
  OnboardingWizard,
  getLatestDraft,
  getOnboardingStatusText,
} from '@/features/onboarding';
import { getOrganization } from '@/features/organization/api/organization';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { ROUTES } from '@/shared/lib/routes';

export default async function OnboardingPage() {
  const orgId = await getOrganizationId();

  const [{ data: org }, initialDraft] = await Promise.all([
    getOrganization(String(orgId)),
    getLatestDraft(orgId),
  ]);

  if (!org) {
    redirect(ROUTES.AUTH.ORGANIZATION);
  }

  const draftToRestore =
    org.onboarded_at && initialDraft?.status === 'completed'
      ? null
      : initialDraft;

  return (
    <OnboardingWizard
      orgId={org.id}
      orgName={org.name}
      initialDraft={draftToRestore}
      statusText={getOnboardingStatusText(org.onboarded_at)}
    />
  );
}
