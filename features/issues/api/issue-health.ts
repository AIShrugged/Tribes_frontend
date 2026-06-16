'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueHealthReport } from '@/features/issues/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getIssueHealth(
  teamId: number | string,
): Promise<IssueHealthReport | null> {
  const { data } = await httpClient<IssueHealthReport | null>(
    `${API_URL}/teams/${teamId}/issue-health`,
  );
  return data;
}

export async function refreshIssueHealth(
  teamId: number,
): Promise<ActionResult<IssueHealthReport | null>> {
  try {
    const { data } = await httpClient<IssueHealthReport | null>(
      `${API_URL}/teams/${teamId}/issue-health/refresh`,
      { method: 'POST' },
    );
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Не удалось запустить обновление анализа',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

export async function revalidateAttentionPage(): Promise<void> {
  revalidatePath('/dashboard/issues/attention');
}
