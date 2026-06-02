'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  UploadDetail,
  UploadLogItem,
  UploadType,
} from '@/features/uploads/model/types';
import type { PaginatedResult } from '@/shared/types/common';

interface GetUploadsParams {
  offset?: number;
  limit?: number;
  type?: UploadType;
  status?: 'processing' | 'done' | 'failed';
}

/** Unified Upload Log feed (transcript + task-data), paginated via Items-Count. */
export async function getUploads(
  params: GetUploadsParams = {},
): Promise<PaginatedResult<UploadLogItem>> {
  const query = new URLSearchParams({
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 50),
  });
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);

  return httpClientList<UploadLogItem>(`${API_URL}/uploads?${query.toString()}`);
}

/** Per-upload detail (discriminated by type). */
export async function getUploadDetail(
  type: UploadType,
  id: number,
): Promise<UploadDetail> {
  const { data } = await httpClient<UploadDetail>(
    `${API_URL}/uploads/${type}/${id}`,
  );
  return data;
}
