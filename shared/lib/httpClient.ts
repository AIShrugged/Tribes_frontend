// ------------------------------
// Generic HTTP client
// ------------------------------
import { redirect } from 'next/navigation';

import { parseApiError } from '@/shared/lib/apiError';
import { ServerError } from '@/shared/lib/errors';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';

import type { ApiResponse, PaginatedResult } from '@/shared/types/common';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * httpClient.
 * @param url
 * @param options
 * @returns Promise.
 */
export async function httpClient<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ data: T }> {
  const authHeaders = await getAuthHeaders();

  // When the body is FormData, let fetch set Content-Type automatically
  // (it must include the multipart boundary). Overriding it breaks uploads.
  if (options.body instanceof FormData) {
    delete (authHeaders as Record<string, string>)['Content-Type'];
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 401) {
      redirect('/api/auth/logout');
    }

    const text = await res.text();

    throw new ServerError('A server error occurred. Please try again.', {
      status: res.status,
      url,
      responseBody: text,
    });
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ServerError(json.error ?? 'Invalid API response', { url });
  }

  return { data: json.data as T };
}

// ------------------------------
// Action HTTP client — wraps httpClient for mutation Server Actions
// Soft-returns ActionResult for 403, 422, and business-logic rejections
// (HTTP 200 with json.success === false yields a statusless ServerError).
// All other errors (5xx, network) are re-thrown to the error boundary.
// ------------------------------
export async function httpClientAction<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<ActionResult<T>> {
  try {
    const { data } = await httpClient<T>(url, init);

    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(error.responseBody ?? '', fallbackMessage);

      if (
        error.status === 422 ||
        error.status === 403 ||
        error.status === undefined
      ) {
        return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
      }
    }

    throw error;
  }
}

// ------------------------------
// Paginated HTTP client — extracts Items-Count header
// ------------------------------
/**
 * httpClientList.
 * @param url
 * @param options
 * @returns Promise.
 */
export async function httpClientList<T>(
  url: string,
  options: RequestInit = {},
): Promise<PaginatedResult<T>> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 401) {
      redirect('/api/auth/logout');
    }

    const text = await res.text();

    throw new ServerError('A server error occurred. Please try again.', {
      status: res.status,
      url,
      responseBody: text,
    });
  }

  const json: ApiResponse<T[]> = await res.json();

  if (!json.success) {
    throw new ServerError(json.error ?? 'Invalid API response', { url });
  }

  const totalCount = Number(res.headers.get('Items-Count') ?? '0');

  const data = json.data ?? [];

  return {
    data,
    totalCount,
    hasMore: data.length < totalCount,
  };
}
