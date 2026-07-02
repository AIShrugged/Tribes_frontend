import type { IssueFilters } from '@/features/issues/model/types';

export function buildIssuesQuery(filters: IssueFilters = {}) {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);

  if (filters.type) {
    params.set('type', filters.type === 'task' ? 'organization' : filters.type);
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
  if (filters.code) params.set('code', filters.code);
  if (filters.archived) params.set('archived', '1');
  if (filters.exclude_archived) params.set('exclude_archived', '1');
  if (filters.overdue) params.set('overdue', '1');
  if (filters.due_date_from) params.set('due_date_from', filters.due_date_from);
  if (filters.due_date_to) params.set('due_date_to', filters.due_date_to);
  if (filters.blocked) params.set('blocked', '1');
  if (filters.exclude_statuses?.length) {
    for (const s of filters.exclude_statuses)
      params.append('exclude_statuses[]', s);
  }

  return params.toString();
}
