'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueHealthReport } from '@/features/issues/model/types';

export async function getIssueHealth(
  teamId: number | string,
): Promise<IssueHealthReport | null> {
  const { data } = await httpClient<IssueHealthReport | null>(
    `${API_URL}/teams/${teamId}/issue-health`,
  );
  return data;
}
