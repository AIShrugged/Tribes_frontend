'use server';

import { revalidatePath } from 'next/cache';

import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient, httpClientList } from '@/shared/lib/httpClient';

import type {
  TeamAddMemberDTO,
  TeamCreateDTO,
  TeamInvite,
  TeamProps,
  TeamUserRecord,
} from '@/entities/team';
import type { ActionResult } from '@/shared/types/server-action';

// ------------------------------
// Teams API
// ------------------------------
/**
 * getTeams.
 * @param organizationId - organizationId.
 * @returns Promise.
 */
export const getTeams = async (organizationId: number | string) => {
  return httpClientList<TeamProps>(
    `${API_URL}/organizations/${organizationId}/teams?limit=100`,
  );
};

/**
 * getTeam.
 * @param teamId - teamId.
 * @returns Promise.
 */
export const getTeam = async (teamId: string) => {
  return httpClient<TeamProps>(`${API_URL}/teams/${teamId}`);
};

/**
 * deleteTeam.
 * @param teamId - teamId.
 * @returns Promise.
 */
export async function deleteTeam(teamId: number): Promise<ActionResult<void>> {
  try {
    await httpClient<void>(`${API_URL}/teams/${teamId}`, { method: 'DELETE' });
    revalidatePath('/dashboard/teams');
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to delete team',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}

// ------------------------------
// Create / Update
// ------------------------------
/**
 * createTeam.
 * @param organizationId - organizationId.
 * @param data - data.
 * @returns Promise.
 */
export async function createTeam(
  organizationId: string,
  data: TeamCreateDTO,
): Promise<ActionResult<TeamProps>> {
  try {
    const { data: team } = await httpClient<TeamProps>(`${API_URL}/teams`, {
      method: 'POST',
      body: JSON.stringify({ organization_id: organizationId, ...data }),
      headers: { 'Content-Type': 'application/json' },
    });
    revalidatePath('/dashboard/teams');
    return { data: team ?? null, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to create team',
      );
      return { data: null, error: parsed.message, fieldErrors: parsed.fieldErrors };
    }
    throw error;
  }
}

/**
 * updateTeam.
 * @param id - id.
 * @param data - data.
 * @returns Promise.
 */
export async function updateTeam(id: number, data: TeamCreateDTO) {
  await httpClient<TeamProps>(`${API_URL}/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  });

  revalidatePath('/dashboard/teams');
}

/**
 * getTeamUsers — list team members as TeamUser pivot records (includes team_user id needed for kick).
 * @param teamId - teamId.
 * @returns Promise.
 */
export const getTeamUsers = async (
  teamId: number | string,
): Promise<TeamUserRecord[]> => {
  const { data } = await httpClient<TeamUserRecord[]>(
    `${API_URL}/teams/${teamId}/users`,
  );

  return data ?? [];
};

/**
 * kickTeamMember — remove a user from a team by their user id.
 * Resolves the TeamUser pivot record internally.
 * @param teamId - team id.
 * @param userId - User.id (from team.members).
 * @returns Promise with ActionResult.
 */
export async function kickTeamMember(
  teamId: number | string,
  userId: number | string,
): Promise<{ error: string | null }> {
  try {
    const teamUsers = await getTeamUsers(teamId);
    const teamUser = teamUsers.find((tu) => {
      return tu.user.id === Number(userId);
    });

    if (!teamUser) {
      return { error: 'Member not found in team' };
    }

    await httpClient(`${API_URL}/teams/${teamId}/users/${teamUser.id}/kick`, {
      method: 'POST',
    });
    revalidatePath('/dashboard/teams');

    return { error: null };
  } catch (error) {
    return {
      error: (error as Error).message ?? 'Failed to remove member',
    };
  }
}

/**
 * sendInvite.
 * @param teamId - teamId.
 * @param data - data.
 * @returns Promise.
 */
export async function sendInvite(
  teamId: number,
  data: TeamAddMemberDTO,
): Promise<ActionResult<{ id: number; email: string; status: string }>> {
  try {
    const { data: invite } = await httpClient<{
      id: number;
      email: string;
      status: string;
    }>(`${API_URL}/teams/${teamId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    revalidatePath('/dashboard/teams');

    return {
      data: invite ?? { id: 0, email: data.email, status: 'pending' },
      error: null,
    };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to send invite',
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
 * getTeamInvites — list all invitations for a team (manager-only).
 * @param teamId - teamId.
 * @returns Promise with list of TeamInvite.
 */
export async function getTeamInvites(
  teamId: number | string,
): Promise<TeamInvite[]> {
  const { data } = await httpClientList<TeamInvite>(
    `${API_URL}/teams/${teamId}/invites`,
  );

  return data ?? [];
}

/**
 * cancelTeamInvite — cancel a pending invitation.
 * @param teamId - teamId.
 * @param inviteId - inviteId.
 * @returns Promise with ActionResult.
 */
export async function cancelTeamInvite(
  teamId: number | string,
  inviteId: number,
): Promise<ActionResult<void>> {
  try {
    await httpClient(`${API_URL}/teams/${teamId}/invites/${inviteId}`, {
      method: 'DELETE',
    });

    revalidatePath('/dashboard/teams');

    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to cancel invite',
      );

      return { data: null, error: parsed.message };
    }

    throw error;
  }
}
