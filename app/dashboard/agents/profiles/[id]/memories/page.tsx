import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AgentMemoriesList, AccessDeniedState } from '@/features/agents';
import { getProfileMemories } from '@/features/agents/api/agent-profiles';
import { ServerError } from '@/shared/lib/errors';
import { SkeletonList } from '@/shared/ui/layout/skeleton';

import type { AgentMemory } from '@/features/agents/model/types';
import type { PaginatedResult } from '@/shared/types/common';

type MemoriesResult =
  | { kind: 'ok'; data: PaginatedResult<AgentMemory> }
  | { kind: 'access_denied' }
  | { kind: 'empty' };

async function fetchMemories(profileId: number): Promise<MemoriesResult> {
  try {
    const data = await getProfileMemories(profileId);

    return { kind: 'ok', data };
  } catch (error) {
    if (error instanceof ServerError) {
      if (error.status === 403) {
        // eslint-disable-next-line no-console
        console.error('[agents] 403 on profile memories', {
          profileId,
          url: error.url,
        });

        return { kind: 'access_denied' };
      }

      if (error.status === 404) {
        return { kind: 'empty' };
      }
    }

    throw error;
  }
}

async function MemoriesContent({ profileId }: { profileId: number }) {
  const result = await fetchMemories(profileId);

  if (result.kind === 'access_denied') {
    return (
      <AccessDeniedState description='You do not have permission to view memories for this agent.' />
    );
  }

  const memories = result.kind === 'ok' ? result.data.data : [];
  const totalCount = result.kind === 'ok' ? result.data.totalCount : 0;

  return <AgentMemoriesList memories={memories} totalCount={totalCount} />;
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
