'use client';

import { Info, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LinkToEpicButton } from '@/features/issues/ui/link-to-epic-button';

import type { Issue } from '@/features/issues/model/types';

const storageKey = (issueId: number) =>
  `issue-hint-v1-${issueId}-no-goal-dismissed`;

export function IssueNoGoalHint({
  issueId,
  epics,
}: {
  issueId: number;
  epics: Issue[];
}) {
  // null = not yet determined (pre-hydration) → renders nothing to avoid flash
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Guard must come after hook declarations (Rules of Hooks)
    if (!Number.isInteger(issueId) || issueId <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(true);
      return;
    }
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(sessionStorage.getItem(storageKey(issueId)) === '1');
    } catch {
      // sessionStorage blocked (e.g. Safari private mode) → default to not dismissed
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
    }
  }, [issueId]);

  if (dismissed === null || dismissed) return null;

  function handleDismiss() {
    try {
      sessionStorage.setItem(storageKey(issueId), '1');
    } catch {
      // Ignore storage errors — banner will reappear on next visit but won't crash
    }
    setDismissed(true);
  }

  function handleLinked() {
    // After linking, revalidation happens server-side; refresh client to reflect change
    router.refresh();
  }

  return (
    <div
      role='alert'
      className={[
        'flex items-start gap-3 rounded-[var(--r-md)]',
        'border border-amber-500/30',
        'bg-amber-500/[0.06]',
        'px-3 py-2.5',
        'mb-4',
      ].join(' ')}
    >
      <Info className='mt-0.5 h-4 w-4 shrink-0 text-amber-500' />
      <div className='flex-1 min-w-0'>
        <p className='text-xs text-[var(--foreground)]/90'>
          This task is not linked to any goal.
        </p>
        {epics.length > 0 && (
          <div className='mt-1.5'>
            <LinkToEpicButton
              taskId={issueId}
              epics={epics}
              onSuccess={handleLinked}
            />
          </div>
        )}
      </div>
      <button
        type='button'
        aria-label='Dismiss'
        onClick={handleDismiss}
        className='shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors'
      >
        <X className='h-3.5 w-3.5' />
      </button>
    </div>
  );
}
