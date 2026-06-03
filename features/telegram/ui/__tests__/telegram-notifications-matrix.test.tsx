import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TelegramNotificationsMatrix } from '@/features/telegram/ui/telegram-notifications-matrix';

import type { TeamNotificationSetting } from '@/entities/team-notification-setting';
import type { TelegramChatRegistration } from '@/entities/telegram';

jest.mock('sonner', () => {
  return { toast: { success: jest.fn(), error: jest.fn() } };
});

const mockSync = jest.fn().mockResolvedValue({ data: [], error: null });
const mockSetMinutes = jest.fn().mockResolvedValue({ data: [], error: null });

jest.mock('@/features/telegram/api/telegram-notifications', () => {
  return {
    syncChatNotifications: (...args: unknown[]) => {
      return mockSync(...args);
    },
    setEventMinutesBefore: (...args: unknown[]) => {
      return mockSetMinutes(...args);
    },
  };
});

function chat(id: number, title: string): TelegramChatRegistration {
  return {
    id,
    channel_conversation_id: null,
    user_id: null,
    telegram_chat_id: -100 - id,
    message_thread_id: null,
    chat_type: 'group',
    chat_title: title,
    topic_label: null,
    topic_title: null,
    organization_id: 1,
    team_id: 5,
    attach_code: null,
    attach_command: null,
    attach_code_expires_at: null,
    attach_code_used_at: null,
    is_bound: true,
    bound_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function setting(
  id: number,
  eventType: string,
  chatId: number,
): TeamNotificationSetting {
  return {
    id,
    team_id: 5,
    event_type: eventType,
    channel_type: 'telegram',
    notifiable: { type: 'TelegramChatRegistration', id: chatId, data: null },
    enabled: true,
    minutes_before: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const CHAT_A = chat(1, 'Alpha chat');
const CHAT_B = chat(2, 'Beta chat');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TelegramNotificationsMatrix', () => {
  it('renders the working event types with help text and excludes meeting_tasks', () => {
    render(
      <TelegramNotificationsMatrix
        teamId={5}
        settings={[]}
        availableChats={[CHAT_A, CHAT_B]}
      />,
    );

    expect(screen.getByText('Meeting summary')).toBeInTheDocument();
    expect(screen.getByText('Meeting review')).toBeInTheDocument();
    expect(screen.getByText('Meeting agenda')).toBeInTheDocument();
    expect(screen.getByText('Meeting reminder')).toBeInTheDocument();
    expect(screen.getByText('Critical path')).toBeInTheDocument();
    expect(screen.queryByText('Meeting tasks')).not.toBeInTheDocument();
    expect(screen.getByText(/Post-meeting recap/i)).toBeInTheDocument();
  });

  it('preselects the chat a setting routes the event to', () => {
    render(
      <TelegramNotificationsMatrix
        teamId={5}
        settings={[setting(10, 'meeting_summary', CHAT_A.id)]}
        availableChats={[CHAT_A, CHAT_B]}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: /Meeting summary/,
    }) as HTMLSelectElement;
    expect(select.value).toBe(String(CHAT_A.id));
  });

  it('defaults to "do not send" when no setting exists', () => {
    render(
      <TelegramNotificationsMatrix
        teamId={5}
        settings={[]}
        availableChats={[CHAT_A, CHAT_B]}
      />,
    );

    const select = screen.getByRole('combobox', {
      name: /Meeting summary/,
    }) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('syncs with the chosen single chat when selected', async () => {
    const user = userEvent.setup();
    render(
      <TelegramNotificationsMatrix
        teamId={5}
        settings={[]}
        availableChats={[CHAT_A, CHAT_B]}
      />,
    );

    const select = screen.getByRole('combobox', { name: /Meeting summary/ });
    await user.selectOptions(select, String(CHAT_B.id));

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalledWith(5, 'meeting_summary', [CHAT_B.id]);
    });
  });

  it('syncs with an empty set when "do not send" is chosen', async () => {
    const user = userEvent.setup();
    render(
      <TelegramNotificationsMatrix
        teamId={5}
        settings={[setting(10, 'meeting_summary', CHAT_A.id)]}
        availableChats={[CHAT_A, CHAT_B]}
      />,
    );

    const select = screen.getByRole('combobox', { name: /Meeting summary/ });
    await user.selectOptions(select, '');

    await waitFor(() => {
      expect(mockSync).toHaveBeenCalledWith(5, 'meeting_summary', []);
    });
  });

  it('shows the empty state when there are no bound chats', () => {
    render(
      <TelegramNotificationsMatrix teamId={5} settings={[]} availableChats={[]} />,
    );

    expect(screen.getByText(/No linked chats/i)).toBeInTheDocument();
  });
});
