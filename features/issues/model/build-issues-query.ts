import { VALID_ISSUE_BACKEND_TYPES } from '@/entities/issue';

import type { IssueFilters } from '@/features/issues/model/types';

export function buildIssuesQuery(filters: IssueFilters = {}) {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);

  if (filters.type === 'task') {
    params.set('exclude_type', 'epic');
  } else if (filters.type && VALID_ISSUE_BACKEND_TYPES.has(filters.type)) {
    params.set('type', filters.type);
  }

  if (filters.assignee) params.set('assignee', String(filters.assignee));

  if (filters.author_id) params.set('author_id', String(filters.author_id));

  if (filters.unassigned) params.set('unassigned', '1');

  if (filters.organization_id)
    params.set('organization_id', String(filters.organization_id));

  if (filters.team_id) params.set('team_id', String(filters.team_id));
  if (filters.epic_id) params.set('epic_id', String(filters.epic_id));
  params.set('offset', String(filters.offset ?? 0));
  params.set('limit', String(filters.limit ?? 10));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);
  if (filters.search) params.set('search', filters.search);
  if (filters.archived) params.set('archived', '1');
  if (filters.exclude_archived) params.set('exclude_archived', '1');

  return params.toString();
}
