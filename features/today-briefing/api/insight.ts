'use server';

import { cache } from 'react';

import { API_URL } from '@/shared/lib/config';
import { httpClient } from '@/shared/lib/httpClient';

import type { InsightFullProfile } from '../model/types';
import type { ProfileIdentity } from '@/entities/user';

/**
 * Fetches the current user's AI insight profile.
 * Memoised per React render tree — call freely from Server Components.
 * Do NOT call from Client Components (this is a Server Action).
 *
 * Returns null when:
 * - user has no linked profile identities
 * - the insight profile ID is invalid
 * - the backend returns null data
 *
 * The caller is responsible for showing the appropriate empty/collecting state.
 */
export const getMyInsightProfile = cache(
  async (): Promise<InsightFullProfile | null> => {
    const { data: identities } = await httpClient<ProfileIdentity[]>(
      `${API_URL}/users/me/identities`,
    );

    if (!identities || identities.length === 0) {
      return null;
    }

    // Prefer google_calendar identity — null channel never matches, safe
    const primary =
      identities.find((identity) => {
        return identity.channel === 'google_calendar';
      }) ?? identities[0];

    // Guard against non-integer IDs before URL construction
    if (!Number.isInteger(primary.id) || primary.id <= 0) {
      return null;
    }

    // Sequential fetch required — profile ID depends on identity result
    const { data } = await httpClient<InsightFullProfile | null>(
      `${API_URL}/insight/profiles/${primary.id}`,
    );

    return data;
  },
);
