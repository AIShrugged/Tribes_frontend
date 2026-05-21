'use server';

import { httpClient } from '@/shared/lib/httpClient';

import type { IssueAuditEvent } from '@/entities/issue';

const API_URL = process.env.API_URL;

export async function getIssueAuditLog(
  issueId: number,
): Promise<IssueAuditEvent[]> {
  const { data } = await httpClient<IssueAuditEvent[]>(
    `${API_URL}/issues/${issueId}/audit-log`,
  );
  return data ?? [];
}
