import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/features/participants/api/participants', () => {
  return {
    setProfile: jest.fn().mockResolvedValue(),
  };
});

jest.mock('lucide-react', () => {
  return {
    ArrowRight: () => {
      return <span aria-hidden='true'>→</span>;
    },
    Loader2: () => {
      return <span data-testid='loader' />;
    },
  };
});

jest.mock('@/shared/ui/input/InputDropdown', () => {
  return {
    __esModule: true,
    default: ({
      options,
      value,
      onChange,
      placeholder,
      disabled,
    }: {
      options: { label: string; value: string }[];
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      disabled?: boolean;
    }) => {
      return (
        <select
          data-testid='dropdown'
          value={value}
          disabled={disabled}
          onChange={(e) => {
            return onChange(e.target.value);
          }}
        >
          <option value=''>{placeholder ?? 'Select'}</option>
          {options.map((opt) => {
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
      );
    },
  };
});

import { setProfile } from '@/features/participants/api/participants';
import ParticipantMatching from '@/features/participants/ui/participant-matching';

import type { AttendeeProps, GuestProps } from '@/entities/participant';

const makeGuest = (id: number, identifier: string): GuestProps => {
  return {
    variant: 'guest',
    id,
    channel: 'email',
    channel_identifier: identifier,
    user_id: 0,
  };
};
const makeAttendee = (
  id: number,
  name: string,
  profileId?: number,
): AttendeeProps => {
  return {
    variant: 'attendee',
    calendar_event_id: 1,
    id,
    name,
    profile: profileId ? ({ id: profileId } as AttendeeProps['profile']) : null,
  };
};

describe('ParticipantMatching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a dropdown for each attendee', () => {
    const attendees = [makeAttendee(1, 'Alice'), makeAttendee(2, 'Bob')];

    render(
      <ParticipantMatching eventId={10} guests={[]} attendees={attendees} />,
    );
    expect(screen.getAllByTestId('dropdown')).toHaveLength(2);
  });

  it('renders guest identifiers as options', () => {
    const guests = [
      makeGuest(1, 'alice@example.com'),
      makeGuest(2, 'bob@example.com'),
    ];
    const attendees = [makeAttendee(1, 'Person')];

    render(
      <ParticipantMatching
        eventId={10}
        guests={guests}
        attendees={attendees}
      />,
    );
    expect(
      screen.getByRole('option', { name: 'alice@example.com' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'bob@example.com' }),
    ).toBeInTheDocument();
  });

  it('pre-selects matched profile in dropdown', () => {
    const guests = [makeGuest(5, 'matched@example.com')];
    const attendees = [makeAttendee(1, 'Alice', 5)];

    render(
      <ParticipantMatching
        eventId={10}
        guests={guests}
        attendees={attendees}
      />,
    );
    expect(screen.getByTestId('dropdown')).toHaveValue('5');
  });

  it('calls setProfile when a guest is selected', async () => {
    const guests = [makeGuest(7, 'guest@example.com')];
    const attendees = [makeAttendee(3, 'Bob')];

    render(
      <ParticipantMatching
        eventId={10}
        guests={guests}
        attendees={attendees}
      />,
    );
    await act(async () => {
      await userEvent.selectOptions(screen.getByTestId('dropdown'), '7');
    });
    expect(setProfile).toHaveBeenCalledWith(10, 3, '7');
  });

  it('renders empty state without errors when no attendees', () => {
    const { container } = render(
      <ParticipantMatching eventId={10} guests={[]} attendees={[]} />,
    );

    expect(screen.queryAllByTestId('dropdown')).toHaveLength(0);
    expect(container.firstChild).toBeInTheDocument();
  });
});
