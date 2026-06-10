'use server';

import { revalidatePath } from 'next/cache';

import { API_URL } from '@/shared/lib/config';
import { httpClient, httpClientAction } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type {
  ExtractionPlanEditInput,
  ExtractionPlanResponse,
  UploadReviewType,
} from '@/features/upload-review/model/types';
import type { ActionResult } from '@/shared/types/server-action';

/** GET the staged moderation plan. Throws (→ error boundary) — read-only, called from the page RSC. */
export async function getPlan(
  type: UploadReviewType,
  id: number,
): Promise<ExtractionPlanResponse> {
  const { data } = await httpClient<ExtractionPlanResponse>(
    `${API_URL}/uploads/${type}/${id}/plan`,
  );
  return data;
}

/** PATCH the editable plan fields. */
export async function updatePlan(
  type: UploadReviewType,
  id: number,
  payload: ExtractionPlanEditInput,
): Promise<ActionResult<ExtractionPlanResponse>> {
  return httpClientAction<ExtractionPlanResponse>(
    `${API_URL}/uploads/${type}/${id}/plan`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to save changes',
  );
}

/** Approve: materialize issues/decisions + replay downstream (notifications fire now). */
export async function approveUpload(
  type: UploadReviewType,
  id: number,
): Promise<
  ActionResult<{
    issues_created: number;
    issues_updated: number;
    decisions_created: number;
  }>
> {
  const result = await httpClientAction<{
    issues_created: number;
    issues_updated: number;
    decisions_created: number;
  }>(
    `${API_URL}/uploads/${type}/${id}/approve`,
    { method: 'POST' },
    'Failed to approve',
  );

  revalidatePath(ROUTES.DASHBOARD.UPLOADS_LOG);
  revalidatePath(ROUTES.DASHBOARD.UPLOAD_DETAIL(type, id));

  return result;
}

/** Reject: discard the staged plan (nothing was ever written). */
export async function rejectUpload(
  type: UploadReviewType,
  id: number,
): Promise<ActionResult<null>> {
  const result = await httpClientAction<null>(
    `${API_URL}/uploads/${type}/${id}/reject`,
    { method: 'POST' },
    'Failed to reject',
  );

  revalidatePath(ROUTES.DASHBOARD.UPLOADS_LOG);
  revalidatePath(ROUTES.DASHBOARD.UPLOAD_DETAIL(type, id));

  return result;
}
