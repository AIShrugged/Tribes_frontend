import { FileText } from 'lucide-react';

import { EmptyState } from '@/shared/ui/feedback/empty-state';

/**
 * OrganizationDescriptionTab — read-only view of the organization description
 * captured during onboarding (the `context` field). Falls back to an empty
 * state when no description has been set.
 * @param props - Component props.
 * @param props.context - The organization description, if any.
 */
export function OrganizationDescriptionTab({
  context,
}: {
  context?: string | null;
}) {
  const description = context?.trim();

  if (!description) {
    return (
      <EmptyState
        icon={FileText}
        title='No description yet'
        description='This organization has no description. It is set during onboarding.'
      />
    );
  }

  return (
    <p className='max-w-3xl whitespace-pre-wrap break-words text-[length:var(--fs-sm)] leading-relaxed text-[var(--foreground)]'>
      {description}
    </p>
  );
}
