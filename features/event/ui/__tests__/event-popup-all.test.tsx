import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/features/event/lib/get-weekday-and-day', () => {
  return {
    getWeekdayAndDay: () => {
      return { weekday: 'Mon', day: '12' };
    },
  };
});

jest.mock('@/shared/lib/dateFormatter', () => {
  return {
    formatDate: (s: string) => {
      return s.slice(11, 16);
    },
  };
});

jest.mock('@/shared/ui/button/button-close', () => {
  return {
    __esModule: true,
    default: ({ close }: { close: () => void }) => {
      return (
        <button onClick={close} aria-label='Close'>
          X
        </button>
      );
    },
  };
});

jest.mock('@/shared/ui/typography/H4', () => {
  return {
    H4: ({ children }: React.PropsWithChildren) => {
      return <h4>{children}</h4>;
    },
  };
});

import { EventPopupAll } from '@/features/event/ui/event-popup-all';

import type { EventProps } from '@/entities/event';

const makeEvent = (id: number): EventProps => {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    ends_at: '2024-01-12 11:00:00',
    platform: 'google',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
    starts_at: '2024-01-12 10:00:00',
    url: `https://example.com/event/${id}`,
  };
};
const user = userEvent.setup({ delay: null });

describe('EventPopupAll', () => {
  it('renders the day from the first event', () => {
    render(<EventPopupAll list={[makeEvent(1)]} close={jest.fn()} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders the weekday from the first event', () => {
    render(<EventPopupAll list={[makeEvent(1)]} close={jest.fn()} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });

  it('renders a close button', () => {
    render(<EventPopupAll list={[makeEvent(1)]} close={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls close callback when close button is clicked', async () => {
    const close = jest.fn();

    render(<EventPopupAll list={[makeEvent(1)]} close={close} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('renders a title row for each event', () => {
    render(
      <EventPopupAll
        list={[makeEvent(1), makeEvent(2), makeEvent(3)]}
        close={jest.fn()}
      />,
    );
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.getByText('Event 3')).toBeInTheDocument();
  });

  it('returns null when list is empty', () => {
    const { container } = render(<EventPopupAll list={[]} close={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
