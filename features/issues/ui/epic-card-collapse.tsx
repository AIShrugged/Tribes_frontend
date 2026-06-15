'use client';

import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

import type { PropsWithChildren, ReactNode } from 'react';

/**
 * EpicCardCollapse — client wrapper owning the chevron toggle and collapse state
 * for one epic card. The server-rendered header is passed as `header`; the
 * streamed body (progress + task list) is passed as `children`. Per-card
 * streaming is unaffected — the Suspense inside `children` resolves once, then
 * the toggle is pure show/hide.
 * @param props - Component props.
 * @param props.header - server-rendered card header.
 * @param props.children - collapsible body (streamed).
 * @param props.defaultOpen - initial open state (defaults to true).
 * @returns JSX element.
 */
export function EpicCardCollapse({
  header,
  children,
  defaultOpen = true,
}: PropsWithChildren<{
  header: ReactNode;
  defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <>
      <div className='flex items-start gap-2 px-4 py-3'>
        <button
          type='button'
          onClick={() => {
            return setOpen((v) => {
              return !v;
            });
          }}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? 'Collapse tasks' : 'Expand tasks'}
          className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors'
        >
          <ChevronRight
            className={clsx(
              'h-4 w-4 transition-transform',
              open && 'rotate-90',
            )}
          />
        </button>
        <div className='min-w-0 flex-1'>{header}</div>
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </>
  );
}
