'use client';

import { useState } from 'react';

import { attachCalendar } from '@/features/calendar/api/calendar';

import type { PropsWithChildren } from 'react';

interface Props {
  organizationId: number;
  className?: string;
  pendingText?: string;
}

export function AttachCalendarButton({
  organizationId,
  className,
  pendingText,
  children,
}: PropsWithChildren<Props>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    setError(null);
    setIsPending(true);

    try {
      globalThis.location.href = await attachCalendar(organizationId);
      // On success: browser navigates away. isPending stays true intentionally —
      // the button stays disabled while the page unloads.
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : 'Something went wrong',
      );
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type='button'
        onClick={handleAttach}
        disabled={isPending}
        className={className}
      >
        {isPending ? 'Connecting...' : (children ?? 'Connect Calendar')}
      </button>
      {pendingText !== undefined && isPending && (
        <p className='text-sm mt-4 text-muted-foreground'>{pendingText}</p>
      )}
      {error !== null && (
        <p className='text-sm text-destructive mt-1'>{error}</p>
      )}
    </>
  );
}
