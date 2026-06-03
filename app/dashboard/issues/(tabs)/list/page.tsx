import {
  getIssues,
  getPersons,
  isIssueStatus,
  isIssueSortField,
  isSortOrder,
  isIssueType,
  IssuesListTab,
} from '@/features/issues';
import { getCurrentUserId } from '@/shared/lib/getCurrentUserId';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

export const metadata = { title: 'Tasktracker' };

export default async function IssuesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieOrgId = await getOrganizationId();

  const statusParam =
    typeof params.status === 'string' && isIssueStatus(params.status)
      ? params.status
      : '';
  const sortParam =
    typeof params.sort === 'string' && isIssueSortField(params.sort)
      ? params.sort
      : 'created_at';
  const orderParam =
    typeof params.order === 'string' && isSortOrder(params.order)
      ? params.order
      : 'desc';
  const typeParam =
    typeof params.type === 'string' && isIssueType(params.type)
      ? params.type
      : '';
  let assigneeIdParam: string | null;
  if (!('assignee_id' in params)) {
    assigneeIdParam = null;
  } else if (typeof params.assignee_id === 'string') {
    assigneeIdParam = params.assignee_id;
  } else {
    assigneeIdParam = '';
  }

  const [persons, currentUserId] = await Promise.all([
    getPersons(cookieOrgId),
    getCurrentUserId(),
  ]);

  const isUnassigned = assigneeIdParam === 'unassigned';
  let resolvedAssignee: number | null;
  if (assigneeIdParam === null) {
    resolvedAssignee = currentUserId ?? null;
  } else if (assigneeIdParam.length > 0 && !isUnassigned) {
    const rawAssigneeId = Number(assigneeIdParam);
    resolvedAssignee = Number.isFinite(rawAssigneeId) ? rawAssigneeId : null;
  } else {
    resolvedAssignee = null;
  }

  const rawAuthorId =
    typeof params.author_id === 'string' ? Number(params.author_id) : null;
  const rawEpicId =
    typeof params.epic_id === 'string' ? Number(params.epic_id) : null;

  const issues = await getIssues({
    organization_id: cookieOrgId,
    team_id: null,
    status: statusParam,
    type: typeParam,
    assignee: resolvedAssignee,
    author_id:
      rawAuthorId !== null && Number.isFinite(rawAuthorId) && rawAuthorId > 0
        ? rawAuthorId
        : null,
    epic_id:
      rawEpicId !== null && Number.isFinite(rawEpicId) && rawEpicId > 0
        ? rawEpicId
        : null,
    unassigned: isUnassigned,
    offset: 0,
    limit: 20,
    sort: sortParam,
    order: orderParam,
    search:
      typeof params.search === 'string' && params.search.length > 0
        ? params.search
        : undefined,
  });

  return (
    <div className='flex flex-col gap-4'>
      <IssuesListTab
        initialIssues={issues.data}
        initialTotalCount={issues.totalCount}
        persons={persons}
      />
    </div>
  );
}
