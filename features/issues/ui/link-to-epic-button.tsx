'use client';

import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { linkTaskToEpic } from '@/features/issues/api/issues';

import type { Issue } from '@/features/issues/model/types';

/**
 * LinkToEpicButton — inline dropdown to link an unlinked task to an epic.
 * Prevents double-submit with isLinking guard.
 */
export function LinkToEpicButton({ taskId, epics }: { taskId: number; epics: Issue[] }) {
  const [open, setOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const handleLink = async (epicId: number) => {
    if (isLinking) return;

    setIsLinking(true);

    try {
      const result = await linkTaskToEpic(epicId, taskId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Task linked to goal');
        setOpen(false);
      }
    } finally {
      setIsLinking(false);
    }
  };

  if (epics.length === 0) return null;

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => {return setOpen((v) => {return !v})}}
        disabled={isLinking}
        className='flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50'
        aria-haspopup='listbox'
        aria-expanded={open}
      >
        <Link2 className='h-3 w-3' />
        Link to goal
      </button>

      {open && (
        <>
          <div
            className='fixed inset-0 z-10'
            onClick={() => {return setOpen(false)}}
            aria-hidden='true'
          />
          <ul
            role='listbox'
            aria-label='Select goal'
            className='absolute left-0 top-full z-20 mt-1 min-w-[220px] max-w-[320px] overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] shadow-lg'
          >
            {epics.map((epic) => {return (
              <li key={epic.id} role='option' aria-selected={false}>
                <button
                  type='button'
                  onClick={() => {return handleLink(epic.id)}}
                  disabled={isLinking}
                  className='w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 truncate'
                >
                  {epic.name}
                </button>
              </li>
            )})}
          </ul>
        </>
      )}
    </div>
  );
}
