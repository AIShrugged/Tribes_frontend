'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';

import { onboardingDraftResponseSchema } from '../model/schemas';

import type {
  AcceptStructurePayload,
  AcceptStructureResponse,
  GenerateStructurePayload,
  OnboardingDraftResponse,
} from '../model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getLatestDraft(
  orgId: string | number,
): Promise<OnboardingDraftResponse | null> {
  try {
    const { data } = await httpClient<OnboardingDraftResponse>(
      `${API_URL}/organizations/${orgId}/drafts/latest`,
    );

    const parsed = onboardingDraftResponseSchema.safeParse(data);

    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) return null;

    return null;
  }
}

export async function generateStructure(
  orgId: number,
  payload: GenerateStructurePayload,
): Promise<ActionResult<{ draft_id: number; status: 'pending' }>> {
  try {
    const { data } = await httpClient<{ draft_id: number; status: 'pending' }>(
      `${API_URL}/organizations/${orgId}/generate-structure`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!data) return { data: null, error: 'Failed to start generation' };

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to start generation',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}

export async function skipOnboarding(orgId: number): Promise<void> {
  const store = await cookies();

  store.set({
    name: 'onboarding_skipped',
    value: String(orgId),
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  revalidatePath('/dashboard', 'layout');
}

export async function acceptStructure(
  orgId: number,
  payload: AcceptStructurePayload,
): Promise<ActionResult<AcceptStructureResponse>> {
  try {
    const { data } = await httpClient<AcceptStructureResponse>(
      `${API_URL}/organizations/${orgId}/accept-structure`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!data) return { data: null, error: 'Failed to save organization' };

    const store = await cookies();

    store.set({
      name: 'org_onboarded',
      value: '1',
      httpOnly: true,
      secure:
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath('/dashboard', 'layout');

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to save organization',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}
