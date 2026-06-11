'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { ActionResult } from '@/shared/types/server-action';

interface IssueSnapshot {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: string;
  team_id: number | null;
  assignee_id: number | null;
  due_date: string | null;
  priority: number;
  epic_id: number | null;
  author_id: number | null;
}

function buildIssuePatchBody(
  issue: IssueSnapshot,
  status: string,
  organizationId: number | string,
) {
  return {
    name: issue.name,
    description: issue.description,
    type: issue.type,
    status,
    organization_id: organizationId,
    team_id: issue.team_id,
    assignee_id: issue.assignee_id,
    due_date: issue.due_date,
    priority: issue.priority,
    epic_id: issue.epic_id,
    author_id: issue.author_id,
  };
}

export async function closeReviewIssue(
  issueId: number,
): Promise<ActionResult<void>> {
  try {
    const [{ data: issue }, organizationId] = await Promise.all([
      httpClient<IssueSnapshot>(`${API_URL}/issues/${issueId}`),
      getOrganizationId(),
    ]);

    if (!issue) return { data: null, error: 'Задача не найдена' };

    await httpClient(`${API_URL}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIssuePatchBody(issue, 'done', organizationId)),
    });

    revalidatePath('/dashboard/today/progress');

    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Не удалось закрыть задачу',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

export async function bulkDeleteReviewIssues(
  issueIds: number[],
): Promise<ActionResult<{ deletedCount: number; failedCount: number }>> {
  const results = await Promise.allSettled(
    issueIds.map((id) => {
      return httpClient(`${API_URL}/issues/${id}`, { method: 'DELETE' });
    }),
  );

  const deletedCount = results.filter((r) => {
    return r.status === 'fulfilled';
  }).length;
  const failedCount = results.length - deletedCount;

  if (deletedCount > 0) {
    revalidatePath('/dashboard/today/progress');
  }

  if (failedCount > 0) {
    return { data: null, error: `Не удалось удалить ${failedCount} задач` };
  }
  return { data: { deletedCount, failedCount }, error: null };
}

export async function bulkPauseReviewIssues(
  issueIds: number[],
): Promise<ActionResult<{ pausedCount: number; failedCount: number }>> {
  const [fetchResults, organizationId] = await Promise.all([
    Promise.allSettled(
      issueIds.map((id) => {
        return httpClient<IssueSnapshot>(`${API_URL}/issues/${id}`);
      }),
    ),
    getOrganizationId(),
  ]);

  const patchResults = await Promise.allSettled(
    fetchResults.map((result, i) => {
      if (result.status !== 'fulfilled' || !result.value.data) {
        return Promise.reject(new Error('Issue not found'));
      }
      return httpClient(`${API_URL}/issues/${issueIds[i]}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildIssuePatchBody(result.value.data, 'paused', organizationId),
        ),
      });
    }),
  );

  const pausedCount = patchResults.filter((r) => {
    return r.status === 'fulfilled';
  }).length;
  const failedCount = patchResults.length - pausedCount;

  if (pausedCount > 0) {
    revalidatePath('/dashboard/today/progress');
  }

  if (failedCount > 0) {
    return {
      data: null,
      error: `Не удалось поставить на паузу ${failedCount} задач`,
    };
  }
  return { data: { pausedCount, failedCount }, error: null };
}
