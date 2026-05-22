import { getPersons, isIssueType, IssuesKanbanTab } from '@/features/issues';
import { getKanbanIssues } from '@/features/kanban';
import { getOrganizations } from '@/features/organization';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

import type { KanbanFilters } from '@/features/kanban';

export const metadata = { title: 'Kanban' };

export default async function IssuesKanbanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieOrgId = await getOrganizationId();
  const orgId =
    typeof params.organization_id === 'string'
      ? params.organization_id
      : cookieOrgId;

  const typeParam =
    typeof params.type === 'string' && isIssueType(params.type)
      ? params.type
      : '';
  const assigneeIdParam =
    typeof params.assignee_id === 'string' ? params.assignee_id : null;
  const isUnassigned = assigneeIdParam === 'unassigned';

  const rawOrgId = Number(orgId);
  const rawTeamId =
    typeof params.team_id === 'string' ? Number(params.team_id) : null;
  const rawAssigneeId =
    assigneeIdParam && !isUnassigned ? Number(assigneeIdParam) : null;
  const rawAuthorId =
    typeof params.author_id === 'string' ? Number(params.author_id) : null;
  const rawEpicId =
    typeof params.epic_id === 'string' ? Number(params.epic_id) : null;

  const kanbanFilters: KanbanFilters = {
    organization_id:
      Number.isFinite(rawOrgId) && rawOrgId > 0 ? rawOrgId : null,
    team_id:
      rawTeamId !== null && Number.isFinite(rawTeamId) && rawTeamId > 0
        ? rawTeamId
        : null,
    type: typeParam || undefined,
    assignee_id:
      rawAssigneeId !== null && Number.isFinite(rawAssigneeId)
        ? rawAssigneeId
        : null,
    author_id:
      rawAuthorId !== null && Number.isFinite(rawAuthorId) && rawAuthorId > 0
        ? rawAuthorId
        : null,
    epic_id:
      rawEpicId !== null && Number.isFinite(rawEpicId) && rawEpicId > 0
        ? rawEpicId
        : null,
    unassigned: isUnassigned,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  const [organizationsResponse, persons, kanbanResult] = await Promise.all([
    getOrganizations(),
    getPersons(),
    getKanbanIssues(kanbanFilters),
  ]);

  return (
    <IssuesKanbanTab
      initialResult={kanbanResult}
      organizations={organizationsResponse.data ?? []}
      persons={persons}
    />
  );
}
