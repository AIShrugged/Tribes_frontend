'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';
import { httpClient } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type {
  OrganizationDTO,
  OrganizationProps,
  OrganizationUpdateDTO,
} from '@/entities/organization';
import type { ApiResponse } from '@/shared/types/common';
import type { ActionResult } from '@/shared/types/server-action';

export const getOrganizations = cache(
  async (): Promise<ApiResponse<OrganizationProps[]>> => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/organizations?limit=50&offset=0`, {
      method: 'GET',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) {
        redirect('/api/auth/logout');
      }

      const text = await res.text();

      // eslint-disable-next-line no-console
      console.error(
        `[org] getOrganizations → ${res.status} ${res.statusText}: ${text}`,
      );
      throw new Error('Failed to load organizations. Please try again.');
    }

    const json: ApiResponse<OrganizationProps[]> = await res.json();

    if (!json.success || !json.data) {
      throw new Error(json.error ?? 'Invalid API response');
    }

    return { data: json.data };
  },
);
export const getOrganization = cache(
  async (organization_id: string): Promise<ApiResponse<OrganizationProps>> => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/organizations/${organization_id}`, {
      method: 'GET',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) {
        redirect('/api/auth/logout');
      }

      const text = await res.text();

      // eslint-disable-next-line no-console
      console.error(
        `[org] getOrganization → ${res.status} ${res.statusText}: ${text}`,
      );
      throw new Error('Failed to load organization. Please try again.');
    }

    const json: ApiResponse<OrganizationProps> = await res.json();

    if (!json.success || !json.data) {
      throw new Error(json.error ?? 'Invalid API response');
    }

    return { data: json.data };
  },
);

/**
 * previewOrganizationCode — live suggestion of the project prefix the backend
 * would generate for a given name (transliterates Cyrillic, resolves collisions
 * against the real DB). Best-effort: returns null on any failure so it never
 * blocks the create form. The final code is the one returned by
 * createOrganization — treat this only as a prefill hint.
 * @param name - the org name typed so far.
 * @returns suggested code or null.
 */
export async function previewOrganizationCode(
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();

  if (!trimmed) return null;

  try {
    const { data } = await httpClient<{ code: string }>(
      `${API_URL}/organizations/preview-code?name=${encodeURIComponent(trimmed)}`,
    );

    return data?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * createOrganization. On success the backend returns the final `code` (source of
 * truth — may differ from the preview on a collision) and we redirect via
 * selectOrganizationAction. On a validation failure (e.g. 422 errors.code) we
 * return an ActionResult with fieldErrors so the form can surface them.
 * @param data - name and optional code override.
 * @returns ActionResult (error path only; success redirects).
 */
export async function createOrganization(
  data: OrganizationDTO,
): Promise<ActionResult<OrganizationProps>> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/organizations`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 401) {
      redirect('/api/auth/logout');
    }

    const text = await res.text();

    // eslint-disable-next-line no-console
    console.error(
      `[org] createOrganization → ${res.status} ${res.statusText}: ${text}`,
    );

    const parsed = parseApiError(
      text,
      'Failed to create organization. Please try again.',
    );

    return {
      data: null,
      error: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const json: ApiResponse<OrganizationProps> = await res.json();

  if (!json.success || !json.data) {
    return { data: null, error: json.error ?? 'Invalid API response' };
  }

  const formData = new FormData();

  formData.append('organization_id', String(json.data.id));

  // selectOrganizationAction redirects; the NEXT_REDIRECT propagates and the
  // return below is only reached in the (unexpected) non-redirect case.
  await selectOrganizationAction(formData);

  return { data: json.data, error: null };
}

/**
 * updateOrganization.
 * @param organizationId - organization id.
 * @param data - data.
 * @returns Promise.
 */
export async function updateOrganization(
  organizationId: number,
  data: OrganizationUpdateDTO,
) {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/organizations/${organizationId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();

    // eslint-disable-next-line no-console
    console.error(
      `[org] updateOrganization → ${res.status} ${res.statusText}: ${text}`,
    );
    throw new Error('Failed to update organization. Please try again.');
  }

  const json: ApiResponse<OrganizationProps> = await res.json();

  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Invalid API response');
  }

  return { data: json.data };
}

/**
 * setActiveOrganization.
 * @param prevState
 * @param prevState.ok
 * @param formData
 * @returns Promise.
 */
export async function setActiveOrganization(
  prevState: { ok: boolean },
  formData: FormData,
) {
  const id = formData.get('organization_id') as string;
  const store = await cookies();

  store.set({
    name: 'organization_id',
    value: id,
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath(ROUTES.DASHBOARD.ORGANIZATION);
  revalidatePath('/dashboard', 'layout');

  return { ok: true };
}

/**
 * selectOrganizationAction.
 * @param formData - formData.
 * @returns Promise.
 */
export async function selectOrganizationAction(formData: FormData) {
  const id = formData.get('organization_id') as string;
  const store = await cookies();

  store.set({
    name: 'organization_id',
    value: id,
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  const { data: org } = await getOrganization(id);

  if (!org?.onboarded_at) {
    redirect(ROUTES.ONBOARDING);
  }

  redirect(ROUTES.DASHBOARD.TODAY);
}

/**
 * deleteOrganization.
 * @param organizationId - organization id.
 * @returns ActionResult.
 */
export async function deleteOrganization(
  organizationId: number,
): Promise<ActionResult<void>> {
  try {
    await httpClient<void>(`${API_URL}/organizations/${organizationId}`, {
      method: 'DELETE',
    });

    const store = await cookies();

    store.delete('organization_id');
    revalidatePath(ROUTES.AUTH.ORGANIZATION);

    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete organization. Please try again.',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}
