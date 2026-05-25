import { notFound } from 'next/navigation';

import { getAgentAccessContext } from '@/features/agents/lib/access';
import { isOrgManager } from '@/features/llm-prompts/lib/access';
import { getLlmPromptData } from '@/features/llm-prompts/lib/llm-prompt-data';
import { LlmPromptForm } from '@/features/llm-prompts/ui/llm-prompt-form';

import type { PageProps } from '@/shared/types/common';

/**
 * LlmPromptEditPage — Server Component for the prompt edit/detail page.
 * Accessible to all org members (read-only for non-managers).
 * Returns 404 if the prompt does not exist.
 * @param root0 - Next.js page props.
 * @param root0.params - Route params containing the prompt id.
 * @returns Promise resolving to JSX element.
 */
export default async function LlmPromptEditPage({ params }: PageProps) {
  const { id } = await params;
  const promptId = Number(id);

  if (!Number.isFinite(promptId) || promptId <= 0) {
    notFound();
  }

  const ctx = await getAgentAccessContext();
  const canEdit = isOrgManager(ctx.activeOrganization);
  const organizationId = Number(ctx.activeOrganizationId);

  const prompt = await getLlmPromptData(organizationId, promptId);

  if (!prompt) {
    notFound();
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-6'>
      <LlmPromptForm
        prompt={prompt}
        canEdit={canEdit}
        organizationId={organizationId}
      />
    </div>
  );
}
