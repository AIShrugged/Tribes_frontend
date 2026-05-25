import {
  getAgentTasksMeta,
  getAgentTools,
  getAgentAccessContext,
  normalizeMetaOptions,
  normalizeToolOptions,
  AccessDeniedState,
  AgentProfileForm,
} from '@/features/agents';
import { ServerError } from '@/shared/lib/errors';
import { Card, CardBody } from '@/shared/ui/card';
import PageHeader from '@/widgets/layout/ui/page-header';

import type { AgentTasksMeta } from '@/features/agents';

export default async function NewAgentProfilePage() {
  const { canManageAgents } = await getAgentAccessContext();

  if (!canManageAgents) {
    return (
      <Card className='h-full flex flex-col'>
        <PageHeader hasButtonBack title='New Agent' />
        <CardBody>
          <AccessDeniedState />
        </CardBody>
      </Card>
    );
  }

  let accessDenied = false;
  let meta = {} as AgentTasksMeta;
  let tools: Awaited<ReturnType<typeof getAgentTools>> = [];

  try {
    [meta, tools] = await Promise.all([
      getAgentTasksMeta().catch((): AgentTasksMeta => {return {}}),
      getAgentTools().catch(() => {return []}),
    ]);
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
        <PageHeader hasButtonBack title='New Agent' />
        <CardBody>
          <AccessDeniedState description='The backend denied access while loading profile creation metadata.' />
        </CardBody>
      </Card>
    );
  }

  const toolOptions = normalizeToolOptions(tools);

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title='New Agent' />
      <div className='h-full overflow-y-auto'>
        <CardBody>
          {toolOptions.length === 0 ? (
            <div className='mb-4 rounded-[var(--radius-card)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning'>
              The backend returned no available tools. You can still create a
              profile, but the allowed tools selector will be empty.
            </div>
          ) : null}
          <AgentProfileForm
            sandboxOptions={normalizeMetaOptions(meta.sandbox_profiles)}
            toolOptions={toolOptions}
          />
        </CardBody>
      </div>
    </Card>
  );
}
