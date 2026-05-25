import { Bot } from 'lucide-react';

import {
  getAgentProfiles,
  getAgentAccessContext,
  AccessDeniedState,
  AgentProfilesList,
} from '@/features/agents';
import { ROUTES } from '@/shared/lib/routes';
import { ButtonLink } from '@/shared/ui/button';
import { Card, CardBody } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

export const metadata = { title: 'Agents' };

export default async function AgentProfilesPage() {
  const { canManageAgents } = await getAgentAccessContext();

  if (!canManageAgents) {
    return (
      <AccessDeniedState description='The backend denied access to agent profiles for the current organization context.' />
    );
  }

  const profilesData = await getAgentProfiles();

  return (
    <Card>
      <CardBody>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>
            Configure reusable agent profiles and backend-constrained tool
            access.
          </p>
          <ButtonLink href={ROUTES.DASHBOARD.AGENT_PROFILES_NEW}>
            New Agent
          </ButtonLink>
        </div>
      </CardBody>
      {profilesData.data.length > 0 ? (
        <AgentProfilesList profiles={profilesData.data} />
      ) : (
        <EmptyState
          icon={Bot}
          title='No agents yet'
          description='Create the first agent configuration.'
        />
      )}
    </Card>
  );
}
