'use client';

import { format } from 'date-fns';
import { AlertCircle, Check, Copy } from 'lucide-react';
import React, { useState } from 'react';

import { ChatMessageContent } from '@/features/chat/ui/chat-message-content';

import type { Message } from '@/features/chat/model/types';

interface ChatMessageProps {
  message: Message;
}

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued',
  processing: 'Generating response',
  retrying: 'Retrying…',
};

/**
 * getBubbleClass — returns the CSS class for the message bubble.
 * @param isUser - Whether the message is from the user.
 * @param isFailed - Whether the message failed.
 * @returns CSS class string.
 */
function getBubbleClass(isUser: boolean, isFailed: boolean): string {
  if (isUser) return 'bg-primary text-primary-foreground rounded-tr-sm';

  if (isFailed)
    return 'bg-destructive/10 border border-destructive/30 rounded-tl-sm text-foreground';

  return 'bg-card border border-border rounded-tl-sm text-foreground';
}

/**
 * BubbleContent — renders the inner content of a chat bubble.
 * @param props - Component props.
 * @param props.message - The message to render.
 * @param props.isPending - Whether the message is pending.
 * @param props.isFailed - Whether the message failed.
 * @returns JSX element.
 */
function BubbleContent({
  message,
  isPending,
  isFailed,
}: {
  message: Message;
  isPending: boolean;
  isFailed: boolean;
}) {
  if (message.role === 'user') {
    return <p className='whitespace-pre-wrap break-words'>{message.content}</p>;
  }

  if (isPending) {
    return (
      <PendingIndicator
        label={STEP_LABELS[message.status ?? 'queued'] ?? 'Processing'}
      />
    );
  }

  if (isFailed) {
    return <FailedIndicator errorMessage={message.error_message} />;
  }

  return <ChatMessageContent content={message.content} />;
}

// eslint-disable-next-line complexity
function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isPending =
    message.status === 'queued' ||
    message.status === 'processing' ||
    message.status === 'retrying';
  const isFailed = message.status === 'failed';
  const [copied, setCopied] = useState(false);
  /**
   * copyToClipboard.
   * @returns Promise.
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => {
        return setCopied(false);
      }, 2000);
    } catch {
      // clipboard not available (e.g. non-secure context) — silently ignore
    }
  };

  return (
    <div className={`flex min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        {/* Bubble */}
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed break-words min-w-0 ${getBubbleClass(isUser, isFailed)}`}
        >
          <BubbleContent
            message={message}
            isPending={isPending}
            isFailed={isFailed}
          />
        </div>

        {/* Meta row: time + copy (only for settled messages) */}
        {!isPending && (
          <div
            className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <time className='text-xs text-muted-foreground'>
              {format(new Date(message.created_at), 'HH:mm')}
            </time>
            {!isFailed && (
              <button
                type='button'
                onClick={copyToClipboard}
                className='cursor-pointer text-muted-foreground hover:text-foreground transition-colors'
                aria-label='Copy message'
                title='Copy message'
              >
                {copied ? (
                  <Check className='w-3.5 h-3.5 text-primary' />
                ) : (
                  <Copy className='w-3.5 h-3.5' />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize to skip re-renders during polling — only re-render when content or status changes
export const ChatMessage = React.memo(ChatMessageComponent, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.status === next.message.status
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

interface PendingIndicatorProps {
  label: string;
}

/**
 * PendingIndicator component.
 * @param props - Component props.
 * @param props.label - Status label.
 * @returns JSX element.
 */
function PendingIndicator({ label }: PendingIndicatorProps) {
  return (
    <div className='flex items-center gap-2'>
      <div className='flex items-center gap-0.5'>
        <span
          className='block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce'
          style={{ animationDelay: '0ms' }}
        />
        <span
          className='block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce'
          style={{ animationDelay: '150ms' }}
        />
        <span
          className='block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce'
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span className='text-xs text-muted-foreground/70 select-none'>
        {label}
      </span>
    </div>
  );
}

interface FailedIndicatorProps {
  errorMessage: string | null;
}

/**
 * FailedIndicator component.
 * @param props - Component props.
 * @param props.errorMessage - Error message to display.
 * @returns JSX element.
 */
function FailedIndicator({ errorMessage }: FailedIndicatorProps) {
  return (
    <div className='flex items-start gap-2'>
      <AlertCircle className='w-4 h-4 text-destructive flex-shrink-0 mt-px' />
      <span className='text-sm text-destructive break-words min-w-0'>
        {errorMessage ?? 'Failed to generate a response. Please try again.'}
      </span>
    </div>
  );
}
