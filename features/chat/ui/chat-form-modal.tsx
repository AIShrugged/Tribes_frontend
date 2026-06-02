'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { createChat, updateChat } from '@/features/chat/api/chats';
import { UpdateChatSchema } from '@/features/chat/model/schemas';
import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Input from '@/shared/ui/input/Input';
import { Modal } from '@/shared/ui/modal/modal';

import type { OrganizationProps } from '@/entities/organization';
import type { Chat } from '@/features/chat/model/types';
import type { UseFormSetError } from 'react-hook-form';

// Create schema uses the same string type but title is optional (nullable on submit)
const CreateChatFormSchema = z.object({
  title: z.string().max(255),
});

interface ChatFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: OrganizationProps[];
  organizationId: number;
  chat?: Chat | null;
  onSaved: (chat: Chat, mode: 'create' | 'update') => void;
}

interface ChatFormValues {
  title: string;
}

const EMPTY_VALUES: ChatFormValues = {
  title: '',
};

function getChatDefaultValues(chat?: Chat | null): ChatFormValues {
  return chat ? { title: chat.title ?? '' } : EMPTY_VALUES;
}

function getChatFormSchema(isEdit: boolean) {
  return isEdit ? UpdateChatSchema : CreateChatFormSchema;
}

function hasChatAssignedScope(chat?: Chat | null): boolean {
  return (
    (chat?.organization_id ?? null) !== null || (chat?.team_id ?? null) !== null
  );
}

function saveChat(
  chat: Chat | null | undefined,
  organizationId: number,
  values: ChatFormValues,
) {
  const payload = {
    title: values.title.trim() || null,
    organization_id: organizationId,
  };

  return chat ? updateChat(chat.id, payload) : createChat(payload);
}

function getSaveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to save chat';
}

function applyChatFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  setError: UseFormSetError<ChatFormValues>,
) {
  if (!fieldErrors) return;

  const titleError = fieldErrors.title;

  if (titleError) {
    setError('title', { message: titleError });
  }
}

function getChatHelperText({
  chat,
  hasAssignedScope,
  hasOrganizationContext,
  isEdit,
}: {
  chat?: Chat | null;
  hasAssignedScope: boolean;
  hasOrganizationContext: boolean;
  isEdit: boolean;
}) {
  if (isEdit && hasAssignedScope) {
    return chat?.team_id
      ? `This chat has a fixed scope: Org #${chat.organization_id} · Team #${chat.team_id}.`
      : `This chat has a fixed scope: Org #${chat?.organization_id}.`;
  }

  return `Personal web chats are not permanently bound. They use the current ${
    hasOrganizationContext
      ? 'organization context selected in the app header.'
      : 'user context.'
  }`;
}

/**
 * ChatFormModal renders create/edit flow for personal web chats.
 * @param props - component props.
 * @param props.isOpen
 * @param props.onClose
 * @param props.organizations
 * @param props.chat
 * @param props.onSaved
 * @returns JSX element.
 */
export function ChatFormModal({
  isOpen,
  onClose,
  organizations,
  organizationId,
  chat,
  onSaved,
}: ChatFormModalProps) {
  const isEdit = Boolean(chat);
  const hasOrganizationContext = organizations.length > 0;
  const hasAssignedScope = hasChatAssignedScope(chat);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rootError, setRootError] = useState('');
  const defaultValues = useMemo(() => {
    return getChatDefaultValues(chat);
  }, [chat]);
  const schema = getChatFormSchema(isEdit);
  const {
    register,
    watch,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ChatFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      setRootError('');
    }
  }, [defaultValues, isOpen, reset]);

  /**
   * onSubmit.
   * @param values - form values.
   * @returns Result.
   */
  const onSubmit = async (values: ChatFormValues) => {
    setRootError('');
    setIsSubmitting(true);

    try {
      const result = await saveChat(chat, organizationId, values);

      if (result.error) {
        applyChatFieldErrors(result.fieldErrors, setError);
        setRootError(result.error);

        return;
      }

      toast.success(isEdit ? 'Chat updated' : 'Chat created');
      onSaved(result.data!, isEdit ? 'update' : 'create');
      onClose();
    } catch (error) {
      const message = getSaveErrorMessage(error);

      setRootError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const helperText = getChatHelperText({
    chat,
    hasAssignedScope,
    hasOrganizationContext,
    isEdit,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit chat' : 'Create chat'}
    >
      <form className='flex flex-col gap-4' onSubmit={handleSubmit(onSubmit)}>
        <Input
          {...register('title', {
            /**
             *
             */
            onChange: () => {
              clearErrors('title');
              setRootError('');
            },
          })}
          label='Title'
          value={watch('title')}
          error={errors.title?.message}
        />

        {rootError ? (
          <p className='text-sm text-destructive'>{rootError}</p>
        ) : null}
        {rootError ? null : (
          <p className='text-xs text-muted-foreground'>{helperText}</p>
        )}

        <div className='flex gap-3 pt-2'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.secondary}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type='submit' loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create chat'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
