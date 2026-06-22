import { cookies } from 'next/headers';

import { getOrganizations } from '@/entities/organization';

import type { OrganizationProps } from '@/entities/organization';
import type { BrainOrgOption } from '@/features/brain/model/types';

/**
 * The second-brain endpoints are strictly manager-only — the backend gates on
 * `wherePivot('role', 'manager')` (BrainSuggestionController::managedOrganizationIds).
 * Mirror that here so the locked state matches the API's authorization.
 * @param role - the user's pivot role on an organization.
 */
export function canManageBrain(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === 'manager';
}

export interface BrainAccessContext {
  /** Whether the active organization is one the user manages. */
  canManageBrain: boolean;
  /** All organizations the user manages — used for the optional org filter. */
  managerOrganizations: BrainOrgOption[];
}

/**
 * Resolves brain access for the current request: whether the active org is
 * managed, plus the list of managed orgs for the optional organization filter.
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
  const managerOrganizations = organizations
    .filter((organization: OrganizationProps) => {
      return canManageBrain(organization.pivot?.role);
    })
    .map((organization): BrainOrgOption => {
      return {
        id: organization.id,
        name: organization.name,
      };
    });

  // Access is granted when the active org is managed; if the active org is not
  // managed but the user manages others, the backend still serves their data,
  // so fall back to "manages any" to avoid a false lock.
  const manages =
    canManageBrain(activeOrganization?.pivot?.role) ||
    managerOrganizations.length > 0;

  return {
    canManageBrain: manages,
    managerOrganizations,
  };
}
