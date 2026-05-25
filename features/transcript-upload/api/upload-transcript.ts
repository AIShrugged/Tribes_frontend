'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type {
  TranscriptUploadInput,
  UploadTranscriptResponse,
} from '@/features/transcript-upload/model/types';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * Upload a transcript file to an existing or freshly-created CalendarEvent.
 *
 * Backend endpoint: POST /api/v1/transcripts/upload (multipart/form-data).
 * Returns 201 with calendar_event_id on success.
 *
 * Error codes the backend may return (mapped to Russian copy in
 * model/schema.ts → ERROR_CODE_MESSAGES):
 *   NO_SOURCE — uploader has no connected calendar source
 *   TRANSCRIPT_PARSE_FAILED — parser couldn't extract entries
 *   TOO_MANY_ENTRIES — > 10 000 parsed entries
 *   UNSUPPORTED_FORMAT — content didn't match any known format
 */
export async function uploadTranscript(
  input: TranscriptUploadInput,
): Promise<ActionResult<UploadTranscriptResponse>> {
  const formData = new FormData();
  formData.append('file', input.file);

  if (input.mode === 'existing') {
    formData.append('calendar_event_id', String(input.calendar_event_id));
  } else {
    formData.append('title', input.title);
    formData.append('starts_at', new Date(input.starts_at).toISOString());
    formData.append('ends_at', new Date(input.ends_at).toISOString());
    if (input.team_id !== undefined) {
      formData.append('team_id', String(input.team_id));
    }
  }

  try {
    const { data } = await httpClient<UploadTranscriptResponse>(
      `${API_URL}/transcripts/upload`,
      { method: 'POST', body: formData },
    );

    if (!data) {
      return { data: null, error: 'Сервер вернул пустой ответ' };
    }

    // Invalidate cached list views so new/updated meeting is reflected.
    revalidatePath(ROUTES.DASHBOARD.MEETINGS_LIST);
    revalidatePath(`/dashboard/meetings/${data.calendar_event_id}`, 'layout');

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Не удалось загрузить транскрипт',
      );

      // Backend wraps error_code inside `data` (per ApiResponse::error in
      // TranscriptUploadController). Extract locally — there's precedent
      // for this pattern in features/calendar and features/user-profile.
      let errorCode: string | undefined;
      try {
        const body = JSON.parse(error.responseBody ?? '') as {
          data?: { error_code?: string };
          meta?: { error_code?: string };
        };
        errorCode = body?.data?.error_code ?? body?.meta?.error_code;
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
