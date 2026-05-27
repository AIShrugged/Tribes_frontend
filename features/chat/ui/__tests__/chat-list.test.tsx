import { beforeAll } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatList } from '@/features/chat/ui/chat-list';

import type { Chat } from '@/features/chat/model/types';

// jsdom doesn't implement IntersectionObserver — provide a no-op stub
beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

const mockPush = jest.fn();

jest.mock('next/navigation', () => {
  return {
    useRouter: () => {
      return { push: mockPush };
    },
  };
});

const mockCreateChat = jest.fn(() => {
  return Promise.resolve({
    data: { id: 99, title: null, created_at: '', updated_at: '' },
    error: null,
  });
});
const mockGetChats = jest.fn(() => {
  return Promise.resolve({ data: [], totalCount: 0 });
});

jest.mock('@/features/chat/api/chats', () => {
  return {
    createChat: (...args: unknown[]) => {
      return (mockCreateChat as (...params: unknown[]) => unknown)(...args);
    },
    getChats: (...args: unknown[]) => {
      return (mockGetChats as (...params: unknown[]) => unknown)(...args);
    },
  };
});

jest.mock('sonner', () => {
  return {
    toast: { error: jest.fn(), success: jest.fn() },
  };
});

// Simplify ChatListItem — expose update/delete buttons for integration tests
jest.mock('@/features/chat/ui/chat-list-item', () => {
  return {
    ChatListItem: ({
      chat,
      onUpdate,
      onDelete,
    }: {
      chat: Chat;
      onUpdate: (c: Chat) => void;
      onDelete: (id: number) => void;
    }) => {
      return (
        <div data-testid={`chat-item-${chat.id}`}>
          {chat.title ?? 'Untitled chat'}
          <button
            aria-label={`update-${chat.id}`}
            onClick={() => {
              return onUpdate({ ...chat, title: 'Updated' });
            }}
          />
          <button
            aria-label={`delete-${chat.id}`}
            onClick={() => {
              return onDelete(chat.id);
            }}
          />
        </div>
      );
    },
  };
});

const CHAT_ITEM_1 = 'chat-item-1';
const makeChat = (id: number, title: string | null = null): Chat => {
  return {
    id,
    title,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };
};

describe('ChatList', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockCreateChat.mockResolvedValue({
      data: { id: 99, title: null, created_at: '', updated_at: '' },
      error: null,
    });
    mockGetChats.mockResolvedValue({ data: [], totalCount: 0 });
  });

  it('renders a list of initial chats', () => {
    const chats = [makeChat(1, 'First chat'), makeChat(2, 'Second chat')];

    render(
      <ChatList initialChats={chats} totalCount={2} organizationId={42} />,
    );
    expect(screen.getByTestId(CHAT_ITEM_1)).toBeInTheDocument();
    expect(screen.getByTestId('chat-item-2')).toBeInTheDocument();
  });

  it('renders the empty state when initialChats is empty', () => {
    render(<ChatList initialChats={[]} totalCount={0} organizationId={42} />);
    expect(screen.getByText(/no chats yet/i)).toBeInTheDocument();
  });

  it('renders a "New" button', () => {
    render(<ChatList initialChats={[]} totalCount={0} organizationId={42} />);
    expect(
      screen.getByRole('button', { name: /new chat/i }),
    ).toBeInTheDocument();
  });

  it('collapses the panel when the ChevronLeft button is clicked', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Chat')]}
        totalCount={1}
        organizationId={42}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /collapse chats panel/i }),
    );
    // After collapse the list should no longer be visible
    expect(screen.queryByTestId(CHAT_ITEM_1)).not.toBeInTheDocument();
  });

  it('expands the panel again after collapsing', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Chat')]}
        totalCount={1}
        organizationId={42}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /collapse chats panel/i }),
    );
    // Collapsed — the CollapsedSidePanel expand button appears
    await userEvent.click(
      screen.getByRole('button', { name: /expand chats panel/i }),
    );
    expect(screen.getByTestId(CHAT_ITEM_1)).toBeInTheDocument();
  });

  it('creates a new chat and prepends it to the list', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Existing')]}
        totalCount={1}
        organizationId={42}
      />,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /new chat/i }));
      await userEvent.click(
        screen.getByRole('button', { name: /create chat/i }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('chat-item-99')).toBeInTheDocument();
    });
    expect(mockCreateChat).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: 42 }),
    );
  });

  it('navigates to the new chat after creation', async () => {
    render(<ChatList initialChats={[]} totalCount={0} organizationId={42} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /new chat/i }));
      await userEvent.click(
        screen.getByRole('button', { name: /create chat/i }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/99'));
    });
  });

  it('shows error toast when createChat fails', async () => {
    const { toast } = jest.requireMock('sonner') as {
      toast: { error: jest.Mock };
    };

    mockCreateChat.mockRejectedValueOnce(new Error('Server error'));
    render(<ChatList initialChats={[]} totalCount={0} organizationId={42} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /new chat/i }));
      await userEvent.click(
        screen.getByRole('button', { name: /create chat/i }),
      );
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('updates a chat title when onUpdate is called', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Old title')]}
        totalCount={1}
        organizationId={42}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'update-1' }));
    expect(screen.getByTestId(CHAT_ITEM_1)).toHaveTextContent('Updated');
  });

  it('removes a chat when onDelete is called', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Chat A'), makeChat(2, 'Chat B')]}
        totalCount={2}
        organizationId={42}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'delete-1' }));
    expect(screen.queryByTestId(CHAT_ITEM_1)).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-item-2')).toBeInTheDocument();
  });

  it('navigates to chat root when the active chat is deleted', async () => {
    render(
      <ChatList
        initialChats={[makeChat(5, 'Active')]}
        totalCount={1}
        activeChatId={5}
        organizationId={42}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'delete-5' }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/chat$/));
  });

  it('does not navigate when a non-active chat is deleted', async () => {
    render(
      <ChatList
        initialChats={[makeChat(1, 'Other'), makeChat(2, 'Active')]}
        totalCount={2}
        activeChatId={2}
        organizationId={42}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'delete-1' }));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
