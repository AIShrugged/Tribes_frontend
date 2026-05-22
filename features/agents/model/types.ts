export type AgentRunStatus =
  | 'queued'
  | 'processing'
  | 'running'
  | 'completed'
  | 'success'
  | 'failed'
  | 'error';

export const AGENT_EXECUTION_MODES = ['inline', 'isolated', 'paperclip'] as const;
export type AgentExecutionMode = (typeof AGENT_EXECUTION_MODES)[number];

export interface AgentToolDefinition {
  name: string;
  label?: string | null;
  description?: string | null;
}

export interface AgentProfile {
  id: number;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;
  sandbox_profile: string | null;
  allowed_tools: string[] | null;
  allowed_outbound_hosts: string[] | null;
  default_model: string | null;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentProfilePayload {
  key: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  config_schema: Record<string, unknown> | null;
  task_payload_schema: Record<string, unknown> | null;
  execution_mode: AgentExecutionMode | null;
  sandbox_profile: string | null;
  allowed_tools: string[];
  allowed_outbound_hosts: string[];
  default_model: string | null;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
}

export interface AgentMemory {
  id: number;
  agent_profile_id: number;
  profile: { id: number; key: string; name: string } | null;
  scope_type: string | null;
  scope_key: string | null;
  kind: string | null;
  priority: number | null;
  active: boolean;
  content: string | null;
  last_seen_at: string | null;
  source_task_id: number | null;
  source_run_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentTaskOrganization {
  id: number;
  name?: string | null;
  slug?: string | null;
  display_name?: string | null;
}

export interface AgentTaskTeam {
  id: number;
  name?: string | null;
}

export interface AgentTask {
  id: number;
  name: string;
  prompt: string | null;
  organization_id: number | null;
  team_id: number | null;
  agent_profile_id: number | null;
  schedule_type: string | null;
  interval_seconds: number | null;
  execution_mode: AgentExecutionMode | null;
  agent_task_type: string | null;
  output_mode: string | null;
  allowed_tools: string[] | null;
  input_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  enabled: boolean;
  next_run_at: string | null;
  latest_run_status?: AgentRunStatus | null;
  latest_run?: AgentTaskLatestRun | null;
  organization?: AgentTaskOrganization | null;
  team?: AgentTaskTeam | null;
  agent_profile?: Pick<AgentProfile, 'id' | 'name'> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTaskPayload {
  name: string;
  prompt: string | null;
  organization_id: number;
  team_id: number | null;
  agent_profile_id: number;
  schedule_type: string;
  interval_seconds: number | null;
  execution_mode: string;
  agent_task_type: string;
  output_mode: string | null;
  allowed_tools: string[];
  input_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  enabled: boolean;
}

export interface AgentTaskRun {
  id: number;
  status: AgentRunStatus | null;
  attempt: number | null;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  output: unknown;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  handoff?: unknown;
  plan?: unknown;
  lineage?: unknown;
  followup?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AgentTasksMeta {
  execution_modes?: unknown;
  schedule_types?: unknown;
  agent_task_types?: unknown;
  output_modes?: unknown;
  sandbox_profiles?: unknown;
}

export interface AgentActivityItem {
  id: number;
  tool_name: string;
  description: string;
  success: boolean;
  agent_run_uuid: string | null;
  created_at: string;
}

export interface AgentTaskActivityItem {
  id: number;
  tool_name: string;
  description: string;
  tool_result: Record<string, unknown> | null;
  success: boolean;
  created_at: string;
}

export interface AgentTaskLatestRun {
  id: number;
  paperclip_issue_id: number | null;
  status: AgentRunStatus | null;
  attempt: number;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  metadata: {
    sandbox_result: unknown;
    sandbox: unknown;
    tool_calls: unknown[];
    llm_calls: unknown[];
  };
  activity: AgentTaskActivityItem[] | null;
}

export interface AgentSelectOption {
  value: string;
  label: string;
  description?: string | null;
}
