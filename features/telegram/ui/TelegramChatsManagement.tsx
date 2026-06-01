'use client';

import { MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/feedback/empty-state';

import { AddTelegramChatModal } from './add-telegram-chat-modal';
import { TelegramChatCard } from './telegram-chat-card';

import type { TelegramChatRegistration } from '@/entities/telegram';

interface TelegramChatsManagementProps {
  initialChats: TelegramChatRegistration[];
  selectedOrganizationId: number;
  orgMap: Record<number, string>;
  botUsername: string;
}

export function TelegramChatsManagement({
  initialChats,
  selectedOrganizationId,
  orgMap,
  botUsername,
}: TelegramChatsManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-foreground'>
            Telegram chats
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Register your Telegram group chats to connect them with your
            organization.
          </p>
        </div>
        <Button
          type='button'
          fullWidth={false}
          className='shrink-0'
          onClick={() => {
            setIsModalOpen(true);
          }}
        >
          <Plus className='h-4 w-4' />
          Add chat
        </Button>
      </div>

      <AddTelegramChatModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        selectedOrganizationId={selectedOrganizationId}
        botUsername={botUsername}
      />

      {initialChats.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title='No Telegram chats registered'
          description='Add a group chat above to connect it with your organization.'
        />
      ) : (
        initialChats.map((chat) => {
          return (
            <TelegramChatCard
              key={chat.id}
              chat={chat}
              orgName={
                chat.organization_id
                  ? (orgMap[chat.organization_id] ?? null)
                  : null
              }
              onDelete={() => {
                toast.success('Chat removed');
              }}
            />
          );
        })
      )}
    </div>
  );
}
