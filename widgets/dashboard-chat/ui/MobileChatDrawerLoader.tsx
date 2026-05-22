import { getChats } from '@/features/chat/api/chats';
import { getMessages } from '@/features/chat/api/messages';

import { MobileChatDrawer } from './MobileChatDrawer';

import type { Message } from '@/features/chat';

const INITIAL_MESSAGES_LIMIT = 20;

/**
 * MobileChatDrawerLoader — server component that fetches initial chat data
 * and renders the MobileChatDrawer client component.
 * Runs in parallel with DashboardChatLoader inside <Suspense> — never blocks the page.
 * @returns JSX element.
 */
export async function MobileChatDrawerLoader() {
  const { data: chats } = await getChats(0, 20);

  const firstChat = chats[0] ?? null;
  let initialMessages: Message[] = [];
  let totalMessagesCount = 0;
  let startOffset = 0;

  if (firstChat) {
    try {
      const { data: oldest, totalCount: msgTotal } = await getMessages(
        firstChat.id,
        0,
        INITIAL_MESSAGES_LIMIT,
      );

      totalMessagesCount = msgTotal;

      if (msgTotal > INITIAL_MESSAGES_LIMIT) {
        startOffset = msgTotal - INITIAL_MESSAGES_LIMIT;
        const { data: newest } = await getMessages(
          firstChat.id,
          startOffset,
          INITIAL_MESSAGES_LIMIT,
        );

        initialMessages = newest;
      } else {
        initialMessages = oldest;
      }
    } catch {
      // silently fail — drawer will show empty state
    }
  }

  return (
    <MobileChatDrawer
      initialChat={firstChat}
      initialMessages={initialMessages}
      totalMessagesCount={totalMessagesCount}
      startOffset={startOffset}
    />
  );
}
