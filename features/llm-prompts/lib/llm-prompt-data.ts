import { cache } from 'react';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type { LlmPromptGroup, LlmPromptProps } from '@/features/llm-prompts/model/types';
import type { PaginatedResult } from '@/shared/types/common';

/**
 * getLlmPrompts — fetches a paginated list of prompts for Server Components.
 * Not a Server Action — called directly from page.tsx RSC data layer.
 * @param organizationId - The active organization's ID.
 * @param params - Query parameters for filtering.
 * @param params.search - Optional search term.
 * @param params.group - Optional group filter.
 * @param params.offset - Pagination offset.
 * @param params.limit - Number of items per page.
 * @returns Promise resolving to a PaginatedResult of LlmPromptProps.
 */
export async function getLlmPrompts(
  organizationId: number,
  params: {
    search?: string;
    group?: LlmPromptGroup;
    offset?: number;
    limit?: number;
  } = {},
): Promise<PaginatedResult<LlmPromptProps>> {
  const query = new URLSearchParams();

  if (params.search) query.set('search', params.search);
  if (params.group !== undefined) query.set('group', params.group);
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const qs = query.toString();
  const url =
    qs.length > 0
      ? `${API_URL}/organizations/${organizationId}/llm-prompts?${qs}`
      : `${API_URL}/organizations/${organizationId}/llm-prompts`;

  return httpClientList<LlmPromptProps>(url);
}

/**
 * getLlmPromptData — cache-wrapped fetch for a single prompt.
 * Deduplicates within a Server Component render tree.
 * Returns null on 404.
 * @param organizationId - The active organization's ID.
 * @param promptId - The prompt's ID.
 * @returns Promise resolving to LlmPromptProps or null if not found.
 */
export const getLlmPromptData = cache(async (
  organizationId: number,
  promptId: number,
): Promise<LlmPromptProps | null> => {
  try {
    const { data } = await httpClient<LlmPromptProps>(
      `${API_URL}/organizations/${organizationId}/llm-prompts/${promptId}`,
    );

    return data;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) return null;

    throw error;
  }
});
