'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { TaskDataUploadResponse } from '@/features/task-data-upload/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function uploadTaskData(
  file: File,
  teamId?: number,
): Promise<ActionResult<TaskDataUploadResponse>> {
  const formData = new FormData();
  formData.append('file', file);
  if (teamId !== undefined) {
    formData.append('team_id', String(teamId));
  }

  try {
    const { data } = await httpClient<TaskDataUploadResponse>(
      `${API_URL}/tasks/upload`,
      { method: 'POST', body: formData },
    );

    if (!data) {
      return { data: null, error: 'Server returned an empty response' };
    }

    revalidatePath(ROUTES.DASHBOARD.ISSUES_LIST);

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to process task data',
      );

      let errorCode: string | undefined;
      try {
        const body = JSON.parse(error.responseBody ?? '') as {
          data?: { error_code?: string };
        };
        errorCode = body?.data?.error_code;
      } catch {
        /* leave undefined */
      }

      return {
        data: null,
        error: parsed.message,
        errorCode,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}
