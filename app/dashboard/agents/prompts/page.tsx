import { getAgentAccessContext } from '@/features/agents/lib/access';
import { isOrgManager } from '@/features/llm-prompts/lib/access';
import { getLlmPrompts } from '@/features/llm-prompts/lib/llm-prompt-data';
import { LlmPromptsList } from '@/features/llm-prompts/ui/llm-prompts-list';

/**
 * LlmPromptsPage — Server Component list page for LLM prompt templates.
 * Fetches all prompts (limit=50) in a single request.
 * Access control: all org members can read; canEdit=true only for managers.
 * @returns Promise resolving to JSX element.
 */
export default async function LlmPromptsPage() {
  const ctx = await getAgentAccessContext();
  const canEdit = isOrgManager(ctx.activeOrganization);
  const organizationId = Number(ctx.activeOrganizationId);

  const { data: prompts } = await getLlmPrompts(organizationId, {
    offset: 0,
    limit: 50,
  });

  return (
    <LlmPromptsList
      prompts={prompts}
      canEdit={canEdit}
      organizationId={organizationId}
    />
  );
}
