import {
  getOrganization,
  OrganizationPeopleTab,
  OrganizationTabsNav,
} from '@/features/organization';
import { getTeamDashboard, getTeamInvites, getTeams } from '@/features/teams';
import { Card, CardBody } from '@/shared/ui/card';
import PageHeader from '@/widgets/layout/ui/page-header';

import type { TeamInvite, TeamMember, TeamProps } from '@/entities/team';
import type { TabPeople } from '@/features/teams/model/dashboard-types';
import type { PageProps } from '@/shared/types/common';

interface OrganizationMember extends TeamMember {
  teamNames: string[];
}

function getOrganizationMembers(teams: TeamProps[]): OrganizationMember[] {
  const defaultTeam = teams.find((team) => {
    return team.is_default;
  });

  if (defaultTeam) {
    return (defaultTeam.members ?? []).map((member) => {
      return { ...member, teamNames: [] };
    });
  }

  const members = new Map<number, OrganizationMember>();

  for (const team of teams) {
    for (const member of team.members ?? []) {
      const existing = members.get(member.id);

      if (existing) {
        existing.teamNames.push(team.name);
      } else {
        members.set(member.id, { ...member, teamNames: [team.name] });
      }
    }
  }

  return [...members.values()].toSorted((a, b) => {
    return a.name.localeCompare(b.name);
  });
}

async function getDefaultTeamPeopleData(
  defaultTeamId: number | null,
  isManager: boolean,
): Promise<{ analyticsData: TabPeople | null; pendingInvites: TeamInvite[] }> {
  if (defaultTeamId === null) {
    return { analyticsData: null, pendingInvites: [] };
  }

  const [dashboardResult, invitesResult] = await Promise.allSettled([
    getTeamDashboard(String(defaultTeamId)),
    isManager ? getTeamInvites(defaultTeamId) : Promise.resolve([]),
  ]);

  return {
    analyticsData:
      dashboardResult.status === 'fulfilled'
        ? (dashboardResult.value.data?.tabs.people ?? null)
        : null,
    pendingInvites:
      invitesResult.status === 'fulfilled' ? invitesResult.value : [],
  };
}

/**
 * Organization People page.
 * @param props - Component props.
 * @param props.params
 */
export default async function OrganizationPeoplePage({ params }: PageProps) {
  const { id } = await params;
  const { data: organization } = await getOrganization(id);

  if (!organization) return null;

  const { data: teams = [] } = await getTeams(organization.id);
  const defaultTeam =
    teams.find((team) => {
      return team.is_default;
    }) ?? null;
  const defaultTeamId = defaultTeam?.id ?? null;
  const isManager = organization.pivot?.role === 'manager';
  const { analyticsData, pendingInvites } = await getDefaultTeamPeopleData(
    defaultTeamId,
    isManager,
  );

  return (
    <Card className='h-full flex flex-col'>
      <PageHeader hasButtonBack title='Organization' />
      <div className='px-6'>
        <OrganizationTabsNav organizationId={organization.id} />
      </div>
      <CardBody>
        <OrganizationPeopleTab
          analyticsData={analyticsData}
          members={getOrganizationMembers(teams)}
          pendingInvites={pendingInvites}
          defaultTeamId={defaultTeamId}
          isManager={isManager}
        />
      </CardBody>
    </Card>
  );
}
