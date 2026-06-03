'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createTelegramWorkspaceChat } from '@/features/telegram/api/telegram';
import {
  addTelegramChatSchema,
  type AddTelegramChatFormInput,
  type AddTelegramChatFormValues,
} from '@/features/telegram/model/schemas';
import { Button } from '@/shared/ui/button';
import Input from '@/shared/ui/input/Input';
import { Modal } from '@/shared/ui/modal/modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedOrganizationId: number;
  botUsername: string;
}

export function AddTelegramChatModal({
  isOpen,
  onClose,
  selectedOrganizationId,
  botUsername,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddTelegramChatFormInput, unknown, AddTelegramChatFormValues>({
    resolver: zodResolver(addTelegramChatSchema),
    defaultValues: {
      name: '',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: AddTelegramChatFormValues) => {
    startTransition(async () => {
      const result = await createTelegramWorkspaceChat({
        telegram_chat_id: values.telegram_chat_id,
        message_thread_id: values.message_thread_id ?? null,
        organization_id: selectedOrganizationId,
        // Without a Teams UI, chats are bound to the org's default team server-side.
        team_id: null,
        name: values.name ?? null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data?.is_bound
          ? 'Chat registered and bot is already active'
          : 'Chat registered — add the bot to activate it',
      );
      handleClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Add Telegram chat'
      size='md'
    >
      <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Input
            {...register('telegram_chat_id', {
              setValueAs: (v: string) => {
                return v === '' ? undefined : Number.parseInt(v, 10);
              },
            })}
            label='Telegram Chat ID'
            type='number'
            value={String(watch('telegram_chat_id') ?? '')}
            placeholder='-1003888134038'
            error={errors.telegram_chat_id?.message}
            disabled={isPending}
          />
          <div className='flex flex-col gap-1'>
            <Input
              {...register('message_thread_id', {
                setValueAs: (v: string) => {
                  return v === '' ? undefined : Number.parseInt(v, 10);
                },
              })}
              label='Topic ID'
              type='number'
              value={String(watch('message_thread_id') ?? '')}
              placeholder='e.g. 336'
              error={errors.message_thread_id?.message}
              disabled={isPending}
            />
            <p className='px-1 text-xs text-muted-foreground'>
              Leave empty to connect the entire chat
            </p>
          </div>
          <Input
            {...register('name')}
            label='Chat name (optional)'
            value={watch('name') ?? ''}
            placeholder='Auto-detected if bot is in the chat'
            error={errors.name?.message}
            disabled={isPending}
          />
        </div>

        <div className='rounded-[var(--radius-card)] border border-border bg-background/40 p-4 text-sm text-muted-foreground'>
          <p className='font-medium text-foreground'>
            How to find your Telegram Chat ID
          </p>
          <ol className='mt-2 flex flex-col gap-1 ps-4 [list-style:decimal]'>
            <li>
              Forward a message from the group to{' '}
              <span className='font-mono text-foreground'>@userinfobot</span> —
              it will reply with the chat ID
            </li>
            <li>Enter the ID above and save</li>
            <li>
              Add{' '}
              <span className='font-mono text-foreground'>@{botUsername}</span>{' '}
              as an administrator to the group
            </li>
            <li>
              Status will automatically change to{' '}
              <span className='font-medium text-foreground'>Active</span>
            </li>
          </ol>
        </div>

        <div className='flex justify-end gap-2 pt-2'>
          <Button
            type='button'
            variant='secondary'
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type='submit' loading={isPending} loadingText='Saving…'>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
