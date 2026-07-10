'use client';

import { RefreshCw } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';

/** Header "Пересобрать" control — regenerates a done artifact (manager-only). */
export function RegenerateButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={busy}
      className='inline-flex items-center gap-1.5 rounded-[var(--radius-button)] px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--secondary)] hover:text-foreground disabled:cursor-wait disabled:opacity-60'
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
      Пересобрать
    </button>
  );
}

type Props = PropsWithChildren<{
  /** Section heading (e.g. "Протокол"). */
  label: string;
  labelIcon: LucideIcon;
  /** Optional control rendered on the right of the header (e.g. regenerate). */
  headerAction?: ReactNode;
}>;

/**
 * Card shell shared by the protocol and agenda sections: an uppercase label with
 * an optional header control, and the section body. The body itself (real
 * content, draft preview, or fallback state) is composed by the caller.
 * @param root0 - props.
 * @param root0.label - section heading.
 * @param root0.labelIcon - heading icon.
 * @param root0.headerAction - optional right-aligned header control.
 * @param root0.children - section body.
 */
export function MeetingArtifactSection({
  label,
  labelIcon: LabelIcon,
  headerAction,
  children,
}: Props) {
  return (
    <section className='rounded-[var(--radius-card)] border border-border bg-card px-5 py-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          <LabelIcon className='h-3.5 w-3.5' />
          {label}
        </div>
        {headerAction}
      </div>

      <div className='mt-4'>{children}</div>
    </section>
  );
}
