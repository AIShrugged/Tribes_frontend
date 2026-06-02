import { DecisionsPage } from '@/features/decisions';
import { getTeams } from '@/features/teams/api/team';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Decisions' };

/**
 * Organization-scoped decisions for the current organization.
 * Teams are fetched to power the "Add decision" team picker (skipped when the
 * organization has a single team); the decision list itself loads org-wide.
 */
export default async function TodayDecisionsPage() {
  const orgId = await getOrganizationId();

  let teams: { id: number; name: string }[] = [];

  try {
    const result = await getTeams(orgId);
    teams = (result.data ?? []).map((team) => {
      return { id: team.id, name: team.name };
    });
  } catch {
    // Teams only drive the create-modal picker; the org-wide list still loads.
    teams = [];
  }

  return (
    <div className='p-6'>
      <DecisionsPage organizationId={orgId} teams={teams} />
    </div>
  );
}
