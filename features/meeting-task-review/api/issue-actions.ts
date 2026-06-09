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
      body: JSON.stringify({
        name: issue.name,
        description: issue.description,
        type: issue.type,
        status: 'done',
        organization_id: organizationId,
        team_id: issue.team_id,
        assignee_id: issue.assignee_id,
        due_date: issue.due_date,
        priority: issue.priority,
        epic_id: issue.epic_id,
        author_id: issue.author_id,
      }),
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
