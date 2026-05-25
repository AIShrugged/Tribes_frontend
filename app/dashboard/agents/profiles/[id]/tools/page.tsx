import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AgentProfileToolsList, AccessDeniedState } from '@/features/agents';
import { getAgentProfileTools } from '@/features/agents/api/agent-profiles';
import { ServerError } from '@/shared/lib/errors';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

type ToolsResult =
  | { kind: 'ok'; tools: Awaited<ReturnType<typeof getAgentProfileTools>> }
  | { kind: 'access_denied' }
  | { kind: 'empty' };

async function fetchTools(profileId: number): Promise<ToolsResult> {
  try {
    const tools = await getAgentProfileTools(profileId);

    return { kind: 'ok', tools };
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        // eslint-disable-next-line no-console
        console.error('[agents] 403 on profile tools', { profileId, url: error.url });

        return { kind: 'access_denied' };
      }

      if (error.status === 404) {
        return { kind: 'empty' };
      }
    }

    throw error;
  }
}

async function ToolsContent({ profileId }: { profileId: number }) {
  const result = await fetchTools(profileId);

  if (result.kind === 'access_denied') {
    return (
      <AccessDeniedState description='You do not have permission to view tools for this agent.' />
    );
  }

  const tools = result.kind === 'ok' ? result.tools : [];

  return <AgentProfileToolsList tools={tools} />;
}

export default async function AgentProfileToolsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  return (
    <Suspense fallback={<SkeletonList rows={5} />}>
      <ToolsContent profileId={profileId} />
    </Suspense>
  );
}
