'use client';

import { ExternalLink } from 'lucide-react';
import React, { type JSX } from 'react';

import EventSummary from '@/features/event/ui/event-summary';
import { BotToggleButton, type BotOrgOption } from '@/features/meetings';
import {
  participantLabels as participants,
  Participants,
} from '@/features/participants';
import ModalBody from '@/shared/ui/modal/modal-body';
import ModalFooter from '@/shared/ui/modal/modal-footer';
import ModalHeader from '@/shared/ui/modal/modal-header';

import type { EventProps } from '@/entities/event';
import type { AttendeeProps, GuestProps } from '@/entities/participant';

interface EventPopupProps {
  event: EventProps;
  close: () => void;
  attendees: AttendeeProps[];
  guests: GuestProps[];
  /** Authenticated user id — gates the bot toggle to the meeting creator. */
  currentUserId?: number | null;
  /**
   * Org options for the bot picker. Passed explicitly because the popup renders
   * in the app-root modal portal, outside BotManageProvider.
   */
  organizations?: BotOrgOption[];
}

/**
 * EventPopup component.
 * @param root0 - Component props.
 * @param root0.event - The event to display.
 * @param root0.close - Callback to close the popup.
 * @param root0.attendees - List of attendees.
 * @param root0.guests - List of guests.
 * @param root0.currentUserId - Authenticated user id (gates the bot toggle to the creator).
 * @param root0.organizations - Org options for the bot picker.
 * @returns JSX element.
 */
export function EventPopup({
  event,
  close,
  guests,
  attendees,
  currentUserId = null,
  organizations = [],
}: EventPopupProps): JSX.Element {
  return (
    <>
      <ModalHeader onClick={close} title={event.title} />
      <ModalBody>
        <div className='flex flex-col gap-7'>
          <EventSummary event={event} />
        </div>

        <div className={'flex flex-row justify-between mt-7'}>
          <Participants list={guests} title={participants.guest} />
          <Participants list={attendees} title={participants.attendee} />
        </div>
      </ModalBody>

      <ModalFooter>
        <div className='flex flex-wrap items-center gap-3 w-full'>
          {event.url && !event.has_summary && (
            <a
              href={event.url}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20'
            >
              <ExternalLink size={16} aria-hidden='true' />
              Connect
            </a>
          )}
          <div className={'flex-1 md:w-[250px] md:ml-auto md:flex-none'}>
            <BotToggleButton
              variant='block'
              eventId={event.id}
              isBotAdded={event.required_bot}
              creatorUserId={event.creator_user_id}
              currentUserId={currentUserId}
              organizations={organizations}
            />
          </div>
        </div>
      </ModalFooter>
    </>
  );
}
