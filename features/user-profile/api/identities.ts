'use server';

import { revalidatePath } from 'next/cache';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';
import { ROUTES } from '@/shared/lib/routes';

import type { ProfileIdentity } from '@/entities/user';
import type { ActionResult } from '@/shared/types/server-action';

export async function getIdentities(): Promise<ProfileIdentity[]> {
  const { data } = await httpClient<ProfileIdentity[]>(
    `${API_URL}/users/me/identities`,
  );
  return data ?? [];
}

function unlinkErrorMessage(status: number | undefined): string {
  if (status === 403) return 'Not authorized to unlink this account';
  if (status === 404) return 'This account was already unlinked';
  return 'Failed to unlink account';
}

export async function unlinkIdentity(
  profileId: number,
): Promise<ActionResult<void>> {
  if (!Number.isInteger(profileId) || profileId <= 0) {
    return { data: null, error: 'Invalid identity ID' };
  }
  try {
    await httpClient<null>(`${API_URL}/users/me/identities/${profileId}`, {
      method: 'DELETE',
    });
    revalidatePath(ROUTES.DASHBOARD.PROFILE_INTEGRATIONS);
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      return { data: null, error: unlinkErrorMessage(error.status) };
    }
    throw error;
  }
}
