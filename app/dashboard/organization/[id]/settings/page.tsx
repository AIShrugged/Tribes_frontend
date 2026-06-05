import { getAgentProfiles } from '@/features/agents';
import {
  getOrganization,
  OrganizationDangerZone,
  OrganizationForm,
  OrganizationIssueTypesSettings,
} from '@/features/organization';
import { ServerError } from '@/shared/lib/errors';

import type { AgentProfile } from '@/features/agents';
import type { PageProps } from '@/shared/types/common';

/**
 * Organization settings page.
 * @param props - Component props.
 * @param props.params
 */
export default async function OrganizationSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const { data: organization } = await getOrganization(id);
  let agentProfiles: AgentProfile[] = [];

  try {
    const { data } = await getAgentProfiles();
    agentProfiles = data;
  } catch (error) {
    if (error instanceof ServerError && error.status === 403) {
      agentProfiles = [];
    } else {
      throw error;
    }
  }

  if (!organization) return null;

  return (
    <div className='grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]'>
      <div className='flex flex-col gap-8'>
        <OrganizationForm values={organization} />
        <OrganizationDangerZone org={organization} />
      </div>
      <OrganizationIssueTypesSettings
        organizationId={organization.id}
        issueTypes={organization.issue_types}
        profiles={agentProfiles}
      />
    </div>
  );
}
