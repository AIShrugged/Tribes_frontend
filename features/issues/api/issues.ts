'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { buildIssuesQuery } from '@/features/issues/model/build-issues-query';
import { parseApiError } from '@/shared/lib/apiError';
import { API_URL, FILES_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type { AgentTaskRun } from '@/features/agents/model/types';
import type {
  Issue,
  IssueAttachment,
  IssueFilters,
  IssueUpsertDTO,
  PersonOption,
} from '@/features/issues/model/types';
import type { ActionResult } from '@/shared/types/server-action';

type IssueAttachmentApiResource = IssueAttachment & {
  file_path?: string | null;
  file_url?: string | null;
  uploaded_at?: string | null;
};

/**
 * getFilesBaseUrl.
 * @returns base files url.
 */
function getFilesBaseUrl() {
  if (FILES_URL) {
    return FILES_URL.replace(/\/$/, '');
  }

  const apiUrl = new URL(API_URL);

  return `${apiUrl.origin}/storage`;
}

/**
 * normalizeIssueAttachment.
 * @param attachment - backend attachment resource.
 * @returns normalized attachment.
 */
function normalizeIssueAttachment(
  attachment: IssueAttachmentApiResource,
): IssueAttachment {
  const filePath = attachment.file_path ?? null;
  const baseUrl = getFilesBaseUrl();
  const normalizedFilePath = filePath ? filePath.replace(/^\/+/, '') : null;

  return {
    ...attachment,
    file_path: filePath,
    file_url: attachment.file_url ?? null,
    file_name:
      attachment.file_name ??
      (normalizedFilePath
        ? (normalizedFilePath.split('/').pop() ?? null)
        : null),
    original_name:
      attachment.original_name ??
      attachment.name ??
      (normalizedFilePath
        ? (normalizedFilePath.split('/').pop() ?? null)
        : null),
    url:
      attachment.file_url ??
      attachment.url ??
      (normalizedFilePath ? `${baseUrl}/${normalizedFilePath}` : null),
  };
}

/**
 * getIssues.
 * @param filters - list filters.
 * @returns paginated issues.
 */
export async function getIssues(filters: IssueFilters = {}) {
  const query = buildIssuesQuery({ exclude_archived: true, ...filters });
  const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);

  return {
    data: result.data,
    totalCount: result.totalCount,
    hasMore: (filters.offset ?? 0) + (filters.limit ?? 10) < result.totalCount,
  };
}

/**
 * loadIssuesChunk loads a page of issues for infinite scroll.
 * @param filters - list filters including offset and limit.
 * @returns paginated chunk.
 */
export async function loadIssuesChunk(filters: IssueFilters = {}) {
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const query = buildIssuesQuery({ exclude_archived: true, ...filters });
  const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);

  return {
    data: result.data,
    hasMore: offset + limit < result.totalCount,
  };
}

/**
 * getArchivedCount returns the total count of archived issues matching filters.
 * Archived = status done AND close_date 14+ days ago.
 * @param filters - shared filters (org, team, assignee, type, search).
 * @returns count.
 */
export async function getArchivedCount(
  filters: IssueFilters = {},
): Promise<number> {
  try {
    const query = buildIssuesQuery({
      ...filters,
      archived: true,
      limit: 1,
      offset: 0,
    });
    const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);

    return result.totalCount;
  } catch {
    return 0;
  }
}

/**
 * loadArchivedChunk loads a page of archived issues.
 * @param filters - list filters including offset and limit.
 * @returns paginated chunk.
 */
export async function loadArchivedChunk(
  filters: IssueFilters = {},
): Promise<{ data: Issue[]; hasMore: boolean }> {
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const query = buildIssuesQuery({ ...filters, archived: true, limit, offset });
  const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);

  return {
    data: result.data,
    hasMore: offset + limit < result.totalCount,
  };
}

/**
 * getIssue.
 * @param id - issue id.
 * @returns issue resource.
 */
