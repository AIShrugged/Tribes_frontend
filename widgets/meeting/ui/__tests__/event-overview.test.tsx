import { render, screen } from '@testing-library/react';

import EventOverview from '@/widgets/meeting/ui/event-overview';

import type { EventProps } from '@/entities/event';

const PARTICIPANTS_MODULE = '@/features/participants/api/participants';
const PARTICIPANT_DATA_TESTID = 'participant-data';

jest.mock('@/features/participants/api/participants', () => {
  return {
    getAttendees: jest.fn().mockResolvedValue({ data: [] }),
    getGuests: jest.fn().mockResolvedValue({ data: [] }),
  };
});

jest.mock('@/features/event/ui/event-summary', () => {
  return {
    __esModule: true,
    default: ({ event }: { event: EventProps }) => {
      return <div data-testid='event-summary'>{event.title}</div>;
    },
  };
});

jest.mock('@/features/participants/ui/participant-data', () => {
  return {
    __esModule: true,
    default: ({
      guests,
      attendees,
    }: {
      guests: unknown[];
      attendees: unknown[];
    }) => {
      return (
        <div data-testid={PARTICIPANT_DATA_TESTID}>
          guests:{guests.length} attendees:{attendees.length}
        </div>
      );
    },
  };
});

const makeEvent = (overrides: Partial<EventProps> = {}): EventProps => {
  return {
    id: 1,
    title: 'Sprint review',
    description: 'Biweekly sprint review',
    starts_at: '2024-06-01T10:00:00Z',
    ends_at: '2024-06-01T11:00:00Z',
    platform: 'zoom',
    url: 'https://zoom.us/j/123',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
    ...overrides,
  };
};

describe('EventOverview', () => {
  it('renders EventSummary with the event', async () => {
    render(await EventOverview({ id: '1', event: makeEvent() }));

    expect(screen.getByTestId('event-summary')).toHaveTextContent(
      'Sprint review',
    );
  });

  it('renders ParticipantData', async () => {
    render(await EventOverview({ id: '1', event: makeEvent() }));

    expect(screen.getByTestId(PARTICIPANT_DATA_TESTID)).toBeInTheDocument();
  });

  it('passes fetched attendees and guests to ParticipantData', async () => {
    const { getAttendees, getGuests } = jest.requireMock(PARTICIPANTS_MODULE);

    getAttendees.mockResolvedValueOnce({
      data: [{ id: 1 }, { id: 2 }],
    });
    getGuests.mockResolvedValueOnce({
      data: [{ id: 3 }],
    });

    render(await EventOverview({ id: '5', event: makeEvent() }));

    expect(screen.getByTestId(PARTICIPANT_DATA_TESTID)).toHaveTextContent(
      'guests:1 attendees:2',
    );
  });

  it('calls getAttendees and getGuests with the event id', async () => {
    const { getAttendees, getGuests } = jest.requireMock(PARTICIPANTS_MODULE);

    await EventOverview({ id: '42', event: makeEvent() });

    expect(getAttendees).toHaveBeenCalledWith('42');
    expect(getGuests).toHaveBeenCalledWith('42');
  });

  it('returns nothing when event is falsy', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await EventOverview({ id: '1', event: null as any });

    expect(result).toBeUndefined();
  });

  it('handles empty attendees and guests gracefully', async () => {
    render(await EventOverview({ id: '1', event: makeEvent() }));

    expect(screen.getByTestId(PARTICIPANT_DATA_TESTID)).toHaveTextContent(
      'guests:0 attendees:0',
    );
  });

  it('renders with empty lists when getAttendees rejects (e.g. 404)', async () => {
    const { getAttendees } = jest.requireMock(PARTICIPANTS_MODULE);

    getAttendees.mockRejectedValueOnce(
      new Error('getAttendees failed: 404 Not Found'),
    );

    render(await EventOverview({ id: '11', event: makeEvent() }));

    expect(screen.getByTestId(PARTICIPANT_DATA_TESTID)).toHaveTextContent(
      'guests:0 attendees:0',
    );
  });

  it('renders with empty lists when getGuests rejects (e.g. 404)', async () => {
    const { getGuests } = jest.requireMock(PARTICIPANTS_MODULE);

    getGuests.mockRejectedValueOnce(
      new Error('getGuests failed: 404 Not Found'),
    );

    render(await EventOverview({ id: '11', event: makeEvent() }));

    expect(screen.getByTestId(PARTICIPANT_DATA_TESTID)).toHaveTextContent(
      'attendees:0',
    );
  });
});
