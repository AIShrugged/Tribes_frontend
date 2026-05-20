'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { AgentActivityItem } from '@/features/agents/model/types';
import type { PaginatedResult } from '@/shared/types/common';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function getAgentActivity(
  offset = 0,
  limit = DEFAULT_LIMIT,
  agentRunUuid?: string,
): Promise<PaginatedResult<AgentActivityItem>> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const safeOffset = Math.max(offset, 0);
  const params = new URLSearchParams({
    offset: String(safeOffset),
    limit: String(safeLimit),
  });

  if (agentRunUuid) {
    params.set('agent_run_uuid', agentRunUuid);
  }

  const { data, totalCount } = await httpClientList<AgentActivityItem>(
    `${API_URL}/agent-activity?${params}`,
  );

  return {
    data,
    totalCount,
    hasMore: safeOffset + data.length < totalCount,
  };
}
