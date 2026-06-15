'use client';

import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

import type { PropsWithChildren, ReactNode } from 'react';

/**
 * EpicCardCollapse — client wrapper for one epic card. Renders a 2-column header
 * (left: chevron + header content, right: always-visible stat rail) and a
 * collapsible body (the task list) below. The stat rail (`right`) stays visible
 * when collapsed; only the body toggles.
 * @param props - Component props.
 * @param props.header - server-rendered left header content.
 * @param props.right - always-visible right rail (stat + progress bar).
 * @param props.hasBody - whether there is a collapsible task list.
 * @param props.children - the collapsible body (task list).
 * @param props.defaultOpen - initial open state (defaults to true).
 * @returns JSX element.
 */
export function EpicCardCollapse({
  header,
  right,
  hasBody,
  children,
  defaultOpen = true,
}: PropsWithChildren<{
  header: ReactNode;
  right: ReactNode;
  hasBody: boolean;
  defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-[18px]'>
        <div className='flex min-w-0 items-start gap-2.5'>
          {hasBody ? (
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
              className='mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]'
            >
              <ChevronRight
                className={clsx(
                  'h-[18px] w-[18px] transition-transform',
                  open && 'rotate-90',
                )}
              />
            </button>
          ) : (
            <span
              className='mt-0.5 h-[18px] w-[18px] shrink-0'
              aria-hidden='true'
            />
          )}
          <div className='min-w-0 flex-1'>{header}</div>
        </div>
        <div className='flex flex-col items-end gap-2.5'>{right}</div>
      </div>
      {hasBody && (
        <div id={bodyId} hidden={!open}>
          {children}
        </div>
      )}
    </>
  );
}
