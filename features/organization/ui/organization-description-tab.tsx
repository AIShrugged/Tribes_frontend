import { Building2, FileText } from 'lucide-react';

import { EmptyState } from '@/shared/ui/feedback/empty-state';

/**
 * OrganizationDescriptionTab — read-only "About" card for the organization
 * description captured during onboarding (the `context` field). Falls back to
 * an empty state when no description has been set.
 * @param props - Component props.
 * @param props.name - Organization name, shown as the card heading.
 * @param props.context - The organization description, if any.
 */
export function OrganizationDescriptionTab({
  name,
  context,
}: {
  name?: string;
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

  const paragraphs = description
    .split(/\n{2,}/)
    .map((paragraph) => {
      return paragraph.trim();
    })
    .filter(Boolean);

  return (
    <div className='mx-auto w-full max-w-2xl'>
      <article className='relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-[var(--shadow-sm)]'>
        {/* Top hairline accent in the brand violet */}
        <span
          aria-hidden
          className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent'
        />

        <header className='flex items-center gap-3 px-6 pt-6'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'>
            <Building2 className='h-[18px] w-[18px]' />
          </div>
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-[length:var(--fs-xxs)] font-semibold uppercase tracking-wider text-muted-foreground'>
              About
            </span>
            {name ? (
              <h2 className='truncate text-[length:var(--fs-lg)] font-semibold leading-tight text-foreground'>
                {name}
              </h2>
            ) : null}
          </div>
        </header>

        <div className='flex flex-col gap-4 px-6 pt-5'>
          {paragraphs.map((paragraph, index) => {
            return (
              <p
                key={index}
                className='whitespace-pre-wrap break-words text-pretty text-[length:var(--fs-md)] leading-relaxed text-foreground'
              >
                {paragraph}
              </p>
            );
          })}
        </div>

        <footer className='mt-5 border-t border-border/60 px-6 py-3'>
          <span className='text-[length:var(--fs-xs)] text-muted-foreground'>
            Set during onboarding
          </span>
        </footer>
      </article>
    </div>
  );
}
