import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatListItem } from '@/features/chat/ui/chat-list-item';

const mockDeleteChat = jest.fn();

jest.mock('@/features/chat/api/chats', () => {
  return {
    deleteChat: (...args: unknown[]) => {
      return mockDeleteChat(...args);
    },
  };
});

jest.mock('sonner', () => {
  return {
    toast: { error: jest.fn(), success: jest.fn() },
  };
});

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
    }: React.PropsWithChildren<{ href: string }>) => {
      return <a href={href}>{children}</a>;
    },
  };
});

const makeChat = (overrides = {}) => {
  return {
    id: 1,
    title: 'My Chat',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
};

describe('ChatListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteChat.mockResolvedValue({});
  });

  // ── Idle mode ────────────────────────────────────────────────────────────

  it('renders the chat title as a link in idle mode', () => {
    render(
      <ChatListItem
        chat={makeChat()}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'My Chat' }),
    ).toBeInTheDocument();
  });

  it('renders "Untitled chat" when title is null', () => {
    render(
      <ChatListItem
        chat={makeChat({ title: null })}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText('Untitled chat')).toBeInTheDocument();
  });

  it('link has correct href', () => {
    render(
      <ChatListItem
        chat={makeChat({ id: 42 })}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/dashboard/chat/42',
    );
  });

  it('applies active styles when isActive is true', () => {
    const { container } = render(
      <ChatListItem
        chat={makeChat()}
        isActive={true}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass('bg-sidebar-accent');
  });

  it('renders fixed-scope label when chat is attached to an organization', () => {
    render(
      <ChatListItem
        chat={makeChat({ organization_id: 7 })}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText('Fixed scope: Org #7')).toBeInTheDocument();
  });

  // ── Edit action ──────────────────────────────────────────────────────────

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = jest.fn();
    const onUpdate = jest.fn();

    render(
      <ChatListItem
        chat={makeChat()}
        isActive={false}
        onEdit={onEdit}
        onUpdate={onUpdate}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit chat/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('falls back to onUpdate when onEdit is not provided', async () => {
    const onUpdate = jest.fn();

    render(
      <ChatListItem
        chat={makeChat()}
        isActive={false}
        onUpdate={onUpdate}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit chat/i }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  // ── Delete confirmation mode ─────────────────────────────────────────────

  it('switches to confirming-delete mode when delete button clicked', async () => {
    render(
      <ChatListItem
        chat={makeChat()}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete chat/i }));
    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  it('cancel delete returns to idle', async () => {
    render(
      <ChatListItem
        chat={makeChat()}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete chat/i }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel delete' }),
    );
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('confirm delete calls deleteChat and onDelete', async () => {
    const onDelete = jest.fn();

    render(
      <ChatListItem
        chat={makeChat({ id: 5 })}
        isActive={false}
        onUpdate={jest.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete chat/i }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    );
    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith(5);
      expect(onDelete).toHaveBeenCalledWith(5);
    });
  });
});
