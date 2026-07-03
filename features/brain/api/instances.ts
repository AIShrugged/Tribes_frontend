'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type {
  EnableBrainPayload,
  SecondBrainInstance,
} from '@/features/brain/model/types';
import type { ActionResult } from '@/shared/types/server-action';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * Lists second-brain instances across every organization the user manages (one
 * synthesized `disabled` entry per never-enabled org). Pass `organizationId` to
 * scope to one. Read-only — throws to the error boundary on failure.
 * @param organizationId - optional org filter.
 */
export async function getBrainInstances(
  organizationId?: number,
): Promise<SecondBrainInstance[]> {
  const query = organizationId ? `?organization_id=${organizationId}` : '';

  const { data } = await httpClientList<SecondBrainInstance>(
    `${API_URL}/brain/instances${query}`,
  );

  return data;
}

/**
 * Fetches a single organization's instance. Returns a synthesized
 * `{ enabled: false, status: 'disabled' }` stub (not a 404) when never enabled.
 * Used by the client poller while a container is coming up / down.
 * @param organizationId - the organization id.
 */
export async function getBrainInstance(
  organizationId: number,
): Promise<SecondBrainInstance> {
  const { data } = await httpClient<SecondBrainInstance>(
    `${API_URL}/brain/instances/${organizationId}`,
  );

  return data;
}

/**
 * Soft-returns an ActionResult from a caught ServerError, surfacing the backend
 * `meta.error_code` and field errors for 4xx; re-throws anything unexpected.
 * @param error - the caught error.
 * @param fallback - fallback user message.
 */
function toActionError(
  error: unknown,
  fallback: string,
): ActionResult<SecondBrainInstance> {
  if (error instanceof ServerError) {
    const parsed = parseApiError(error.responseBody ?? '', fallback);

    if (
      error.status === 422 ||
      error.status === 403 ||
      error.status === undefined
    ) {
      return {
        data: null,
        error: parsed.message,
        errorCode: parsed.errorCode,
        fieldErrors: parsed.fieldErrors,
      };
    }
  }

  throw error;
}

/**
 * Enables (or re-enables / rotates the credential of) an organization's brain.
 * The backend responds asynchronously — expect `status: 'pending'`, then poll.
 * Credential fields are required on the first enable and optional afterwards
 * (`{}` re-enables with the stored credential).
 * @param organizationId - the organization id.
 * @param payload - optional credential (type + token).
 */
export async function enableBrainInstance(
  organizationId: number,
  payload: EnableBrainPayload = {},
): Promise<ActionResult<SecondBrainInstance>> {
  try {
    const { data } = await httpClient<SecondBrainInstance>(
      `${API_URL}/brain/instances/${organizationId}/enable`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      },
    );

    revalidatePath(ROUTES.DASHBOARD.TEMP_SETTINGS);

    return { data, error: null };
  } catch (error) {
    return toActionError(error, 'Не удалось включить «второй мозг»');
  }
}

/**
 * Disables an organization's brain. Responds with `status: 'stopping'`; the
 * stored credential is kept (encrypted) for a fast re-enable, the MCP token is
 * revoked.
 * @param organizationId - the organization id.
 */
export async function disableBrainInstance(
  organizationId: number,
): Promise<ActionResult<SecondBrainInstance>> {
  try {
    const { data } = await httpClient<SecondBrainInstance>(
      `${API_URL}/brain/instances/${organizationId}/disable`,
      { method: 'POST' },
    );

    revalidatePath(ROUTES.DASHBOARD.TEMP_SETTINGS);

    return { data, error: null };
  } catch (error) {
    return toActionError(error, 'Не удалось выключить «второй мозг»');
  }
}
