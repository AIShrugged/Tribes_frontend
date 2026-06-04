import { cookies } from 'next/headers';

import { getOrganizations } from '@/entities/organization';

import type { OrganizationProps } from '@/entities/organization';

// Intentionally broader than backend's UserRole::MANAGER check.
// Employees are granted agent management access by product decision.
// If this changes, also update AgentProfileController::assertUserCanManageProfiles().
export function canManageAgents(role: string | null | undefined) {
  const normalized = role?.trim().toLowerCase();
  return normalized === 'manager' || normalized === 'employee';
}

/**
 *
 */
export async function getAgentAccessContext(): Promise<{
  organizations: OrganizationProps[];
  managerOrganizations: OrganizationProps[];
  activeOrganization: OrganizationProps | null;
  activeOrganizationId: string;
  canManageAgents: boolean;
}> {
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
  const managerOrganizations = organizations.filter((organization) => {
    return canManageAgents(organization.pivot?.role);
  });

  return {
    organizations,
    managerOrganizations,
    activeOrganization,
    activeOrganizationId,
    canManageAgents: canManageAgents(activeOrganization?.pivot?.role),
  };
}
