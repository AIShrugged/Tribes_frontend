'use client';

import { MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { createChat } from '@/features/chat/api/chats';
import { ChatWindow } from '@/features/chat/ui/chat-window';

import type { Chat, Message } from '@/features/chat/model/types';

interface DashboardChatPanelProps {
  initialChat: Chat | null;
  initialMessages: Message[];
  totalMessagesCount: number;
  startOffset: number;
}

/**
 * DashboardChatPanel — sidebar chat panel for the main dashboard layout.
 * Shows only the active chat window (first chat by default).
 * @param root0 - Component props.
 * @param root0.initialChat - The chat to display initially.
 * @param root0.initialMessages - Pre-loaded messages for the initial chat.
 * @param root0.totalMessagesCount - Total message count.
 * @param root0.startOffset - Offset from which initialMessages were loaded.
 * @returns JSX element.
 */
export function DashboardChatPanel({
  initialChat,
  initialMessages,
  totalMessagesCount,
  startOffset,
}: DashboardChatPanelProps) {
  const [activeChat, setActiveChat] = useState<Chat | null>(initialChat);
  const [activeChatMessages, setActiveChatMessages] =
    useState<Message[]>(initialMessages);
  const [activeChatTotal, setActiveChatTotal] = useState(totalMessagesCount);
  const [activeChatOffset, setActiveChatOffset] = useState(startOffset);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChat = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createChat({});
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setActiveChat(result.data);
      setActiveChatMessages([]);
      setActiveChatTotal(0);
      setActiveChatOffset(0);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className='flex h-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-card'>
      <div className='flex flex-1 min-w-0 flex-col min-h-0'>
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            chatId={activeChat.id}
            initialMessages={activeChatMessages}
            totalCount={activeChatTotal}
            startOffset={activeChatOffset}
          />
        ) : (
          <div className='flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground'>
            <MessageSquare
              className='w-10 h-10 text-muted-foreground/30'
              aria-hidden='true'
            />
            <p className='text-sm text-center px-4'>No chats yet</p>
            <button
              onClick={handleCreateChat}
              disabled={isCreating}
              className='flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-40'
            >
              <Plus className='w-3 h-3' />
              New chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
