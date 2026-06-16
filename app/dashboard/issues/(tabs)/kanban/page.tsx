import { isIssueType, IssuesKanbanTab } from '@/features/issues';
import { getKanbanIssues } from '@/features/kanban';
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

  const typeParam =
    typeof params.type === 'string' && isIssueType(params.type)
      ? params.type
      : '';
  const assigneeIdParam =
    typeof params.assignee_id === 'string' ? params.assignee_id : null;
  const isUnassigned = assigneeIdParam === 'unassigned';

  const rawAssigneeId =
    assigneeIdParam && !isUnassigned ? Number(assigneeIdParam) : null;
  const rawAuthorId =
    typeof params.author_id === 'string' ? Number(params.author_id) : null;
  const rawEpicId =
    typeof params.epic_id === 'string' ? Number(params.epic_id) : null;

  const kanbanFilters: KanbanFilters = {
    organization_id: cookieOrgId,
    team_id: null,
    type: typeParam === 'task' ? undefined : typeParam || undefined,
    exclude_types: typeParam === 'task' ? ['epic'] : undefined,
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

  const kanbanResult = await getKanbanIssues(kanbanFilters);

  return <IssuesKanbanTab initialResult={kanbanResult} />;
}
