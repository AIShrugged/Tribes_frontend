import { Bot } from 'lucide-react';

import {
  getAgentProfiles,
  getAgentTasksMeta,
  getAgentTools,
  getAgentAccessContext,
  normalizeMetaOptions,
  normalizeToolOptions,
  AccessDeniedState,
  AgentProfilesList,
} from '@/features/agents';
import { ServerError } from '@/shared/lib/errors';
import { ROUTES } from '@/shared/lib/routes';
import { ButtonLink } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import type { AgentTasksMeta } from '@/features/agents';

export const metadata = { title: 'Agent Profiles' };

/**
 * Agent Profiles tab page.
 */
export default async function AgentProfilesPage() {
  const { canManageAgents } = await getAgentAccessContext();

  if (!canManageAgents) {
    return (
      <AccessDeniedState description='The backend denied access to agent profiles for the current organization context.' />
    );
  }

  let accessDenied = false;
  let profilesData: Awaited<ReturnType<typeof getAgentProfiles>> = {
    data: [],
    totalCount: 0,
  };
  let meta = {} as AgentTasksMeta;
  let tools: Awaited<ReturnType<typeof getAgentTools>> = [];

  await Promise.all([
    getAgentProfiles(),
    getAgentTasksMeta().catch(() => {
      return {} as AgentTasksMeta;
    }),
    getAgentTools().catch(() => {
      return [];
    }),
  ])
    .then(([pr, m, t]) => {
      profilesData = pr;
      meta = m as AgentTasksMeta;
      tools = t;
    })
    .catch((error) => {
      if (error instanceof ServerError && error.status === 403) {
        accessDenied = true;
      } else {
        throw error;
      }
    });

  if (accessDenied) {
    return (
      <AccessDeniedState description='The backend denied access to agent profiles for the current organization context.' />
    );
  }

  const toolOptions = normalizeToolOptions(tools);
  const sandboxOptions = normalizeMetaOptions(meta.sandbox_profiles);

  return (
    <Card>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          Configure reusable agent profiles and backend-constrained tool access.
        </p>
        <ButtonLink href={ROUTES.DASHBOARD.AGENT_PROFILES_NEW}>
          New profile
        </ButtonLink>
      </div>
      <div className='mb-6 grid gap-4 md:grid-cols-2'>
        <div className='rounded-[var(--radius-card)] border border-border p-4'>
          <p className='text-xs uppercase tracking-wide text-muted-foreground'>
            Sandbox profiles from meta
          </p>
          <p className='mt-2 text-sm text-foreground'>
            {sandboxOptions.length > 0
              ? sandboxOptions
                  .map((option) => {
                    return option.label;
                  })
                  .join(', ')
              : 'Not exposed by the backend meta endpoint'}
          </p>
        </div>
        <div className='rounded-[var(--radius-card)] border border-border p-4'>
          <p className='text-xs uppercase tracking-wide text-muted-foreground'>
            Tool catalog
          </p>
          <p className='mt-2 text-sm text-foreground'>
            {toolOptions.length > 0
              ? `${toolOptions.length} tools available from /api/v1/agent-tools`
              : 'Tool metadata endpoint returned no tools'}
          </p>
        </div>
      </div>
      {profilesData.data.length > 0 ? (
        <AgentProfilesList profiles={profilesData.data} />
      ) : (
        <EmptyState
          icon={Bot}
          title='No agent profiles yet'
          description='Create the first profile for reusable agent configuration.'
        />
      )}
    </Card>
  );
}
