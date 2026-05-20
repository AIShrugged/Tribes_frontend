import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatMessage } from '@/features/chat/ui/chat-message';

import type { Message } from '@/features/chat/model/types';

// Keep ChatMessageContent simple — its own rendering is tested separately
jest.mock('@/features/chat/ui/chat-message-content', () => {
  return {
    ChatMessageContent: ({ content }: { content: string }) => {
      return <div data-testid='chat-message-content'>{content}</div>;
    },
  };
});

jest.mock('lucide-react', () => {
  return {
    Copy: () => {
      return <span data-testid='copy-icon' />;
    },
    Check: () => {
      return <span data-testid='check-icon' />;
    },
  };
});

const user = userEvent.setup({ delay: null });
const MESSAGE_CONTENT = 'Hello world';
const baseMessage: Message = {
  id: 1,
  chat_id: 10,
  role: 'user',
  status: null,
  content: MESSAGE_CONTENT,
  followup_data: null,
  error_message: null,
  failure_code: null,
  agent_run_uuid: null,
  current_attempt: null,
  max_attempts: null,
  completed_at: null,
  next_retry_at: null,
  created_at: '2024-01-15T12:00:00.000Z',
};

describe('ChatMessage', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue() },
      writable: true,
      configurable: true,
    });
  });

  it('displays the message content', () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByText(MESSAGE_CONTENT)).toBeInTheDocument();
  });

  it('aligns user messages to the right', () => {
    const { container } = render(<ChatMessage message={baseMessage} />);

    expect(container.firstChild).toHaveClass('justify-end');
  });

  it('aligns assistant messages to the left', () => {
    const assistantMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: 'Hi there',
    };
    const { container } = render(<ChatMessage message={assistantMessage} />);

    expect(container.firstChild).toHaveClass('justify-start');
  });

  it('renders ChatMessageContent for assistant messages', () => {
    const assistantMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: 'AI response',
    };

    render(<ChatMessage message={assistantMessage} />);
    expect(screen.getByTestId('chat-message-content')).toBeInTheDocument();
  });

  it('renders plain text directly for user messages', () => {
    render(<ChatMessage message={baseMessage} />);
    expect(
      screen.queryByTestId('chat-message-content'),
    ).not.toBeInTheDocument();
    expect(screen.getByText(MESSAGE_CONTENT)).toBeInTheDocument();
  });

  it('renders a copy button', () => {
    render(<ChatMessage message={baseMessage} />);
    expect(
      screen.getByRole('button', { name: /copy message/i }),
    ).toBeInTheDocument();
  });

  it('shows copy icon by default', () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
  });

  it('shows check icon after clicking copy', async () => {
    render(<ChatMessage message={baseMessage} />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /copy message/i }));
    });
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('calls clipboard.writeText with message content', async () => {
    render(<ChatMessage message={baseMessage} />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /copy message/i }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MESSAGE_CONTENT);
  });

  it('resets back to copy icon after 2 seconds', async () => {
    jest.useFakeTimers();
    render(<ChatMessage message={baseMessage} />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /copy message/i }));
    });
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
