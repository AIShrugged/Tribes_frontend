import { notFound } from 'next/navigation';

import {
  getAgentProfile,
  getAgentAccessContext,
  formatDateTime,
  normalizeAllowedTools,
  AccessDeniedState,
  AgentProfileActions,
} from '@/features/agents';
import { ServerError } from '@/shared/lib/errors';
import { ROUTES } from '@/shared/lib/routes';
import { Badge } from '@/shared/ui/badge';
import { Card, CardBody } from '@/shared/ui/card';
import { PageTabsNav } from '@/shared/ui/navigation/page-tabs-nav';
import PageHeader from '@/widgets/layout/ui/page-header';

import type { PropsWithChildren } from 'react';

export default async function AgentProfileDetailLayout({
  children,
  params,
}: PropsWithChildren<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  const { canManageAgents } = await getAgentAccessContext();

  if (!canManageAgents) {
    return (
      <Card className='h-full flex flex-col'>
        <PageHeader hasButtonBack title='Agent Profile' />
        <CardBody>
          <AccessDeniedState />
        </CardBody>
      </Card>
    );
  }

  let accessDenied = false;
  let profile = null as Awaited<ReturnType<typeof getAgentProfile>> | null;

  try {
    profile = await getAgentProfile(profileId);
  } catch (error) {
    if (error instanceof ServerError && error.status === 403) {
      accessDenied = true;
    } else {
      throw error;
    }
  }

  if (accessDenied) {
    return (
      <Card className='h-full flex flex-col'>
        <PageHeader hasButtonBack title='Agent Profile' />
        <CardBody>
          <AccessDeniedState description='The backend denied access to this agent profile.' />
        </CardBody>
      </Card>
    );
  }

  if (!profile) notFound();

  const TABS = [
    { href: ROUTES.DASHBOARD.AGENT_PROFILE_OVERVIEW(profile.id), label: 'Overview' },
    { href: ROUTES.DASHBOARD.AGENT_PROFILE_TOOLS(profile.id), label: 'Tools' },
    { href: ROUTES.DASHBOARD.AGENT_PROFILE_MEMORIES(profile.id), label: 'Memories' },
  ] as const;

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title={profile.name} />
      <div className='h-full overflow-y-auto'>
        <CardBody>
          <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div className='flex flex-col gap-2 min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={profile.enabled ? 'success' : 'warning'}>
                  {profile.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {profile.execution_mode ? (
                  <Badge>{profile.execution_mode}</Badge>
                ) : null}
                <code className='font-mono text-xs text-muted-foreground'>
                  {profile.key}
                </code>
              </div>
              <div className='flex flex-wrap gap-2'>
                {normalizeAllowedTools(profile.allowed_tools).map((tool) => {
                  return <Badge key={tool}>{tool}</Badge>;
                })}
              </div>
              <p className='text-sm text-muted-foreground'>
                Created {formatDateTime(profile.created_at)} · Updated{' '}
                {formatDateTime(profile.updated_at)}
              </p>
            </div>
            <div className='shrink-0'>
              <AgentProfileActions
                id={profile.id}
                backHref={ROUTES.DASHBOARD.AGENT_PROFILES}
              />
            </div>
          </div>

          <div className='mb-6'>
            <PageTabsNav tabs={TABS} variant='segmented' />
          </div>

          {children}
        </CardBody>
      </div>
    </Card>
  );
}
