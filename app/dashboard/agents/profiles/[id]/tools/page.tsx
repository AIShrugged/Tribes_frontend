import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AgentProfileToolsList } from '@/features/agents';
import { getAgentProfileTools } from '@/features/agents/api/agent-profiles';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

async function ToolsContent({ profileId }: { profileId: number }) {
  const tools = await getAgentProfileTools(profileId);

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
