'use server';

import { cache } from 'react';

import { API_URL } from '@/shared/lib/config';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { httpClient } from '@/shared/lib/httpClient';

import type { IssueStats } from '../model/types';

export const getIssueStats = cache(
  async function getIssueStats(): Promise<IssueStats> {
    const organizationId = await getOrganizationId();
    const params = new URLSearchParams({
      organization_id: String(organizationId),
    });
    const { data } = await httpClient<IssueStats>(
      `${API_URL}/issues/stats?${params}`,
    );
    if (!data) throw new Error('No stats data returned from /issues/stats');
    return data;
  },
);