export async function getIssue(id: number): Promise<Issue> {
  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues/${id}`);

    return data!;
  } catch (error) {
    if (
      error instanceof ServerError &&
      (error.status === 404 || error.status === 403)
    ) {
      notFound();
    }

    throw error;
  }
}

/**
 * createIssue.
 * @param payload - issue payload.
 * @returns created issue or validation error.
 */
export async function createIssue(
  payload: IssueUpsertDTO,
): Promise<ActionResult<Issue>> {
  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    revalidatePath('/dashboard/issues', 'layout');

    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create issue',
      );

      if (error.status === 422) {
        return {
          data: null,
          error: parsed.message,
          fieldErrors: parsed.fieldErrors,
        };
      }
    }

    throw error;
  }
}

/**
 * updateIssue.
 * @param id - issue id.
 * @param payload - issue payload.
 * @returns updated issue or validation error.
 */
export async function updateIssue(
  id: number,
  payload: IssueUpsertDTO,
): Promise<ActionResult<Issue>> {
  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    revalidatePath('/dashboard/issues', 'layout');

    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to update issue',
      );

      if (error.status === 422) {
        return {
          data: null,
          error: parsed.message,
          fieldErrors: parsed.fieldErrors,
        };
      }
    }

    throw error;
  }
}

/**
 * deleteIssue.
 * @param id - issue id.
 * @returns Promise.
 */
export async function deleteIssue(id: number): Promise<void> {
  await httpClient(`${API_URL}/issues/${id}`, { method: 'DELETE' });
  revalidatePath('/dashboard/issues', 'layout');
}

/**
 * dispatchIssue.
 * @param id - issue id.
 * @returns AgentTaskRun on success or error message.
 */
export async function dispatchIssue(
  id: number,
): Promise<{ data: AgentTaskRun | null; error: string | null }> {
  try {
    const { data } = await httpClient<AgentTaskRun>(
      `${API_URL}/issues/${id}/dispatch`,
      {
        method: 'POST',
      },
    );

    return { data: data ?? null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to dispatch agent for issue',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}

/**
 * answerAgentFlow submits a free-text answer to a waiting_for_user agent flow.
 * @param id - issue id.
 * @param answers - free-text answers to the flow's questions.
 * @returns action result.
 */
export async function answerAgentFlow(
  id: number,
  answers: string,
): Promise<{ error: string | null }> {
  try {
    await httpClient(`${API_URL}/issues/${id}/agent-flow/answer`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
      headers: { 'Content-Type': 'application/json' },
    });

    return { error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to submit answer',
      );

      return { error: parsed.message };
    }

    throw error;
  }
}

/**
 * linkIssuesToEpic sets epic_id on a batch of issues (child-side relationship only).
 * Fires PATCH requests in parallel and collects failures.
 * @param epicId - id of the parent epic.
 * @param issueIds - ids of child issues to link.
 * @returns list of ids that failed to update.
 */
export async function linkIssuesToEpic(
  epicId: number,
  issueIds: number[],
): Promise<number[]> {
  if (issueIds.length === 0) return [];

  const results = await Promise.allSettled(
    issueIds.map((childId) => {
      return httpClient(`${API_URL}/issues/${childId}`, {
        method: 'PATCH',
        body: JSON.stringify({ epic_id: epicId }),
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );

  revalidatePath('/dashboard/issues', 'layout');

  return issueIds.filter((_, i) => {
    return results[i].status === 'rejected';
  });
}

/**
 * getEpics fetches open/in-progress issues of type 'epic' for use in dropdowns.
 * Wrapped with React.cache() to deduplicate within a single render pass
 * (e.g. when both layout.tsx and page.tsx call it with the same args).
 * @param organizationId - optional organization scope.
 * @returns epics list.
 */
export const getEpics = cache(async function getEpics(
  organizationId?: number | null,
): Promise<Issue[]> {
  try {
    const query = buildIssuesQuery({
      type: 'epic',
      organization_id: organizationId ?? null,
      limit: 100,
      offset: 0,
      exclude_archived: true,
    });
    const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);

    return result.data;
  } catch {
    return [];
  }
});

/**
 * linkTaskToEpic sets epic_id on a single task.
 * @param epicId - id of the parent epic.
 * @param taskId - id of the task to link.
 * @returns updated issue or error.
 */
export async function linkTaskToEpic(
  epicId: number,
  taskId: number,
): Promise<ActionResult<Issue>> {
  if (
    !Number.isInteger(epicId) ||
    epicId <= 0 ||
    !Number.isInteger(taskId) ||
    taskId <= 0
  ) {
    return { data: null, error: 'Invalid task or epic ID' };
  }

  try {
    const { data } = await httpClient<Issue>(`${API_URL}/issues/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ epic_id: epicId }),
      headers: { 'Content-Type': 'application/json' },
    });

    revalidatePath('/dashboard/issues', 'layout');

    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to link task',
      );

      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}

