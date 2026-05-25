import type { OrganizationProps } from '@/entities/organization';

/**
 * isOrgManager — returns true only for the 'manager' role.
 * Intentionally stricter than canManageAgents (which also allows 'employee').
 * @param activeOrganization - The currently active organization with pivot data.
 * @returns boolean.
 */
export function isOrgManager(
  activeOrganization: OrganizationProps | null,
): boolean {
  return activeOrganization?.pivot?.role?.trim().toLowerCase() === 'manager';
}
