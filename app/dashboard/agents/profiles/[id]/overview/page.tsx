import { notFound } from 'next/navigation';

import {
  getAgentProfile,
  getAgentTasksMeta,
  getAgentTools,
  normalizeMetaOptions,
  normalizeToolOptions,
  AgentJsonPreview,
  AgentProfileForm,
} from '@/features/agents';
import { ServerError } from '@/shared/lib/errors';

import type { AgentTasksMeta } from '@/features/agents';

export default async function AgentProfileOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  // getAgentProfile is cache()-wrapped — layout already fetched it, no extra HTTP call
  let profile: Awaited<ReturnType<typeof getAgentProfile>> | null = null;
  let meta: AgentTasksMeta = {};
  let tools: Awaited<ReturnType<typeof getAgentTools>> = [];

  try {
    const results = await Promise.all([
      getAgentProfile(profileId),
      getAgentTasksMeta().catch((): AgentTasksMeta => {return {}}),
      getAgentTools().catch(() => {return []}),
    ]);
    profile = results[0];
    meta = results[1];
    tools = results[2];
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (!profile) notFound();

  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
      <div className='rounded-[var(--radius-card)] border border-border p-4'>
        <AgentProfileForm
          profile={profile}
          sandboxOptions={normalizeMetaOptions(meta.sandbox_profiles)}
          toolOptions={normalizeToolOptions(tools)}
        />
      </div>
      <div>
        <AgentJsonPreview title='Raw Profile JSON' value={profile} />
      </div>
    </div>
  );
}
