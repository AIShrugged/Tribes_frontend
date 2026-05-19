'use client';

import { ChevronLeft, MessageSquare } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { toast } from 'sonner';

import { pollRun, sendMessage } from '@/features/chat/api/messages';
import { useMessages } from '@/features/chat/hooks/use-messages';
import { ChatInput } from '@/features/chat/ui/chat-input';
import { ChatMessage } from '@/features/chat/ui/chat-message';
import { ChatSuggestions } from '@/features/chat/ui/chat-suggestions';
import { ROUTES } from '@/shared/lib/routes';
import { Button, ButtonIcon } from '@/shared/ui/button';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type {
  Chat,
  Message,
  MessageStatus,
  PageContext,
} from '@/features/chat/model/types';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 60; // 90 s timeout
const TERMINAL: ReadonlySet<MessageStatus> = new Set(['completed', 'failed']);

interface ChatWindowProps {
  chat?: Chat;
  chatId: number;
  initialMessages: Message[];
  totalCount: number;
  startOffset: number;
  onCollapse?: () => void;
}

/**
 * ChatWindow component.
 * @param root0 - Component props.
 * @param root0.chat
 * @param root0.chatId - The chat ID to load messages for.
 * @param root0.initialMessages - Pre-loaded messages.
 * @param root0.totalCount - Total message count in the chat.
 * @param root0.startOffset - Offset from which initialMessages were loaded.
 * @param root0.onCollapse - Callback to collapse the chat panel.
 * @returns Result.
 */
