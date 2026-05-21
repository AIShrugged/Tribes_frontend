import React from 'react';

import { getWeekdayAndDay } from '@/features/event/lib/get-weekday-and-day';
import { formatDate } from '@/shared/lib/dateFormatter';
import ButtonClose from '@/shared/ui/button/button-close';
import { H4 } from '@/shared/ui/typography/H4';

import type { EventProps } from '@/entities/event';

export const EventPopupAll = ({
  list,
  close,
}: {
  list: EventProps[];
  close: () => void;
}) => {
  if (list.length === 0) return null;

  const { weekday, day } = getWeekdayAndDay(list[0].starts_at);

  return (
    <div className='bg-card rounded-[var(--radius-card)] border border-border'>
      <div className='flex flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-border'>
        <div>
          <H4>{day}</H4>
          <span className='text-sm text-muted-foreground'>{weekday}</span>
        </div>
        <ButtonClose close={close} />
      </div>

      <div className='p-4 flex flex-col gap-1'>
        {list.map((event) => {return (
          <div
            key={event.id}
            className='flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted/20 transition-colors'
          >
            <span className='text-sm font-medium truncate flex-1'>
              {event.title}
            </span>
            <span className='text-xs text-muted-foreground shrink-0'>
              {formatDate(event.starts_at)}
            </span>
          </div>
        )})}
      </div>
    </div>
  );
};
