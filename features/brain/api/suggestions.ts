'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type {
  BrainApproveOutcome,
  BrainRejectOutcome,
  BrainSuggestion,
  SuggestionStatusFilter,
} from '@/features/brain/model/types';
import type { PaginatedResult } from '@/shared/types/common';

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

interface GetSuggestionsParams {
  status?: SuggestionStatusFilter;
  key?: string;
  organizationId?: number;
  page?: number;
  perPage?: number;
}

/**
 * Lists brain suggestions. Spans every managed org unless `organizationId` is
 * given. Total count comes from the `Items-Count` header (page-based paging).
 * @param params - status/key/org filters and pagination.
 */
export async function getBrainSuggestions(
  params: GetSuggestionsParams = {},
): Promise<PaginatedResult<BrainSuggestion>> {
  const page = Math.max(params.page ?? 1, 1);
  const perPage = Math.min(
    Math.max(params.perPage ?? DEFAULT_PER_PAGE, 1),
    MAX_PER_PAGE,
  );

  const search = new URLSearchParams({
    status: params.status ?? 'pending',
    page: String(page),
    per_page: String(perPage),
  });

  if (params.key) search.set('key', params.key);
  if (params.organizationId) {
    search.set('organization_id', String(params.organizationId));
  }

  const { data, totalCount } = await httpClientList<BrainSuggestion>(
    `${API_URL}/brain/suggestions?${search}`,
  );

  return {
    data,
    totalCount,
    hasMore: page * perPage < totalCount,
  };
}

/** Pulls the suggestion from an error envelope body (422/409 return it in `data`). */
function suggestionFromErrorBody(body: string): BrainSuggestion | null {
  try {
    const json = JSON.parse(body) as { data?: BrainSuggestion | null };

    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Approves a suggestion. The backend applies the action deterministically and
 * returns the resolved suggestion. Maps each HTTP status to a distinct outcome:
 * 200 applied · 422 failed (with reason) · 409 conflict · 403 forbidden.
 * @param id - suggestion id.
 */
export async function approveBrainSuggestion(
  id: number,
): Promise<BrainApproveOutcome> {
  try {
    const { data } = await httpClient<BrainSuggestion>(
      `${API_URL}/brain/suggestions/${id}/approve`,
      { method: 'POST' },
    );

    revalidatePath(ROUTES.DASHBOARD.TEMP_SUGGESTIONS);
    revalidatePath(ROUTES.DASHBOARD.ISSUES);

    return { kind: 'applied', suggestion: data };
  } catch (error) {
    if (error instanceof ServerError) {
      const body = error.responseBody ?? '';
      const suggestion = suggestionFromErrorBody(body);
      const { message } = parseApiError(
        body,
        'Не удалось применить предложение',
      );

      if (error.status === 422 && suggestion) {
        return { kind: 'failed', suggestion };
      }

      if (error.status === 409) {
        return { kind: 'conflict', suggestion, message };
      }

      if (error.status === 403) {
        return { kind: 'forbidden', message };
      }

      return { kind: 'error', message };
    }

    throw error;
  }
}

/**
 * Rejects a suggestion (the brain will not re-create a rejected proposal).
 * @param id - suggestion id.
 */
export async function rejectBrainSuggestion(
  id: number,
): Promise<BrainRejectOutcome> {
  try {
    const { data } = await httpClient<BrainSuggestion>(
      `${API_URL}/brain/suggestions/${id}/reject`,
      { method: 'POST' },
    );

    revalidatePath(ROUTES.DASHBOARD.TEMP_SUGGESTIONS);

    return { kind: 'rejected', suggestion: data };
  } catch (error) {
    if (error instanceof ServerError) {
      const body = error.responseBody ?? '';
      const suggestion = suggestionFromErrorBody(body);
      const { message } = parseApiError(
        body,
        'Не удалось отклонить предложение',
      );

      if (error.status === 409) {
        return { kind: 'conflict', suggestion, message };
      }

      if (error.status === 403) {
        return { kind: 'forbidden', message };
      }

      return { kind: 'error', message };
    }

    throw error;
  }
}
