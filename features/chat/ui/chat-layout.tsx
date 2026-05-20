'use client';

import { Sparkles } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { ArtifactPanel } from '@/features/chat/ui/artifact-panel';
import { ChatList } from '@/features/chat/ui/chat-list';
import { ChatWindow } from '@/features/chat/ui/chat-window';
import { CollapsedSidePanel } from '@/shared/ui/layout/collapsed-side-panel';

import type { OrganizationProps } from '@/entities/organization';
import type {
  ArtifactsResponse,
  Chat,
  Message,
} from '@/features/chat/model/types';

type MobileTab = 'chats' | 'artifacts' | 'chat';

interface ChatLayoutProps {
  initialChats: Chat[];
  totalCount: number;
  activeChatId?: number;
  currentChat?: Chat;
  chatId: number;
  initialArtifacts: ArtifactsResponse | null;
  initialMessages: Message[];
  totalMessagesCount: number;
  startOffset: number;
  organizations?: OrganizationProps[];
}

/**
 * ChatLayout component.
 * @param root0 - Component props.
 * @param root0.initialChats - Initial list of chats.
 * @param root0.totalCount - Total number of chats.
 * @param root0.activeChatId - ID of the currently active chat.
 * @param root0.currentChat
 * @param root0.chatId - ID of the chat to display in the window.
 * @param root0.initialArtifacts - Pre-loaded artifacts for the chat.
 * @param root0.initialMessages - Pre-loaded messages for the chat.
 * @param root0.totalMessagesCount - Total message count in the chat.
 * @param root0.startOffset - Offset from which initialMessages were loaded.
 * @param root0.organizations
 * @returns Result.
 */
export function ChatLayout({
  initialChats,
  totalCount,
  activeChatId,
  currentChat,
  chatId,
  initialArtifacts,
  initialMessages,
  totalMessagesCount,
  startOffset,
  organizations = [],
}: ChatLayoutProps) {
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const ARTIFACTS_MIN_WIDTH = 240;
  const ARTIFACTS_MAX_WIDTH = 960;
  const ARTIFACTS_DEFAULT_WIDTH = 360;
  const [artifactsWidth, setArtifactsWidth] = useState(ARTIFACTS_DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = artifactsWidth;

      /**
       *
       * @param ev
       */
      const onMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = ev.clientX - dragStartXRef.current;
        const next = Math.min(
          ARTIFACTS_MAX_WIDTH,
          Math.max(ARTIFACTS_MIN_WIDTH, dragStartWidthRef.current + delta),
        );

        setArtifactsWidth(next);
      };
      /**
       *
       */
      const onMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [artifactsWidth],
  );
  const [chat, setChat] = useState<Chat>(
    currentChat ?? {
      id: chatId,
      title: null,
      organization_id: null,
      team_id: null,
      created_at: '',
      updated_at: '',
    },
  );

  return (
    <div className='flex flex-col h-full rounded-[var(--radius-card)] overflow-hidden border border-border bg-card'>
      {/* ── Mobile tab bar (< lg): Chats | Artifacts | Chat ── */}
      <nav
        role='tablist'
        aria-label='Chat navigation'
        className='flex lg:hidden border-b border-border flex-shrink-0'
      >
        <button
          type='button'
          role='tab'
          aria-selected={mobileTab === 'chats'}
          aria-controls='mobile-panel-chats'
          className={[
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            mobileTab === 'chats'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
          onClick={() => {
            return setMobileTab('chats');
          }}
        >
          Chats
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={mobileTab === 'artifacts'}
          aria-controls='mobile-panel-artifacts'
          className={[
            'flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            mobileTab === 'artifacts'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
          onClick={() => {
            return setMobileTab('artifacts');
          }}
        >
          <Sparkles className='w-3.5 h-3.5' />
          Artifacts
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={mobileTab === 'chat'}
          aria-controls='mobile-panel-chat'
          className={[
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            mobileTab === 'chat'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
          onClick={() => {
            return setMobileTab('chat');
          }}
        >
          Chat
        </button>
      </nav>

      {/* ── Main body ────────────────────────────────────────────────── */}
      <div className='flex flex-1 min-h-0'>
        {/* Chat list sidebar — desktop only (lg+); on mobile shown via tab */}
        <div className='hidden lg:flex flex-col h-full'>
          <ChatList
            initialChats={initialChats}
            totalCount={totalCount}
            activeChatId={activeChatId}
            organizations={organizations}
            onActiveChatUpdate={setChat}
          />
        </div>

        {/* ── Mobile/tablet (< lg): one panel at a time via tabs ── */}
        <div className='flex lg:hidden flex-1 min-w-0 flex-col min-h-0'>
          {mobileTab === 'chats' && (
            <div id='mobile-panel-chats' className='flex flex-1 min-h-0'>
              <ChatList
                initialChats={initialChats}
                totalCount={totalCount}
                activeChatId={activeChatId}
                organizations={organizations}
                onActiveChatUpdate={(updated) => {
                  setChat(updated);
                  setMobileTab('chat');
                }}
              />
            </div>
          )}
          {mobileTab === 'artifacts' && (
            <div id='mobile-panel-artifacts' className='flex flex-1 min-h-0'>
              <ArtifactPanel
                chatId={chatId}
                initialArtifacts={initialArtifacts}
              />
            </div>
          )}
          {mobileTab === 'chat' && (
            <div id='mobile-panel-chat' className='flex flex-1 min-h-0'>
              <ChatWindow
                chat={chat}
                chatId={chatId}
                initialMessages={initialMessages}
                totalCount={totalMessagesCount}
                startOffset={startOffset}
              />
            </div>
          )}
        </div>

        {/* ── Desktop (lg+): Artifacts then Chat side by side ── */}
        <div
          className='hidden lg:flex flex-shrink-0 flex-col min-h-0'
          style={{ width: artifactsWidth }}
        >
          <ArtifactPanel chatId={chatId} initialArtifacts={initialArtifacts} />
        </div>

        {/* Drag divider */}
        <div
          className='hidden lg:flex w-1 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors active:bg-primary/60 select-none'
          onMouseDown={handleDividerMouseDown}
        />

        {isChatCollapsed ? (
          <CollapsedSidePanel
            label='Chat'
            icon='right'
            className='hidden lg:flex border-r border-border'
            onExpand={() => {
              setIsChatCollapsed(false);
            }}
          />
        ) : (
          <div className='hidden lg:flex flex-1 min-w-0 flex-col min-h-0'>
            <ChatWindow
              chat={chat}
              chatId={chatId}
              initialMessages={initialMessages}
              totalCount={totalMessagesCount}
              startOffset={startOffset}
              onCollapse={() => {
                setIsChatCollapsed(true);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
