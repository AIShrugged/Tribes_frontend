'use client';

import { useTransition } from 'react';

import Event from '@/features/calendar/ui/event';
import { EventPopup } from '@/features/event';
import { useBotManage } from '@/features/meetings';
import { getAttendees, getGuests } from '@/features/participants';
import { useModal } from '@/shared/hooks/use-modal';

import type { EventProps } from '@/entities/event';

/**
 * CalendarEvent — widget that composes the calendar Event pill with
 * EventPopup and participant fetching. Kept in widgets/ because it
 * crosses feature boundaries (calendar + event + participants).
 * @param props - Component props.
 * @param props.event - The event to display.
 * @returns JSX element.
 */
export function CalendarEvent({ event }: { event: EventProps }) {
  const { open, close } = useModal();
  const { currentUserId, organizations } = useBotManage();
  const [, startTransition] = useTransition();
  /**
   * handleFutureEventClick.
   * @param e - event.
   */
  const handleFutureEventClick = (e: EventProps) => {
    if (!open) return;

    startTransition(async () => {
      try {
        const [{ data: attendees = [] }, { data: guests = [] }] =
          await Promise.all([
            getAttendees(String(e.id)),
            getGuests(String(e.id)),
          ]);

        open(
          <EventPopup
            attendees={attendees}
            guests={guests}
            event={e}
            close={close}
            currentUserId={currentUserId}
            organizations={organizations}
          />,
        );
      } catch {
        open(
          <EventPopup
            attendees={[]}
            guests={[]}
            event={e}
            close={close}
            currentUserId={currentUserId}
            organizations={organizations}
          />,
        );
      }
    });
  };

  return <Event event={event} onFutureEventClick={handleFutureEventClick} />;
}
