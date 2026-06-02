'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';

import { deleteTelegramWorkspaceChat } from '@/features/telegram/api/telegram';
import { Badge } from '@/shared/ui/badge';
import { Button, ButtonIcon } from '@/shared/ui/button';
import { Card, CardBody } from '@/shared/ui/card';

import type { TelegramChatRegistration } from '@/entities/telegram';

interface TelegramChatCardProps {
  chat: TelegramChatRegistration;
  orgName: string | null;
  onDelete: () => void;
}

function formatChatType(type: string | null): string {
  if (!type) return 'Unknown';
  if (type === 'supergroup') return 'Supergroup';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function ChatStatusBadge({ chat }: { chat: TelegramChatRegistration }) {
  if (chat.chat_type === 'private') {
    return <Badge variant='default'>Private</Badge>;
  }
  return chat.is_bound ? (
    <Badge variant='success' dot>
      Active
    </Badge>
  ) : (
    <Badge variant='warning' dot>
      Waiting for bot
    </Badge>
  );
}

export function TelegramChatCard({
  chat,
  orgName,
  onDelete,
}: TelegramChatCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isDeletingRef = useRef(false);

  const title =
    chat.chat_title?.trim() || `Telegram chat #${chat.telegram_chat_id}`;
  const topicLabel =
    chat.topic_label?.trim() ||
    (chat.message_thread_id ? `Topic #${chat.message_thread_id}` : null);
  const subtitle = topicLabel
    ? `${formatChatType(chat.chat_type)} · ${topicLabel}`
    : formatChatType(chat.chat_type);
  const canDelete = chat.chat_type !== 'private';

  const handleConfirmDelete = () => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;

    startTransition(async () => {
      try {
        const result = await deleteTelegramWorkspaceChat(chat.id);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        onDelete();
        toast.success('Chat removed');
      } finally {
        isDeletingRef.current = false;
        setIsConfirming(false);
      }
    });
  };

  return (
    <Card>
      <CardBody>
        <div className='flex flex-col gap-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h3 className='truncate text-base font-semibold text-foreground'>
                {title}
              </h3>
              <p className='text-sm text-muted-foreground'>{subtitle}</p>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              <ChatStatusBadge chat={chat} />
              {canDelete && !isConfirming ? (
                <ButtonIcon
                  icon={<Trash2 className='h-4 w-4' />}
                  aria-label='Remove chat'
                  variant='danger'
                  onClickAction={() => {
                    setIsConfirming(true);
                  }}
                />
              ) : null}
              {isConfirming ? (
                <div className='flex items-center gap-2'>
                  <p className='whitespace-nowrap text-sm text-muted-foreground'>
                    Remove?
                  </p>
                  <Button
                    type='button'
                    variant='danger'
                    size='sm'
                    loading={isPending}
                    loadingText='Removing…'
                    onClick={handleConfirmDelete}
                  >
                    Remove
                  </Button>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    disabled={isPending}
                    onClick={() => {
                      setIsConfirming(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4'>
            <p>
              <span className='text-foreground/60'>Telegram ID:</span>{' '}
              {chat.telegram_chat_id}
            </p>
            {topicLabel ? (
              <p>
                <span className='text-foreground/60'>Topic:</span> {topicLabel}
              </p>
            ) : null}
            <p>
              <span className='text-foreground/60'>Organization:</span>{' '}
              {orgName ??
                (chat.organization_id ? `Org #${chat.organization_id}` : '—')}
            </p>
            <p>
              <span className='text-foreground/60'>Team:</span>{' '}
              {chat.team_id ? `Team #${chat.team_id}` : '—'}
            </p>
            <p>
              <span className='text-foreground/60'>Registered:</span>{' '}
              {new Date(chat.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {!chat.is_bound && chat.chat_type !== 'private' ? (
            <div className='rounded-[var(--radius-card)] border border-warning/20 bg-warning/10 p-4 text-sm'>
              <p className='font-medium text-foreground'>
                Bot not yet in group
              </p>
              <p className='mt-1 text-muted-foreground'>
                Add the bot as an administrator to the Telegram group for this
                chat to become active.
              </p>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
