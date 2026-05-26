'use server';

import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { TodayBriefing } from '../model/types';

const EMPTY_BRIEFING: TodayBriefing = {
  state: 'empty',
  date: '',
  events: [],
  carried_tasks: [],
  waiting_on_you: [],
  stale: [],
  nudge: null,
};

export async function getTodayBriefing(date?: string): Promise<TodayBriefing> {
  const organizationId = await getOrganizationId();
  const params = new URLSearchParams({
    organization_id: String(organizationId),
  });
  if (date) params.set('date', date);
  const { data } = await httpClient<TodayBriefing>(
    `${API_URL}/me/today?${params}`,
  );

  return data ?? EMPTY_BRIEFING;
}
