import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getProfileMemories, AgentMemoriesList } from '@/features/agents';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

async function MemoriesContent({ profileId }: { profileId: number }) {
  const { data, totalCount } = await getProfileMemories(profileId);

  return <AgentMemoriesList memories={data} totalCount={totalCount} />;
}

export default async function AgentProfileMemoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profileId = Number(id);

  if (!Number.isFinite(profileId) || profileId <= 0) notFound();

  return (
    <Suspense fallback={<SkeletonList rows={5} />}>
      <MemoriesContent profileId={profileId} />
    </Suspense>
  );
}
