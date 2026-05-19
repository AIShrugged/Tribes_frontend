// ------------------------------
// Generic HTTP client
// ------------------------------
import { redirect } from 'next/navigation';

import { ServerError } from '@/shared/lib/errors';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';

import type { ApiResponse, PaginatedResult } from '@/shared/types/common';

/**
 * httpClient.
 * @param url
 * @param options
 * @returns Promise.
 */
export async function httpClient<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
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

  return { data: json.data };
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