export function ChatWindow({
  chat: providedChat,
  chatId,
  initialMessages,
  totalCount,
  startOffset,
  onCollapse,
}: ChatWindowProps) {
  const router = useRouter();
  const chat: Chat = providedChat ?? {
    id: chatId,
    title: null,
    organization_id: null,
    team_id: null,
    created_at: '',
    updated_at: '',
  };
  const {
    messages,
    isLoading,
    hasMore,
    sentinelRef,
    containerRef,
    addMessage,
    updateMessage = () => {},
    removeMessage = () => {},
  } = useMessages(chatId, initialMessages, totalCount, startOffset);
  const searchParams = useSearchParams();
  const [composerError, setComposerError] = useState('');
  // True if there's an in-flight run on initial load (e.g. page refresh mid-generation)
  const [isSending, setIsSending] = useState(() => {
    return initialMessages.some((m) => {
      return (
        m.role === 'assistant' &&
        m.agent_run_uuid !== null &&
        !TERMINAL.has(m.status ?? 'failed')
      );
    });
  });
  // Active run being polled — { messageId, runUuid }
  const activeRunRef = useRef<{ messageId: number; runUuid: string } | null>(
    null,
  );
  const pollAttemptsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref guard prevents concurrent sends — synchronized with isSending state
  const isSendingRef = useRef(isSending);
  // startPolling is defined inside the polling useEffect; exposed via ref so handleSend can call it
  const startPollingRef = useRef<(messageId: number, runUuid: string) => void>(
    () => {},
  );

  // Scroll to bottom on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef]);

  // On mount: resume polling timer for any in-flight run (no setState — isSending
  // is already initialised via lazy useState above to avoid set-state-in-effect)
  useEffect(() => {
    // Effect-local flag — prevents setState after unmount. Using a ref would
    // be reset to true by a re-run before old awaits resolve (ghost poll loop).
    let active = true;

    const schedulePoll = () => {
      pollTimerRef.current = setTimeout(() => {
        void doPoll();
      }, POLL_INTERVAL_MS);
    };

    // eslint-disable-next-line max-statements
    const doPoll = async () => {
      const run = activeRunRef.current;
      if (!run) return;

      pollAttemptsRef.current += 1;

      if (pollAttemptsRef.current > POLL_MAX_ATTEMPTS) {
        if (!active) return;
        updateMessage(run.messageId, {
          status: 'failed',
          error_message: 'Response timed out. Please try again.',
        });
        activeRunRef.current = null;
        isSendingRef.current = false;
        setIsSending(false);
        return;
      }

      try {
        const result = await pollRun(chatId, run.runUuid);
        if (!active) return; // guard after await — component may have unmounted
        if (TERMINAL.has(result.status)) {
          updateMessage(run.messageId, {
            status: result.status,
            content: result.message.content,
            error_message: result.error_message,
            failure_code: result.failure_code,
            current_attempt: result.current_attempt,
            max_attempts: result.max_attempts,
            completed_at: result.completed_at,
          });
          activeRunRef.current = null;
          isSendingRef.current = false;
          setIsSending(false);
        } else {
          // Non-terminal — update status label and continue polling
          updateMessage(run.messageId, {
            status: result.status,
            current_attempt: result.current_attempt,
            max_attempts: result.max_attempts,
            next_retry_at: result.next_retry_at,
          });
          schedulePoll();
        }
      } catch {
        // Network error — keep polling unless max attempts reached
        if (active) schedulePoll();
      }
    };

    const startPolling = (messageId: number, runUuid: string) => {
      activeRunRef.current = { messageId, runUuid };
      pollAttemptsRef.current = 0;
      isSendingRef.current = true;
      setIsSending(true);
      schedulePoll();
    };

    // Expose startPolling for handleSend via a stable ref
    startPollingRef.current = startPolling;

    const pending = initialMessages.findLast((m) => {
      return (
        m.role === 'assistant' &&
        m.agent_run_uuid !== null &&
        !TERMINAL.has(m.status ?? 'failed')
      );
    });

    if (pending?.agent_run_uuid) {
      activeRunRef.current = {
        messageId: pending.id,
        runUuid: pending.agent_run_uuid,
      };
      pollAttemptsRef.current = 0;
      schedulePoll();
    }

    return () => {
      active = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      activeRunRef.current = null;
    };
  }, []);

  const handleSend = (content: string) => {
    // Ref guard is synchronous — prevents concurrent sends under concurrent rendering
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    const pageContext: PageContext = {
      page_text: '',
      page_title: document.title,
      page_url: globalThis.location.href,
    };

    const optimisticId = Date.now();
    const optimistic: Message = {
      id: optimisticId,
      chat_id: chatId,
      role: 'user',
      status: null,
      content,
      followup_data: null,
      error_message: null,
      failure_code: null,
      agent_run_uuid: null,
      current_attempt: null,
      max_attempts: null,
      completed_at: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
    };

    addMessage(optimistic);
    setIsSending(true);
    setComposerError('');

    sendMessage(chatId, content, pageContext)
      .then((result) => {
        if (result.error) {
          removeMessage(optimisticId);
          isSendingRef.current = false;
          setIsSending(false);

          if (result.fieldErrors?.organization_id) {
            setComposerError(
              'Select an organization using the top switcher to continue working in the right context.',
            );
            return;
          }

          toast.error(result.error);
          return;
        }

        const queuedMessage = result.data;

        if (!queuedMessage) {
          removeMessage(optimisticId);
          isSendingRef.current = false;
          setIsSending(false);
          toast.error('Failed to send message');
          return;
        }

        addMessage(queuedMessage);

        if (queuedMessage.agent_run_uuid) {
          startPollingRef.current(
            queuedMessage.id,
            queuedMessage.agent_run_uuid,
          );
        } else {
          isSendingRef.current = false;
          setIsSending(false);
        }
      })
      .catch((error) => {
        toast.error((error as Error).message);
        isSendingRef.current = false;
        setIsSending(false);
      });
  };
  // Auto-send prompt from query param (e.g. ?prompt=...) on empty chat
  const autoPromptFired = useRef(false);
  // useEffectEvent gives a stable reference that always reads the latest handleSend
  // without needing handleSend in the deps array (avoids exhaustive-deps lint error)
  const onAutoPrompt = useEffectEvent((prompt: string) => {
    handleSend(prompt);
  });

  useEffect(() => {
    const prompt = searchParams.get('prompt');

    if (!prompt || autoPromptFired.current || initialMessages.length > 0)
      return;

    autoPromptFired.current = true;

    // Clean URL without triggering navigation
    globalThis.history.replaceState(null, '', globalThis.location.pathname);

    // setTimeout(100): gives the browser one frame to dismiss the keyboard before
    // the input receives focus from handleSend
    setTimeout(() => {
      onAutoPrompt(prompt);
    }, 100);
  }, [searchParams]);

  let fixedScopeLabel: string | null = null;

  if ((chat.organization_id ?? null) !== null) {
    fixedScopeLabel = chat.team_id
      ? `Fixed scope: Org #${chat.organization_id} · Team #${chat.team_id}`
      : `Fixed scope: Org #${chat.organization_id}`;
  }

  return (
    <div className='flex flex-col flex-1 min-h-0'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 h-[var(--topbar-height)] border-b border-border flex-shrink-0'>
        <div className='flex items-center gap-2'>
          {/* Mobile: back to chat list */}
          <Button
            variant='ghost'
            size='xs'
            fullWidth={false}
            leftIcon={<ChevronLeft className='w-4 h-4' />}
            className='md:hidden'
            onClick={() => {
              return router.push(ROUTES.DASHBOARD.CHAT);
            }}
          >
            Chats
          </Button>

          {/* Desktop: icon + label */}
          <MessageSquare className='hidden md:block w-4 h-4 text-primary' />
          {fixedScopeLabel && (
            <div className='hidden md:flex flex-col'>
              <span className='text-xs text-muted-foreground'>
                {fixedScopeLabel}
              </span>
            </div>
          )}
        </div>
        {onCollapse && (
          <ButtonIcon
            aria-label='Collapse chat panel'
            icon={<ChevronLeft className='w-4 h-4' />}
            variant='ghost'
            size='sm'
            onClickAction={onCollapse}
            className='hidden md:flex'
          />
        )}
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className='flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 flex flex-col gap-4'
      >
        {/* Top sentinel — triggers loading older messages */}
        <div ref={sentinelRef} />

        {isLoading && (
          <div className='flex justify-center py-2'>
            <SpinLoader size='sm' />
          </div>
        )}

        {!hasMore && messages.length === 0 && !isSending && (
          <ChatSuggestions onSelect={handleSend} disabled={isSending} />
        )}

        {messages.map((msg) => {
          return <ChatMessage key={msg.id} message={msg} />;
        })}
      </div>

      {/* Input area */}
      <div className='flex-shrink-0 px-4 pb-4 pt-2'>
        {composerError && (
          <div className='mb-3 rounded-[var(--radius-card)] border border-yellow-500/30 bg-yellow-500/10 p-4'>
            <div className='flex items-start gap-3'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium text-foreground'>
                  Select a work context
                </p>
                <p className='mt-2 text-sm text-destructive'>{composerError}</p>
              </div>
            </div>
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={isSending}
          placeholder='Message…'
        />
      </div>
    </div>
  );
}
