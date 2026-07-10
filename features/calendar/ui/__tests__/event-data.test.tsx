import { render, screen } from '@testing-library/react';

import EventItem from '@/features/calendar/ui/event-data';

import type { EventProps } from '@/entities/event';

jest.mock('@/features/calendar/ui/event', () => {
  return {
    __esModule: true,
    default: ({ event }: { event: EventProps }) => {
      return <div data-testid='event'>{event.title}</div>;
    },
  };
});

const makeEvent = (): EventProps => {
  return {
    id: 1,
    title: 'Team Sync',
    description: '',
    starts_at: '2026-03-10T10:00:00Z',
    ends_at: '2026-03-10T11:00:00Z',
    platform: 'zoom',
    url: '',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
  };
};

describe('EventItem', () => {
  it('renders the Event component with the given event', () => {
    render(<EventItem event={makeEvent()} />);

    expect(screen.getByTestId('event')).toHaveTextContent('Team Sync');
  });
});
