'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  Decision,
  DecisionCreateDTO,
  DecisionFilters,
} from '@/features/decisions/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getDecisions(
  teamId: number,
  filters?: DecisionFilters,
  offset = 0,
  limit = 30,
) {
  const params = new URLSearchParams();
  params.set('offset', String(offset));
  params.set('limit', String(limit));

  if (filters?.source_type) {
    params.set('source_type', filters.source_type);
  }

  if (filters?.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  return httpClientList<Decision>(
    `${API_URL}/teams/${teamId}/decisions?${params}`,
  );
}

export async function getOrganizationDecisions(
  organizationId: number,
  filters?: DecisionFilters,
  offset = 0,
  limit = 30,
) {
  const params = new URLSearchParams();
  params.set('offset', String(offset));
  params.set('limit', String(limit));

  if (filters?.source_type) {
    params.set('source_type', filters.source_type);
  }

  if (filters?.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  return httpClientList<Decision>(
    `${API_URL}/organizations/${organizationId}/decisions?${params}`,
  );
}

export async function createDecision(
  teamId: number,
  payload: DecisionCreateDTO,
): Promise<ActionResult<Decision>> {
  try {
    const response = await httpClient<Decision>(
      `${API_URL}/teams/${teamId}/decisions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    revalidatePath(`/dashboard/teams`);
    revalidatePath(`/dashboard/today/decisions`);

    if (!response.data) {
      return { data: null, error: 'Failed to save decision' };
    }

    return { data: response.data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to save decision',
      );

      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}
