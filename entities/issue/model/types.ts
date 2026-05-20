export type IssueStatus =
  | 'open'
  | 'in_progress'
  | 'paused'
  | 'review'
  | 'reopen'
  | 'done';

export interface EpicOption {
  id: number;
  name: string;
  status: IssueStatus;
}

export interface PersonOption {
  id: number;
  name: string;
  email?: string | null;
}

export interface SharedFilters {
  organization_id: string;
  team_id: string;
  search: string;
  type: string | '';
  assignee_id: string;
  author_id: string;
  epic_id: string;
  status: IssueStatus | '';
  show_archived: boolean;
}

export type IssueAuditField =
  | 'name'
  | 'description'
  | 'status'
  | 'type'
  | 'assignee_id'
  | 'due_date'
  | 'priority'
  | 'epic_id'
  | 'team_id'
  | 'organization_id'
  | (string & {});

export interface IssueAuditEvent {
  id: number;
  field: IssueAuditField;
  old_value: string | null;
  new_value: string | null;
  user: PersonOption;
  created_at: string;
}

export const VALID_ISSUE_BACKEND_TYPES = new Set(['epic', 'development', 'organization']);

export const PRIORITY_LEVELS = [
  { value: 500, label: 'Critical', color: 'text-red-500' },
  { value: 100, label: 'High', color: 'text-orange-400' },
  { value: 0, label: 'Normal', color: 'text-foreground' },
  { value: -100, label: 'Low', color: 'text-blue-400' },
  { value: -500, label: 'Minimal', color: 'text-muted-foreground' },
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export function getPriorityLevel(priority: number): PriorityLevel {
  return (
    [...PRIORITY_LEVELS].find((level) => {
      return priority >= level.value;
    }) ?? PRIORITY_LEVELS.at(-1)!
  );
}
