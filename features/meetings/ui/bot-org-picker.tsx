'use client';

import { Building2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { BotOrgOption } from '../model/bot-manage-context';

interface BotOrgPickerProps {
  organizations: BotOrgOption[];
  onSelect: (organizationId: number) => void;
  onClose: () => void;
  /** 'up' opens above the trigger (modal footer), 'down' below it (cards). */
  direction?: 'up' | 'down';
  disabled?: boolean;
}

/**
 * BotOrgPicker — small popover that asks which organization the recording bot
 * should be connected from. Shown before enabling the bot when the user belongs
 * to more than one organization (a single org is applied silently upstream).
 */
export function BotOrgPicker({
  organizations,
  onSelect,
  onClose,
  direction = 'down',
  disabled = false,
}: BotOrgPickerProps) {
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

  return (
    <div
      ref={ref}
      role='menu'
      aria-label='Select organization for the recording bot'
      className={`absolute z-50 left-0 w-56 rounded-xl border border-border bg-card shadow-lg ${
        direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <p className='border-b border-border/60 px-3 pt-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'>
        Connect bot from
      </p>
      <ul className='max-h-56 overflow-y-auto p-1'>
        {organizations.map((org) => {
          return (
            <li key={org.id}>
              <button
                type='button'
                role='menuitem'
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(org.id);
                }}
                className='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50'
              >
                <Building2 className='h-3.5 w-3.5 flex-shrink-0 text-muted-foreground' />
                <span className='truncate'>{org.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
