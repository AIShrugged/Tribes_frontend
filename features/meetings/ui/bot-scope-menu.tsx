'use client';

import { CalendarDays, CalendarRange } from 'lucide-react';
import { useEffect, useRef } from 'react';

export type BotScope = 'single' | 'series';

interface BotScopeMenuProps {
  /** Current bot state — drives the verb (add vs remove) in the labels. */
  added: boolean;
  onSelect: (scope: BotScope) => void;
  onClose: () => void;
  /** 'up' opens above the trigger (modal footer), 'down' below it (cards). */
  direction?: 'up' | 'down';
  disabled?: boolean;
}

/**
 * BotScopeMenu — small popover that asks whether the recording bot change applies
 * to just this meeting or to the whole recurring series (every future occurrence
 * sharing the same meeting link). Shown from the caret next to the bot toggle.
 */
export function BotScopeMenu({
  added,
  onSelect,
  onClose,
  direction = 'down',
  disabled = false,
}: BotScopeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const verb = added ? 'Remove bot from' : 'Add bot to';

  const items: { scope: BotScope; label: string; icon: typeof CalendarDays }[] =
    [
      { scope: 'single', label: `${verb} this meeting`, icon: CalendarDays },
      {
        scope: 'series',
        label: `${verb} all meetings in series`,
        icon: CalendarRange,
      },
    ];

  return (
    <div
      ref={ref}
      role='menu'
      aria-label='Choose which meetings the bot change applies to'
      className={`absolute z-50 left-0 w-64 rounded-xl border border-border bg-card shadow-lg ${
        direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <p className='border-b border-border/60 px-3 pt-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'>
        Apply to
      </p>
      <ul className='p-1'>
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.scope}>
              <button
                type='button'
                role='menuitem'
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.scope);
                }}
                className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50'
              >
                <Icon className='h-3.5 w-3.5 flex-shrink-0 text-muted-foreground' />
                <span className='truncate'>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
