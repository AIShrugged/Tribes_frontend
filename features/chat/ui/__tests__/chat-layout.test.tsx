import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatLayout } from '@/features/chat/ui/chat-layout';

import type { Chat, Message } from '@/features/chat/model/types';

jest.mock('@/features/chat/ui/chat-list', () => {
  return {
    ChatList: ({
      initialChats,
      totalCount,
      activeChatId,
    }: {
      initialChats: Chat[];
      totalCount: number;
      activeChatId?: number;
    }) => {
      return (
        <div data-testid={CHAT_LIST_TESTID}>
          chats:{initialChats.length} total:{totalCount} active:
          {activeChatId ?? 'none'}
        </div>
      );
    },
  };
});

jest.mock('@/features/chat/ui/artifact-panel', () => {
  return {
    ArtifactPanel: ({ chatId }: { chatId: number }) => {
      return <div data-testid={ARTIFACT_PANEL_TESTID}>artifacts:{chatId}</div>;
    },
  };
});

jest.mock('@/features/chat/ui/chat-window', () => {
  return {
    ChatWindow: ({
      chatId,
      onCollapse,
    }: {
      chatId: number;
      onCollapse?: () => void;
    }) => {
      return (
        <div data-testid={CHAT_WINDOW_TESTID}>
          window:{chatId}
          {onCollapse && <button onClick={onCollapse}>collapse</button>}
        </div>
      );
    },
  };
});

jest.mock('@/shared/ui/layout/collapsed-side-panel', () => {
  return {
    CollapsedSidePanel: ({
      label,
      onExpand,
    }: {
      label: string;
      onExpand: () => void;
    }) => {
      return (
        <div data-testid={COLLAPSED_PANEL_TESTID}>
          {label}
          <button onClick={onExpand}>expand</button>
        </div>
      );
    },
  };
});

const makeChat = (id: number): Chat => {
  return {
    id,
    title: `Chat ${id}`,
    organization_id: null,
    team_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
};
const makeMessage = (id: number): Message => {
  return {
    id,
    chat_id: 1,
    role: 'user',
    status: null,
    content: `msg ${id}`,
    followup_data: null,
    error_message: null,
    failure_code: null,
    agent_run_uuid: null,
    current_attempt: null,
    max_attempts: null,
    completed_at: null,
    next_retry_at: null,
    created_at: '2024-01-01T00:00:00Z',
  };
};
const CHAT_LIST_TESTID = 'chat-list';
const ARTIFACT_PANEL_TESTID = 'artifact-panel';
const CHAT_WINDOW_TESTID = 'chat-window';
const COLLAPSED_PANEL_TESTID = 'collapsed-panel';
const defaultProps = {
  initialChats: [makeChat(1), makeChat(2)],
  totalCount: 2,
  activeChatId: 1,
  currentChat: makeChat(1),
  chatId: 1,
  initialArtifacts: null,
  initialMessages: [makeMessage(1)],
  totalMessagesCount: 1,
  startOffset: 0,
  organizationId: 42,
};

describe('ChatLayout', () => {
  it('renders ChatList with correct props', () => {
    render(<ChatLayout {...defaultProps} />);

    expect(screen.getByTestId(CHAT_LIST_TESTID)).toHaveTextContent('chats:2');
    expect(screen.getByTestId(CHAT_LIST_TESTID)).toHaveTextContent('total:2');
    expect(screen.getByTestId(CHAT_LIST_TESTID)).toHaveTextContent('active:1');
  });

  it('renders ArtifactPanel with chatId', () => {
    render(<ChatLayout {...defaultProps} />);

    expect(screen.getByTestId(ARTIFACT_PANEL_TESTID)).toHaveTextContent(
      'artifacts:1',
    );
  });

  it('renders ChatWindow by default (not collapsed)', () => {
    render(<ChatLayout {...defaultProps} />);

    // Component renders ChatWindow in both mobile tab and desktop panel
    expect(screen.getAllByTestId(CHAT_WINDOW_TESTID).length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId(COLLAPSED_PANEL_TESTID),
    ).not.toBeInTheDocument();
  });

  it('collapses chat window when onCollapse is triggered', async () => {
    const user = userEvent.setup();

    render(<ChatLayout {...defaultProps} />);

    // Only the desktop ChatWindow receives onCollapse, so there is exactly one collapse button
    await user.click(screen.getByRole('button', { name: 'collapse' }));

    expect(screen.getByTestId(COLLAPSED_PANEL_TESTID)).toBeInTheDocument();
    // Desktop ChatWindow is replaced by CollapsedSidePanel; mobile tab ChatWindow remains
    expect(screen.getAllByTestId(CHAT_WINDOW_TESTID)).toHaveLength(1);
    // No collapse button should remain (only desktop ChatWindow had it)
    expect(
      screen.queryByRole('button', { name: 'collapse' }),
    ).not.toBeInTheDocument();
  });

  it('expands chat window when onExpand is triggered', async () => {
    const user = userEvent.setup();

    render(<ChatLayout {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'collapse' }));
    await user.click(screen.getByRole('button', { name: 'expand' }));

    expect(screen.getAllByTestId(CHAT_WINDOW_TESTID).length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId(COLLAPSED_PANEL_TESTID),
    ).not.toBeInTheDocument();
  });

  it('CollapsedSidePanel label is Chat', async () => {
    const user = userEvent.setup();

    render(<ChatLayout {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'collapse' }));

    expect(screen.getByTestId(COLLAPSED_PANEL_TESTID)).toHaveTextContent(
      'Chat',
    );
  });
});
