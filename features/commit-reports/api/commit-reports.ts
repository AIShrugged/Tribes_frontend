'use server';

import { API_URL } from '@/shared/lib/config';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  CommitReportDetail,
  CommitReportSummary,
} from '@/features/commit-reports/model/types';
import type { PaginatedResult } from '@/shared/types/common';

interface GetCommitReportsParams {
  offset?: number;
  limit?: number;
  repo?: string;
  branch?: string;
}

/** Org-scoped changelog timeline, paginated via the Items-Count header. */
export async function getCommitReports(
  orgId: number,
  params: GetCommitReportsParams = {},
): Promise<PaginatedResult<CommitReportSummary>> {
  const query = new URLSearchParams({
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 50),
  });
  if (params.repo) query.set('repo', params.repo);
  if (params.branch) query.set('branch', params.branch);

  return httpClientList<CommitReportSummary>(
    `${API_URL}/organizations/${orgId}/commit-reports?${query.toString()}`,
  );
}

/** One report with its added/fixed child items + matched tasks. */
export async function getCommitReport(
  orgId: number,
  id: number,
): Promise<CommitReportDetail> {
  const { data } = await httpClient<CommitReportDetail>(
    `${API_URL}/organizations/${orgId}/commit-reports/${id}`,
  );
  return data;
}
