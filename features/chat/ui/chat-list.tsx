'use client';

import { ChevronLeft, MessageSquare, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getChats } from '@/features/chat/api/chats';
import { ChatFormModal } from '@/features/chat/ui/chat-form-modal';
import { ChatListItem } from '@/features/chat/ui/chat-list-item';
import { ROUTES } from '@/shared/lib/routes';
import { CollapsedSidePanel } from '@/shared/ui/layout/collapsed-side-panel';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { OrganizationProps } from '@/entities/organization';
import type { Chat } from '@/features/chat/model/types';

interface ChatListProps {
  initialChats: Chat[];
  totalCount: number;
  activeChatId?: number;
  organizations?: OrganizationProps[];
  organizationId: number;
  onActiveChatUpdate?: (chat: Chat) => void;
}

const PAGE_SIZE = 20;

/**
 * ChatList component.
 * @param root0 - Component props.
 * @param root0.initialChats - Initial list of chats.
 * @param root0.totalCount - Total number of chats available.
 * @param root0.activeChatId - ID of the currently active chat.
 * @param root0.organizations
 * @param root0.onActiveChatUpdate
 * @returns Result.
 */
// eslint-disable-next-line max-statements
export function ChatList({
  initialChats,
  totalCount,
  activeChatId,
  organizations = [],
  organizationId,
  onActiveChatUpdate,
}: ChatListProps) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [offset, setOffset] = useState(initialChats.length);
  const [hasMore, setHasMore] = useState(initialChats.length < totalCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Single modal instance handles both create (editingChat=null) and edit modes
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Generation counter: incremented on every org/data reset so in-flight
  // loadMore calls from a previous org can detect they are stale and discard results.
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    setChats(initialChats);
    setOffset(initialChats.length);
    setHasMore(initialChats.length < totalCount);
    setIsLoading(false);
  }, [initialChats, totalCount]);

  /**
   * loadMore.
   * @returns Promise.
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    const generation = generationRef.current;
    setIsLoading(true);
    try {
      const { data: more, totalCount: total } = await getChats(
        organizationId,
        offset,
        PAGE_SIZE,
      );

      if (generationRef.current !== generation) return;
      setChats((prev) => {
        return [...prev, ...more];
      });
      setOffset((prev) => {
        return prev + more.length;
      });
      // Guard against infinite loop: if server returns 0 items, stop paginating
      setHasMore(more.length > 0 && offset + more.length < total);
    } catch {
      toast.error('Failed to load more chats. Try again.');
    } finally {
      if (generationRef.current === generation) setIsLoading(false);
    }
  }, [isLoading, hasMore, organizationId, offset]);

  // Keep a stable ref so the observer never needs to be recreated — prevents
  // the double-fire bug in React 19 where IntersectionObserver re-fires on every re-observe().
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRef.current().catch(() => {});
      },
      { rootMargin: '20px' },
    );

    observer.observe(sentinelRef.current);

    return () => {
      return observer.disconnect();
    };
  }, []);

  /**
   *
   * @param updated
   */
  const handleUpdate = (updated: Chat) => {
    setChats((prev) => {
      return prev.map((c) => {
        return c.id === updated.id ? updated : c;
      });
    });

    if (updated.id === activeChatId) {
      onActiveChatUpdate?.(updated);
    }
  };
  /**
   * handleDelete.
   * @param id - id.
   * @returns Result.
   */
  const handleDelete = (id: number) => {
    setChats((prev) => {
      return prev.filter((c) => {
        return c.id !== id;
      });
    });

    if (id === activeChatId) {
      router.push(ROUTES.DASHBOARD.CHAT);
    }
  };
  /**
   * handleSavedChat.
   * @param chat - saved chat.
   * @param mode - create or update.
   * @returns Result.
   */
  const handleSavedChat = (chat: Chat, mode: 'create' | 'update') => {
    if (mode === 'create') {
      setChats((prev) => {
        return [chat, ...prev];
      });
      router.push(`${ROUTES.DASHBOARD.CHAT}/${chat.id}`);

      return;
    }

    handleUpdate(chat);
  };

  // ── Collapsed state ──────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <CollapsedSidePanel
        label='Chats'
        onExpand={() => {
          return setIsCollapsed(false);
        }}
      />
    );
  }

  // ── Open state ───────────────────────────────────────────────────────────────
  return (
    <div className='flex flex-col h-full w-full md:w-[260px] flex-shrink-0 border-r border-border bg-sidebar'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 h-[var(--topbar-height)] border-b border-border flex-shrink-0'>
        <div className='flex items-center gap-2'>
          <MessageSquare className='w-4 h-4 text-primary' />
          <span className='text-sm font-semibold text-foreground'>Chats</span>
        </div>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={() => {
              setEditingChat(null);
              setIsModalOpen(true);
            }}
            className='flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity cursor-pointer'
            aria-label='New chat'
          >
            <Plus className='w-3.5 h-3.5' />
            New
          </button>
          <button
            type='button'
            onClick={() => {
              return setIsCollapsed(true);
            }}
            className='p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer'
            aria-label='Collapse chats panel'
          >
            <ChevronLeft className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* List */}
      <div className='flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5'>
        {chats.length === 0 && !isLoading && (
          <p className='text-xs text-muted-foreground text-center py-8'>
            No chats yet. Create your first one!
          </p>
        )}

        {chats.map((chat) => {
          return (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onEdit={(chat) => {
                setEditingChat(chat);
                setIsModalOpen(true);
              }}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          );
        })}

        {/* Bottom sentinel for pagination */}
        <div ref={sentinelRef} />

        {isLoading && (
          <div className='flex justify-center py-2'>
            <SpinLoader size='sm' />
          </div>
        )}
      </div>
      {isModalOpen && (
        <ChatFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingChat(null);
          }}
          organizations={organizations}
          organizationId={organizationId}
          chat={editingChat}
          onSaved={handleSavedChat}
        />
      )}
    </div>
  );
}
