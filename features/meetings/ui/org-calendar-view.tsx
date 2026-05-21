'use client';

import Calendar from '@/features/calendar/ui/calendar';
import { EventPopupAll } from '@/features/event/ui/event-popup-all';
import { toEventProps } from '@/features/meetings/model/utils';
import { OrgCalendarEvent } from '@/features/meetings/ui/org-calendar-event';
import { useModal } from '@/shared/hooks/use-modal';

import type { EventProps } from '@/entities/event';
import type { CalendarEventListItem } from '@/features/meetings/model/types';

interface OrgCalendarViewProps {
  events: CalendarEventListItem[];
  currentMonth: string;
}

/**
 * OrgCalendarView — calendar grid for organisation-wide bot meetings.
 * Reuses the Calendar shell from features/calendar and maps org event items
 * to EventProps via the toEventProps adapter.
 * @param props - Component props.
 * @param props.events - Org meeting events for the current month.
 * @param props.currentMonth - Current month as YYYY-MM-01 string.
 */
export function OrgCalendarView({
  events,
  currentMonth,
}: OrgCalendarViewProps) {
  const { open, close } = useModal();

  const eventById = new Map(events.map((e) => {return [e.id, e]}));
  const mappedEvents: EventProps[] = events.map((item) => {return toEventProps(item)});

  const handleShowAll = (dayEvents: EventProps[]) => {
    if (open) open(<EventPopupAll list={dayEvents} close={close} />);
  };

  return (
    <Calendar
      events={mappedEvents}
      currentMonth={currentMonth}
      renderEvent={(event) => {
        const original = eventById.get(event.id);

        if (!original) return null;

        return <OrgCalendarEvent key={event.id} event={original} />;
      }}
      onShowAll={handleShowAll}
    />
  );
}
