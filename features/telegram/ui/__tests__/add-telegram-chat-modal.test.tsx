import { render, screen } from '@testing-library/react';

import { AddTelegramChatModal } from '@/features/telegram/ui/add-telegram-chat-modal';

jest.mock('sonner', () => {
  return { toast: { success: jest.fn(), error: jest.fn() } };
});

const mockCreate = jest.fn().mockResolvedValue({ data: { is_bound: false } });

jest.mock('@/features/telegram/api/telegram', () => {
  return {
    createTelegramWorkspaceChat: (...args: unknown[]) => {
      return mockCreate(...args);
    },
  };
});

describe('AddTelegramChatModal', () => {
  it('does not render a Team selector (chats are bound to the default team server-side)', () => {
    render(
      <AddTelegramChatModal
        isOpen
        onClose={jest.fn()}
        selectedOrganizationId={1}
        botUsername='wanda_bot'
      />,
    );

    expect(screen.getByText('Telegram Chat ID')).toBeInTheDocument();
    expect(screen.queryByText(/Team \(optional\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No team/i)).not.toBeInTheDocument();
  });
});
