'use server';

import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueHistoryPeriod, IssueStatsHistory } from '../model/types';

export async function getIssueStatsHistory(
  period: IssueHistoryPeriod,
  range?: number,
): Promise<IssueStatsHistory> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams({
    period,
    organization_id: String(organizationId),
  });
  if (range !== undefined) params.set('range', String(range));
  const { data } = await httpClient<IssueStatsHistory>(
    `${API_URL}/issues/stats/history?${params}`,
  );
  if (!data)
    throw new Error('No history data returned from /issues/stats/history');
  return data;
}
