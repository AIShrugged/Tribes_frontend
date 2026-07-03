import { cookies } from 'next/headers';

import { getOrganizations } from '@/entities/organization';

import type { BrainOrgOption } from '@/features/brain/model/types';

/**
 * The second-brain endpoints are strictly manager-only — the backend gates on
 * `wherePivot('role', 'manager')`. Mirror that here so the locked state matches
 * the API's authorization.
 * @param role - the user's pivot role on an organization.
 */
export function canManageBrain(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === 'manager';
}

export interface BrainAccessContext {
  /**
   * The organization currently selected in the org switcher (from the
   * `organization_id` cookie), or null when none is active.
   */
  activeOrganization: BrainOrgOption | null;
  /** Whether the current user manages the ACTIVE organization. */
  canManageBrain: boolean;
}

/**
 * Resolves brain access for the current request. The second brain is scoped to
 * the active organization only: it returns that org and whether the user
 * manages it — every brain tab shows data for this org alone, no org picker.
 */
export async function getBrainAccessContext(): Promise<BrainAccessContext> {
  const [organizationsResponse, cookieStore] = await Promise.all([
    getOrganizations(),
    cookies(),
  ]);
  const organizations = organizationsResponse.data ?? [];
  const activeOrganizationId = cookieStore.get('organization_id')?.value ?? '';
  const activeOrganization =
    organizations.find((organization) => {
      return String(organization.id) === activeOrganizationId;
    }) ?? null;

  return {
    activeOrganization: activeOrganization
      ? { id: activeOrganization.id, name: activeOrganization.name }
      : null,
    canManageBrain: canManageBrain(activeOrganization?.pivot?.role),
  };
}