/**
 * getTasksForEpicForm fetches non-epic issues for the child task selector on the epic form.
 * @param organizationId - optional org scope.
 * @returns issues list (max 200).
 */
export async function getTasksForEpicForm(
  organizationId?: number | null,
): Promise<Issue[]> {
  try {
    const query = buildIssuesQuery({
      organization_id: organizationId ?? null,
      exclude_archived: true,
      limit: 100,
      offset: 0,
    });
    const result = await httpClientList<Issue>(`${API_URL}/issues?${query}`);
    return result.data.filter((i) => {
      return i.type !== 'epic';
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[getTasksForEpicForm] failed to load tasks:', error);
    return [];
  }
}

/**
 * getPersons.
 * @returns persons list.
 */
export async function getPersons(): Promise<PersonOption[]> {
  const result = await httpClientList<PersonOption>(`${API_URL}/persons`);
  return result.data;
}

/**
 * getIssueAttachments.
 * @param issueId - issue id.
 * @returns attachments.
 */
export async function getIssueAttachments(
  issueId: number,
): Promise<IssueAttachment[]> {
  const result = await httpClientList<IssueAttachmentApiResource>(
    `${API_URL}/issues/${issueId}/attachments`,
  );

  return result.data.map((attachment) => {
    return normalizeIssueAttachment(attachment);
  });
}

/**
 * uploadIssueAttachment.
 * @param issueId - issue id.
 * @param file - file to upload.
 * @returns uploaded attachment or error.
 */
export async function uploadIssueAttachment(
  issueId: number,
  file: File,
): Promise<ActionResult<IssueAttachment>> {
  try {
    const formData = new FormData();

    formData.append('file', file);

    const { data } = await httpClient<IssueAttachmentApiResource>(
      `${API_URL}/issues/${issueId}/attachments`,
      { method: 'POST', body: formData },
    );

    if (!data) return { data: null, error: 'Upload failed' };

    return { data: normalizeIssueAttachment(data), error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to upload attachment',
      );

      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}

/**
 * deleteAttachment.
 * @param attachmentId - attachment id.
 * @returns action result.
 */
export async function deleteAttachment(
  attachmentId: number,
): Promise<ActionResult<null>> {
  try {
    await httpClient(`${API_URL}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete attachment',
      );

      return { data: null, error: parsed.message, fieldErrors: undefined };
    }

    throw error;
  }
}

/**
 * uploadPendingAttachment — uploads a file before the issue exists.
 * The file is stored server-side with the given upload_token and bound
 * to the issue when IssueController::store is called.
 * @param file - file to upload.
 * @param uploadToken - UUID v4 session token grouping pre-creation uploads.
 * @returns uploaded attachment or error.
 */
export async function uploadPendingAttachment(
  file: File,
  uploadToken: string,
): Promise<ActionResult<IssueAttachment>> {
  try {
    const formData = new FormData();

    formData.append('file', file);
    formData.append('upload_token', uploadToken);

    const { data } = await httpClient<IssueAttachmentApiResource>(
      `${API_URL}/attachments/pending`,
      { method: 'POST', body: formData },
    );

    if (!data) return { data: null, error: 'Upload failed' };

    return { data: normalizeIssueAttachment(data), error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to upload file',
      );

      return {
        data: null,
        error: parsed.message,
        fieldErrors: parsed.fieldErrors,
      };
    }

    throw error;
  }
}

/**
 * deletePendingAttachment — deletes a pending (unbound) attachment before issue creation.
 * @param attachmentId - attachment id.
 * @returns action result.
 */
export async function deletePendingAttachment(
  attachmentId: number,
): Promise<ActionResult<null>> {
  try {
    await httpClient(`${API_URL}/attachments/pending/${attachmentId}`, {
      method: 'DELETE',
    });

    return { data: null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete file',
      );

      return { data: null, error: parsed.message, fieldErrors: undefined };
    }

    throw error;
  }
}
