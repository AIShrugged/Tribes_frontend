import { PRIORITY_LEVELS } from '@/entities/issue/model/types';

import type {
  EpicOption,
  IssueStatus,
  PersonOption,
  SharedFilters,
} from '@/entities/issue/model/types';
import type { SortOrder } from '@/shared/ui/table/types';

export type {
  IssueStatus,
  EpicOption,
  PersonOption,
  SharedFilters,
  PriorityLevel,
  IssueAuditEvent,
  IssueAuditField,
} from '@/entities/issue/model/types';
export {
  getPriorityLevel,
  PRIORITY_LEVELS,
} from '@/entities/issue/model/types';

export const ISSUE_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'Paused' },
  { value: 'review', label: 'Review' },
  { value: 'reopen', label: 'Reopen' },
  { value: 'done', label: 'Done' },
];

/**
 * isIssueStatus.
 * @param value - raw value.
 * @returns Result.
 */
export function isIssueStatus(value: string): value is IssueStatus {
  return ISSUE_STATUS_OPTIONS.some((option) => {
    return option.value === value;
  });
}

export interface IssueAgentFlowStep {
  id: number;
  position: number;
  kind: string | null;
  status: string | null;
  title: string | null;
  agent_task_id: number | null;
  task: {
    id: number;
    status: string | null;
    latest_run_id: number | null;
  } | null;
}

export interface IssueAgentFlow {
  id: number;
  status: string | null;
  current_step_position: number | null;
  steps: IssueAgentFlowStep[];
}

export interface IssueAgentTaskRun {
  id: number;
  status: string | null;
  current_tool: string | null;
  current_tool_description: string | null;
}

export interface Issue {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: IssueStatus;
  organization_id: number | null;
  team_id: number | null;
  epic_id: number | null;
  epic?: EpicOption | null;
  child_issues?: Issue[] | null;
  agent_task_id?: number | null;
  agent_task_run?: IssueAgentTaskRun | null;
  agent_flow_id?: number | null;
  agent_flow?: IssueAgentFlow | null;
  assignee_id: number | null;
  assignee?: PersonOption | null;
  user_id: number | null;
  author?: PersonOption | null;
  due_date: string | null;
  priority: number;
  close_date: string | null;
  created_at: string;
  updated_at: string;
  attachments?: IssueAttachment[];
}

export interface IssueAttachment {
  id: number;
  issue_id?: number | null;
  upload_token?: string | null;
  name?: string | null;
  file_name?: string | null;
  original_name?: string | null;
  file_path?: string | null;
  file_url?: string | null;
  url?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type IssueSortField =
  | 'id'
  | 'name'
  | 'type'
  | 'status'
  | 'priority'
  | 'due_date'
  | 'updated_at'
  | 'created_at';

// Single source of truth for sort-field validation.
// Import from '@/features/issues' — do NOT redefine locally in consumers.
export const VALID_SORT_FIELDS = new Set<IssueSortField>([
  'id',
  'name',
  'type',
  'status',
  'priority',
  'due_date',
  'updated_at',
  'created_at',
]);

/**
 * isIssueSortField — type guard for IssueSortField.
 * @param value - raw string.
 * @returns boolean.
 */
export function isIssueSortField(value: string): value is IssueSortField {
  return VALID_SORT_FIELDS.has(value as IssueSortField);
}

/**
 * isSortOrder — type guard for SortOrder.
 * @param value - raw string.
 * @returns boolean.
 */
export function isSortOrder(value: string): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

/**
 * isIssueType — accepts any non-empty string since types are org-defined.
 * @param value - raw string.
 * @returns boolean.
 */
export function isIssueType(value: string): boolean {
  return value.length > 0;
}

export interface IssueFilters {
  organization_id?: number | null;
  team_id?: number | null;
  epic_id?: number | null;
  status?: IssueStatus | '';
  type?: string | '';
  assignee?: number | null;
  author_id?: number | null;
  offset?: number;
  limit?: number;
  sort?: IssueSortField;
  order?: SortOrder;
  search?: string;
  archived?: boolean;
  exclude_archived?: boolean;
  unassigned?: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: SharedFilters;
}

export interface IssueCommentUser {
  id: number | null;
  name: string;
}

export interface IssueComment {
  id: number;
  issue_id: number;
  parent_id: number | null;
  content: string;
  user: IssueCommentUser;
  replies: IssueComment[];
  created_at: string;
  updated_at: string;
}

export interface IssueUpsertDTO {
  name: string;
  description: string | null;
  type: string;
  status: IssueStatus;
  organization_id: number | null;
  team_id: number | null;
  epic_id: number | null;
  assignee_id: number | null;
  author_id: number | null;
  due_date: string | null;
  priority: number;
  upload_token?: string | null;
}

export const PRIORITY_OPTIONS: { value: string; label: string }[] =
  PRIORITY_LEVELS.map((level) => {
    return { value: String(level.value), label: level.label };
  });

// ---------------------------------------------------------------------------
// Issue Stats — snapshot from GET /api/v1/issues/stats
// ---------------------------------------------------------------------------

export interface IssueStatsDelta {
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface IssueStats {
  total: number;
  in_progress: number;
  completed: number;
  overdue: number;
  open: number;
  paused: number;
  closed_today: number;
  closed_this_week: number;
  closed_this_month: number;
  closed_all_time: number;
  delta_today: number;
  delta_week: number;
  delta_month: number;
  delta: IssueStatsDelta;
}

// ---------------------------------------------------------------------------
// Issue Stats History — time-series from GET /api/v1/issues/stats/history
// ---------------------------------------------------------------------------

export interface IssueStatsHistoryItem {
  date: string;
  closed: number;
}

export type IssueHistoryPeriod = 'day' | 'week' | 'month';

export interface IssueStatsHistory {
  period: IssueHistoryPeriod;
  range: number;
  items: IssueStatsHistoryItem[];
}

export type CriticalPathStatus = 'pending' | 'computing' | 'ready' | 'failed';
export type CriticalPathEdgeType = 'explicit' | 'implicit' | 'sentinel';

export interface CriticalPathNode {
  node_id: number;
  node_type: 'issue';
  issue_id: number;
  issue_name: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  duration_days: number;
  early_start: number | null;
  early_finish: number | null;
  late_start: number | null;
  late_finish: number | null;
  slack: number | null;
  is_critical: boolean;
}

export interface CriticalPathEdge {
  from_node_id: number;
  to_node_id: number;
  edge_type: CriticalPathEdgeType;
}

export interface CriticalPathGraph {
  graph_id: number;
  team_id: number | null;
  organization_id: number | null;
  status: CriticalPathStatus;
  computed_at: string | null;
  project_duration_days: number;
  nodes: CriticalPathNode[];
  edges: CriticalPathEdge[];
}

export { type SortOrder } from '@/shared/ui/table/types';
