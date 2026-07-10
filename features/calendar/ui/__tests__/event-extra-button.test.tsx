import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import EventExtraButton from '@/features/calendar/ui/event-extra-button';

import type { EventProps } from '@/entities/event';

const makeEvent = (id: number): EventProps => {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    starts_at: '2024-01-01T10:00:00Z',
    ends_at: '2024-01-01T11:00:00Z',
    platform: 'zoom',
    url: '',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
  };
};
const user = userEvent.setup({ delay: null });

describe('EventExtraButton', () => {
  it('renders "+N more" text', () => {
    render(<EventExtraButton count={3} dayEvents={[makeEvent(1)]} />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('calls onShowAll with dayEvents when clicked', async () => {
    const events = [makeEvent(1), makeEvent(2)];
    const onShowAll = jest.fn();

    render(
      <EventExtraButton count={2} dayEvents={events} onShowAll={onShowAll} />,
    );
    await user.click(screen.getByText('+2 more'));
    expect(onShowAll).toHaveBeenCalledTimes(1);
    expect(onShowAll).toHaveBeenCalledWith(events);
  });

  it('displays the correct count in the label', () => {
    render(<EventExtraButton count={7} dayEvents={[]} />);
    expect(screen.getByText('+7 more')).toBeInTheDocument();
  });
});
