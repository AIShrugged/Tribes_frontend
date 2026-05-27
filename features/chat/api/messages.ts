'use server';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  AgentRun,
  Message,
  PageContext,
} from '@/features/chat/model/types';
import type { ActionResult } from '@/shared/types/server-action';

export async function getMessages(
  chatId: number,
  offset = 0,
  limit = 50,
): Promise<{ data: Message[]; totalCount: number; hasMore: boolean }> {
  const result = await httpClientList<Message>(
    `${API_URL}/chats/${chatId}/messages?offset=${offset}&limit=${limit}`,
  );
  return {
    data: result.data.toSorted((a, b) => {
      return a.id - b.id;
    }),
    totalCount: result.totalCount,
    hasMore: offset + result.data.length < result.totalCount,
  };
}

export async function sendMessage(
  chatId: number,
  content: string,
  pageContext?: PageContext,
): Promise<ActionResult<Message>> {
  try {
    const { data } = await httpClient<Message>(
      `${API_URL}/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          ...(pageContext?.page_text !== undefined && {
            page_text: pageContext.page_text,
          }),
          ...(pageContext?.page_title !== undefined && {
            page_title: pageContext.page_title,
          }),
          ...(pageContext?.page_url !== undefined && {
            page_url: pageContext.page_url,
          }),
        }),
      },
    );
    return { data: data!, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to send message',
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
 * pollRun.
 * GET /api/v1/chats/{chatId}/runs/{runUuid}
 * Returns the current run status and, when completed, the final message.
 * Max 60 attempts × 1500ms = 90s timeout. Backend may complete after this point.
 * Recovery: user can refresh — the mount effect re-polls in-flight runs on load.
 */
export async function pollRun(
  chatId: number,
  runUuid: string,
): Promise<AgentRun> {
  const { data } = await httpClient<AgentRun>(
    `${API_URL}/chats/${chatId}/runs/${runUuid}`,
  );
  return data!;
}
