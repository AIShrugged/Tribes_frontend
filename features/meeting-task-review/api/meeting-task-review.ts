'use server';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { MeetingTaskReview } from '../model/types';

export async function getLatestMeetingTaskReview(): Promise<MeetingTaskReview | null> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams({
    organization_id: String(organizationId),
  });

  try {
    const { data } = await httpClient<MeetingTaskReview>(
      `${API_URL}/calendar-events/task-review/latest?${params}`,
    );
    return data;
  } catch (error) {
    // 404 = no task review exists yet for this organization
    if (error instanceof ServerError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
