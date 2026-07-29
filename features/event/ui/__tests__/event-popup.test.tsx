import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { switchBot } from '@/features/event/api/calendar-events';
import { EventPopup } from '@/features/event/ui/event-popup';

import type { EventProps } from '@/entities/event';

jest.mock('@/features/event/api/calendar-events', () => {
  return {
    switchBot: jest
      .fn()
      .mockResolvedValue({ data: { event: {} }, error: null }),
  };
});

const switchBotMock = switchBot as jest.MockedFunction<typeof switchBot>;

const ORGS = [{ id: 10, name: 'Acme' }];

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { refresh: jest.fn() };
    },
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

jest.mock('@/features/participants/ui/participants', () => {
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => {
      return <div data-testid='participants'>{title}</div>;
    },
  };
});

jest.mock('@/shared/ui/modal/modal-header', () => {
  return {
    __esModule: true,
    default: ({ title, onClick }: { title: string; onClick: () => void }) => {
      return (
        <div data-testid='modal-header' onClick={onClick}>
          {title}
        </div>
      );
    },
  };
});

jest.mock('@/shared/ui/modal/modal-body', () => {
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => {
      return <div>{children}</div>;
    },
  };
});

jest.mock('@/shared/ui/modal/modal-footer', () => {
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => {
      return <div>{children}</div>;
    },
  };
});

const makeEvent = (overrides: Partial<EventProps> = {}): EventProps => {
  return {
    id: 1,
    title: 'Sprint Planning',
    description: '',
    starts_at: '2024-03-15 10:00:00',
    ends_at: '2024-03-15 11:00:00',
    url: 'https://meet.example.com',
    platform: 'zoom',
    required_bot: false,
    creator_user_id: 1,
    organization_id: null,
    has_summary: false,
    ...overrides,
  };
};

describe('EventPopup', () => {
  beforeEach(() => {
    switchBotMock.mockClear();
  });

  it('renders event title in header', () => {
    render(
      <EventPopup
        event={makeEvent()}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
      />,
    );
    expect(screen.getByTestId('modal-header')).toHaveTextContent(
      'Sprint Planning',
    );
  });

  it('renders EventSummary', () => {
    render(
      <EventPopup
        event={makeEvent()}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
      />,
    );
    expect(screen.getByTestId('event-summary')).toBeInTheDocument();
  });

  it('shows "Add Bot" button to the creator when bot not added', () => {
    render(
      <EventPopup
        event={makeEvent({ required_bot: false, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={1}
        organizations={ORGS}
      />,
    );
    expect(
      screen.getByRole('button', { name: /add bot/i }),
    ).toBeInTheDocument();
  });

  it('shows "Remove Bot" button to the creator when bot is added', () => {
    render(
      <EventPopup
        event={makeEvent({ required_bot: true, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={1}
        organizations={ORGS}
      />,
    );
    expect(
      screen.getByRole('button', { name: /remove bot/i }),
    ).toBeInTheDocument();
  });

  it('hides the bot toggle for a non-creator', () => {
    render(
      <EventPopup
        event={makeEvent({ required_bot: false, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={999}
        organizations={ORGS}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /add bot/i }),
    ).not.toBeInTheDocument();
  });

  it('enables the bot silently with the single org', async () => {
    const user = userEvent.setup();

    render(
      <EventPopup
        event={makeEvent({ required_bot: false, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={1}
        organizations={ORGS}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add bot/i }));

    await waitFor(() => {
      expect(switchBotMock).toHaveBeenCalledWith(1, true, 10, 'single');
    });
  });

  it('enables the bot for the whole series from the scope menu', async () => {
    const user = userEvent.setup();

    render(
      <EventPopup
        event={makeEvent({ required_bot: false, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={1}
        organizations={ORGS}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /apply bot to the whole series/i }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: /all meetings in series/i }),
    );

    await waitFor(() => {
      expect(switchBotMock).toHaveBeenCalledWith(1, true, 10, 'series');
    });
  });

  it('shows the org picker before enabling when there are multiple orgs', async () => {
    const user = userEvent.setup();

    render(
      <EventPopup
        event={makeEvent({ required_bot: false, creator_user_id: 1 })}
        close={jest.fn()}
        guests={[]}
        attendees={[]}
        currentUserId={1}
        organizations={[
          { id: 10, name: 'Acme' },
          { id: 20, name: 'Globex' },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add bot/i }));

    expect(screen.getByText(/connect bot from/i)).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Globex' }),
    ).toBeInTheDocument();
    // Picker only — no request until an org is chosen.
    expect(switchBotMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Globex' }));

    await waitFor(() => {
      expect(switchBotMock).toHaveBeenCalledWith(1, true, 20, 'single');
    });
  });
});
