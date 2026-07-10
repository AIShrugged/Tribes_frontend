import { render, screen } from '@testing-library/react';

import CalendarAgenda from '@/features/calendar/ui/calendar-agenda';

import type { EventProps } from '@/entities/event';

const makeEvent = (id: number, title: string, startsAt: string): EventProps => {
  return {
    id,
    title,
    description: '',
    starts_at: startsAt,
    ends_at: startsAt,
    platform: 'zoom',
    url: 'https://zoom.us',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
  };
};
const CURRENT_MONTH = '2026-03-01';

describe('CalendarAgenda', () => {
  it('shows empty state when no events', () => {
    render(<CalendarAgenda events={[]} currentMonth={CURRENT_MONTH} />);

    expect(screen.getByText(/no events this month/i)).toBeInTheDocument();
  });

  it('renders event titles for the current month', () => {
    render(
      <CalendarAgenda
        events={[makeEvent(1, 'Sprint Review', '2026-03-10T10:00:00Z')]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    expect(screen.getByText('Sprint Review')).toBeInTheDocument();
  });

  it('filters out events from other months', () => {
    render(
      <CalendarAgenda
        events={[
          makeEvent(1, 'March Event', '2026-03-15T10:00:00Z'),
          makeEvent(2, 'April Event', '2026-04-05T10:00:00Z'),
        ]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    expect(screen.getByText('March Event')).toBeInTheDocument();
    expect(screen.queryByText('April Event')).not.toBeInTheDocument();
  });

  it('groups events by date', () => {
    render(
      <CalendarAgenda
        events={[
          makeEvent(1, 'Morning Standup', '2026-03-10T09:00:00Z'),
          makeEvent(2, 'Sprint Planning', '2026-03-10T14:00:00Z'),
          makeEvent(3, 'Retrospective', '2026-03-17T11:00:00Z'),
        ]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    expect(screen.getByText('Morning Standup')).toBeInTheDocument();
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.getByText('Retrospective')).toBeInTheDocument();
  });

  it('renders date headers for each group', () => {
    render(
      <CalendarAgenda
        events={[
          makeEvent(1, 'Event A', '2026-03-05T10:00:00Z'),
          makeEvent(2, 'Event B', '2026-03-12T10:00:00Z'),
        ]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    // Date headers like "Thu, 5 Mar" and "Thu, 12 Mar"
    expect(screen.getByText('Thu, 5 Mar')).toBeInTheDocument();
    expect(screen.getByText('Thu, 12 Mar')).toBeInTheDocument();
  });

  it('renders multiple events on same day in one group', () => {
    render(
      <CalendarAgenda
        events={[
          makeEvent(1, 'Event A', '2026-03-10T09:00:00Z'),
          makeEvent(2, 'Event B', '2026-03-10T15:00:00Z'),
        ]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    // Only one date header for the same day
    const dateHeaders = screen.queryAllByText('Tue, 10 Mar');

    expect(dateHeaders).toHaveLength(1);
  });

  it('shows empty state when all events are in other months', () => {
    render(
      <CalendarAgenda
        events={[makeEvent(1, 'Future event', '2026-05-01T10:00:00Z')]}
        currentMonth={CURRENT_MONTH}
      />,
    );

    expect(screen.getByText(/no events this month/i)).toBeInTheDocument();
  });
});
