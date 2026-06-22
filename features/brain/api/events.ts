'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClientList } from '@/shared/lib/httpClient';

import type { BrainEvent } from '@/features/brain/model/types';
import type { PaginatedResult } from '@/shared/types/common';

const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 500;

interface GetEventsParams {
  runUuid?: string;
  type?: string;
  organizationId?: number;
  page?: number;
  perPage?: number;
}

/**
 * Lists reasoning-log events (read-only). Spans every managed org unless
 * `organizationId` is given. Total count comes from the `Items-Count` header.
 * @param params - run/type/org filters and pagination.
 */
export async function getBrainEvents(
  params: GetEventsParams = {},
): Promise<PaginatedResult<BrainEvent>> {
  const page = Math.max(params.page ?? 1, 1);
  const perPage = Math.min(
    Math.max(params.perPage ?? DEFAULT_PER_PAGE, 1),
    MAX_PER_PAGE,
  );

  const search = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  if (params.runUuid) search.set('run_uuid', params.runUuid);
  if (params.type) search.set('type', params.type);
  if (params.organizationId) {
    search.set('organization_id', String(params.organizationId));
  }

  const { data, totalCount } = await httpClientList<BrainEvent>(
    `${API_URL}/brain/events?${search}`,
  );

  return {
    data,
    totalCount,
    hasMore: page * perPage < totalCount,
  };
}
