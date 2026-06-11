'use server';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type {
  MeetingTaskReview,
  MeetingTaskReviewBlock,
  MeetingTaskReviewStatus,
} from '../model/types';

interface TaskReviewApiShape {
  review: {
    id: number;
    calendar_event_id: number;
    status: MeetingTaskReviewStatus;
    analyzed_count: number;
    generated_at: string;
    error: string | null;
  };
  llm_blocks: MeetingTaskReviewBlock[];
  health_blocks: MeetingTaskReviewBlock[];
}

function flattenReview(shape: TaskReviewApiShape): MeetingTaskReview {
  return {
    ...shape.review,
    llm_blocks: shape.llm_blocks,
    health_blocks: shape.health_blocks,
  };
}

export async function getLatestMeetingTaskReview(): Promise<MeetingTaskReview | null> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams({
    organization_id: String(organizationId),
  });

  try {
    const { data } = await httpClient<TaskReviewApiShape>(
      `${API_URL}/calendar-events/task-review/latest?${params}`,
    );
    return data ? flattenReview(data) : null;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getEventTaskReview(
  eventId: number,
): Promise<MeetingTaskReview | null> {
  try {
    const { data } = await httpClient<TaskReviewApiShape>(
      `${API_URL}/calendar-events/${eventId}/task-review`,
    );
    return data ? flattenReview(data) : null;
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
