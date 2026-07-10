import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock child components
jest.mock('@/features/calendar/ui/day', () => {
  return {
    __esModule: true,
    default: ({ currentDay }: { currentDay: Date }) => {
      return <div data-testid='day'>{currentDay.getDate()}</div>;
    },
  };
});

jest.mock('@/features/calendar/ui/event-extra-button', () => {
  return {
    __esModule: true,
    default: ({ count }: { count: number }) => {
      return <div data-testid='extra-button'>+{count} more</div>;
    },
  };
});

import Cells from '@/features/calendar/ui/cells';

import type { EventProps } from '@/entities/event';

const makeEvent = (id: number, startsAt: string): EventProps => {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    starts_at: startsAt,
    ends_at: startsAt,
    platform: 'zoom',
    url: '',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
  };
};
const renderEvent = (event: EventProps) => {
  return (
    <div key={event.id} data-testid={`event-${event.id}`}>
      {event.title}
    </div>
  );
};

describe('Cells', () => {
  it('renders day cells for the month', () => {
    render(
      <Cells currentMonth='2024-03-01' events={[]} renderEvent={renderEvent} />,
    );
    const days = screen.getAllByTestId('day');

    // March 2024 grid: 5 or 6 weeks × 7 = 35 or 42 days
    expect(days.length).toBeGreaterThanOrEqual(28);
  });

  it('renders events on the correct day', () => {
    const events = [makeEvent(1, '2024-03-15T10:00:00Z')];

    render(
      <Cells
        currentMonth='2024-03-01'
        events={events}
        renderEvent={renderEvent}
      />,
    );
    expect(screen.getByTestId('event-1')).toBeInTheDocument();
  });

  it('renders nothing when no events match', () => {
    const events = [makeEvent(1, '2024-04-01T10:00:00Z')];

    render(
      <Cells
        currentMonth='2024-03-01'
        events={events}
        renderEvent={renderEvent}
      />,
    );
    expect(screen.queryByTestId('event-1')).not.toBeInTheDocument();
  });

  it('shows "+N more" button when a day has more than 3 events', () => {
    const events = [
      makeEvent(1, '2024-03-10T10:00:00Z'),
      makeEvent(2, '2024-03-10T11:00:00Z'),
      makeEvent(3, '2024-03-10T12:00:00Z'),
      makeEvent(4, '2024-03-10T13:00:00Z'),
    ];

    render(
      <Cells
        currentMonth='2024-03-01'
        events={events}
        renderEvent={renderEvent}
      />,
    );
    expect(screen.getByTestId('extra-button')).toHaveTextContent('+1 more');
  });

  it('does not show "+N more" when a day has 3 or fewer events', () => {
    const events = [
      makeEvent(1, '2024-03-10T10:00:00Z'),
      makeEvent(2, '2024-03-10T11:00:00Z'),
      makeEvent(3, '2024-03-10T12:00:00Z'),
    ];

    render(
      <Cells
        currentMonth='2024-03-01'
        events={events}
        renderEvent={renderEvent}
      />,
    );
    expect(screen.queryByTestId('extra-button')).not.toBeInTheDocument();
  });
});
