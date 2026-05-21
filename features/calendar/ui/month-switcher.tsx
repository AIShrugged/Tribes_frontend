'use client';

import { addMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { H2 } from '@/shared/ui/typography/H2';

export const MonthSwitcher = ({ currentMonth }: { currentMonth: string }) => {
  const { push } = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setMonth = (date: Date) => {
    const next = new URLSearchParams(params);

    next.set('month', format(date, 'yyyy-MM-01'));
    startTransition(() => {
      push(`?${next.toString()}`);
    });
  };

  const current = new Date(currentMonth);

  return (
    <div className='flex items-center gap-[11px]'>
      <button
        type='button'
        aria-label='Previous month'
        className='cursor-pointer disabled:opacity-50'
        disabled={isPending}
        onClick={() => {
          setMonth(addMonths(current, -1));
        }}
      >
        <ChevronLeft />
      </button>

      <div className='flex items-center gap-2'>
        <H2>{format(current, 'MMMM, yyyy')}</H2>
        {isPending && (
          <Loader2 className='size-4 animate-spin text-muted-foreground' />
        )}
      </div>

      <button
        type='button'
        aria-label='Next month'
        className='cursor-pointer disabled:opacity-50'
        disabled={isPending}
        onClick={() => {
          setMonth(addMonths(current, 1));
        }}
      >
        <ChevronRight />
      </button>
    </div>
  );
};
