import { format, formatDistanceStrict, parseISO } from 'date-fns';

import type {
  AgentSelectOption,
  AgentTask,
  AgentTaskOrganization,
  AgentTaskRun,
  AgentTaskTeam,
  AgentToolDefinition,
} from '@/features/agents/model/types';

/**
 *
 * @param value
 */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';

  try {
    return format(parseISO(value), 'dd.MM.yyyy HH:mm');
  } catch {
    return value;
  }
}

/**
 *
 * @param run
 */
export function formatDuration(run: AgentTaskRun) {
  if (!run.started_at || !run.finished_at) return '—';

  try {
    return formatDistanceStrict(
      parseISO(run.started_at),
      parseISO(run.finished_at),
    );
  } catch {
    return '—';
  }
}

/**
 *
 * @param value
 */
export function formatBooleanLabel(value: boolean) {
  return value ? 'Enabled' : 'Disabled';
}

/**
 *
 * @param organization
 * @param organizationId
 */
export function getOrganizationLabel(
  organization: AgentTaskOrganization | null | undefined,
  organizationId: number | null | undefined,
) {
  if (organization?.display_name) return organization.display_name;

  if (organization?.name) return organization.name;

  if (organizationId) return `Org #${organizationId}`;

  return '—';
}

/**
 *
 * @param team
 * @param teamId
 */
export function getTeamLabel(
  team: AgentTaskTeam | null | undefined,
  teamId: number | null | undefined,
) {
  if (team?.name) return team.name;

  if (teamId) return `Team #${teamId}`;

  return '—';
}

/**
 *
 * @param task
 */
export function getLatestRunStatus(task: AgentTask) {
  const value =
    task.latest_run_status ??
    (task.latest_run as { status?: string } | undefined)?.status ??
    null;

  return value ?? '—';
}

/**
 *
 * @param tools
 */
export function normalizeToolOptions(
  tools: Array<AgentToolDefinition | string>,
): AgentSelectOption[] {
  return tools
    .map((tool) => {
      if (typeof tool === 'string') {
        return {
          value: tool,
          label: tool,
          description: null,
        };
      }

      return {
        value: tool.name,
        label: tool.label?.trim() || tool.name,
        description:
          typeof tool.description === 'string' ? tool.description : null,
      };
    })
    .filter((tool) => {
      return Boolean(tool.value);
    });
}

export function normalizeAllowedTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => {return typeof item === 'string'});
  }

  return [];
}

/**
 *
 * @param input
 */
export function normalizeMetaOptions(input: unknown): AgentSelectOption[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (typeof item === 'string') {
        return {
          value: item,
          label: item,
        };
      }

      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const value = record.value ?? record.name ?? record.key ?? record.id;

      if (typeof value !== 'string' && typeof value !== 'number') return null;

      return {
        value: String(value),
        label:
          (typeof record.label === 'string' && record.label) ||
          (typeof record.name === 'string' && record.name) ||
          String(value),
        description:
          typeof record.description === 'string' ? record.description : null,
      };
    })
    .filter(Boolean) as AgentSelectOption[];
}

/**
 *
 * @param run
 */
export function getToolCalls(run: AgentTaskRun) {
  const metadata = run.metadata ?? {};
  const toolCalls = metadata.tool_calls;

  return Array.isArray(toolCalls) ? toolCalls : [];
}

/**
 *
 * @param run
 */
export function getSandboxResult(run: AgentTaskRun) {
  return run.metadata?.sandbox_result ?? null;
}

/**
 *
 * @param run
 */
export function getPlanOrHandoff(run: AgentTaskRun) {
  return {
    plan: run.plan ?? run.metadata?.plan ?? null,
    handoff: run.handoff ?? run.metadata?.handoff ?? null,
    lineage: run.lineage ?? run.metadata?.lineage ?? run.followup ?? null,
  };
}
