import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: mockPush };
    },
  };
});

jest.mock('@/shared/lib/isEventPast', () => {
  return {
    isEventPast: jest.fn(),
  };
});

jest.mock('@/shared/lib/dateFormatter', () => {
  return {
    formatDate: (d: string) => {
      return d;
    },
    parseEventDate: (d: string) => {
      return new Date(d);
    },
  };
});

jest.mock('lucide-react', () => {
  return {
    Circle: () => {
      return <span data-testid='circle-icon' />;
    },
    CircleCheckBig: () => {
      return <span data-testid='check-icon' />;
    },
    CircleDashed: () => {
      return <span data-testid='dashed-icon' />;
    },
    Clock4: () => {
      return null;
    },
    Video: () => {
      return null;
    },
    Bot: () => {
      return null;
    },
  };
});

jest.mock('clsx', () => {
  return {
    __esModule: true,
    default: (...args: unknown[]) => {
      return args.filter(Boolean).join(' ');
    },
  };
});

import Event from '@/features/calendar/ui/event';
import { isEventPast } from '@/shared/lib/isEventPast';

import type { EventProps } from '@/entities/event';

const EVENT_TITLE = 'Team Meeting';
const makeEvent = (id: number = 1): EventProps => {
  return {
    id,
    title: EVENT_TITLE,
    starts_at: '2024-03-15 10:00:00',
    ends_at: '2024-03-15 11:00:00',
    url: '',
    has_summary: true,
    description: '',
    platform: 'google',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
  };
};
const user = userEvent.setup({ delay: null });

describe('Event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isEventPast as jest.Mock).mockReturnValue(false);
  });

  it('renders the event title', () => {
    render(<Event event={makeEvent()} />);
    expect(screen.getAllByText(EVENT_TITLE)[0]).toBeInTheDocument();
  });

  it('shows a circle icon for future events', () => {
    (isEventPast as jest.Mock).mockReturnValue(false);
    render(<Event event={makeEvent()} />);
    expect(screen.getByTestId('circle-icon')).toBeInTheDocument();
  });

  it('shows a checkmark icon for past events', () => {
    (isEventPast as jest.Mock).mockReturnValue(true);
    render(<Event event={makeEvent()} />);
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('navigates to meeting summary page when past event is clicked', async () => {
    (isEventPast as jest.Mock).mockReturnValue(true);
    render(<Event event={makeEvent(1)} />);
    await user.click(screen.getAllByText(EVENT_TITLE)[0]);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/1'));
  });

  it('calls onFutureEventClick when a future event is clicked', async () => {
    (isEventPast as jest.Mock).mockReturnValue(false);
    const onFutureEventClick = jest.fn();

    render(
      <Event event={makeEvent()} onFutureEventClick={onFutureEventClick} />,
    );
    await act(async () => {
      await user.click(screen.getAllByText(EVENT_TITLE)[0]);
    });
    expect(onFutureEventClick).toHaveBeenCalledWith(makeEvent());
  });
});
