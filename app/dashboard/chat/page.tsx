import { MessageSquare } from 'lucide-react';

import { getChats, ChatList } from '@/features/chat';
import { getOrganizations } from '@/features/organization';

/**
 * ChatPage component.
 * @returns JSX element.
 */
export default async function ChatPage() {
  const [{ data: chats, totalCount }, { data: organizations }] =
    await Promise.all([getChats(0, 20), getOrganizations()]);

  return (
    <div className='flex h-full rounded-[var(--radius-card)] overflow-hidden border border-border bg-card '>
      <ChatList
        initialChats={chats}
        totalCount={totalCount}
        organizations={organizations ?? []}
      />

      {/* Empty state — hidden on mobile (ChatList fills screen) */}
      <div className='hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground'>
        <MessageSquare
          className='w-12 h-12 text-muted-foreground/40'
          aria-hidden='true'
        />
        <p className='text-sm'>Select a chat or create a new one</p>
      </div>
    </div>
  );
}
