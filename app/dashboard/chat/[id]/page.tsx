import { notFound } from 'next/navigation';

import { getArtifacts } from '@/entities/artifact';
import { ChatLayout, getChat, getChats, getMessages } from '@/features/chat';
import { getOrganizations } from '@/features/organization';
import { getOrganizationId } from '@/shared/lib/getOrganizationId';

import type { PageProps } from '@/shared/types/common';

/**
 * ChatRoomPage component.
 * @param props - Component props.
 * @param props.params
 */
export default async function ChatRoomPage({ params }: PageProps) {
  const { id } = await params;
  const chatId = Number(id);

  if (!Number.isFinite(chatId) || chatId <= 0) notFound();

  const INITIAL_LIMIT = 20;
  const [{ data: organizations }, organizationId] = await Promise.all([
    getOrganizations(),
    getOrganizationId(),
  ]);
  const [
    chatListResult,
    currentChat,
    { data: oldest, totalCount: msgTotal },
    artifacts,
  ] = await Promise.all([
    getChats(organizationId, 0, 20).catch(() => {
      return { data: [], totalCount: 0, hasMore: false };
    }),
    getChat(chatId),
    getMessages(chatId, 0, INITIAL_LIMIT),
    getArtifacts(chatId).catch(() => {
      return null;
    }),
  ]);
  const { data: chats, totalCount } = chatListResult;
  // API returns messages oldest-first (ASC by created_at).
  // If there are more messages than INITIAL_LIMIT, fetch from the end
  // so the user sees the newest messages on open.
  let initialMessages = oldest;
  let startOffset = 0;

  if (msgTotal > INITIAL_LIMIT) {
    startOffset = msgTotal - INITIAL_LIMIT;
    const { data: newest } = await getMessages(
      chatId,
      startOffset,
      INITIAL_LIMIT,
    );

    initialMessages = newest;
  }

  return (
    <ChatLayout
      initialChats={chats}
      totalCount={totalCount}
      activeChatId={chatId}
      currentChat={currentChat}
      chatId={chatId}
      initialArtifacts={artifacts}
      initialMessages={initialMessages}
      totalMessagesCount={msgTotal}
      startOffset={startOffset}
      organizations={organizations ?? []}
      organizationId={organizationId}
    />
  );
}
