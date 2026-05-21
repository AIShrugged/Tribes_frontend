'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { Source } from '@/entities/source';
import type { ActionResult } from '@/shared/types/server-action';

/**
 * getSources — fetches the list of calendar sources for the authenticated user.
 * @returns Array of Source objects, or empty array on error.
 */
export async function getSources(): Promise<Source[]> {
  try {
    const { data } = await httpClientList<Source>(`${API_URL}/sources`);

    return data;
  } catch {
    return [];
  }
}

/**
 * detachCalendar — removes a calendar source (disconnects Google Calendar).
 * Calls DELETE /v1/sources/{id}.
 * @param sourceId - The numeric ID of the Source to delete.
 * @returns ActionResult (never returns on success — redirects instead).
 */
export async function detachCalendar(sourceId: number): Promise<ActionResult> {
  try {
    await httpClient(`${API_URL}/sources/${sourceId}`, { method: 'DELETE' });

    revalidatePath(ROUTES.DASHBOARD.MEETINGS_CALENDAR, 'layout');
    revalidatePath(ROUTES.DASHBOARD.PROFILE_CALENDAR, 'layout');
    redirect(ROUTES.DASHBOARD.MEETINGS_CALENDAR);
  } catch (error) {
    if (error instanceof ServerError) {
      return {
        data: null,
        error: 'Failed to disconnect Google Calendar. Please try again.',
      };
    }

    throw error;
  }
}

/**
 * detachCalendarFromProfile — removes a calendar source without redirecting.
 * Used on the Profile page where navigation should stay on /dashboard/profile.
 * @param sourceId - The numeric ID of the Source to delete.
 * @returns ActionResult.
 */
export async function detachCalendarFromProfile(
  sourceId: number,
): Promise<ActionResult> {
  try {
    await httpClient(`${API_URL}/sources/${sourceId}`, { method: 'DELETE' });

    revalidatePath(ROUTES.DASHBOARD.MEETINGS_CALENDAR, 'layout');
    revalidatePath(ROUTES.DASHBOARD.PROFILE_CALENDAR, 'layout');

    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      return {
        data: null,
        error: 'Failed to disconnect Google Calendar. Please try again.',
      };
    }

    throw error;
  }
}
