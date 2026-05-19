'use client';

import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { deleteChat } from '@/features/chat/api/chats';
import { ROUTES } from '@/shared/lib/routes';

import type { Chat } from '@/features/chat/model/types';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onEdit?: (chat: Chat) => void;
  onUpdate?: (chat: Chat) => void;
  onDelete: (id: number) => void;
}

/**
 * ChatListItem component.
 * @param props - Component props.
 * @param props.chat - The chat data to display.
 * @param props.isActive - Whether this item is currently selected.
 * @param props.onEdit
 * @param props.onUpdate - Callback when the chat title is updated.
 * @param props.onDelete - Callback when the chat is deleted.
 * @returns Result.
 */
export function ChatListItem({
  chat,
  isActive,
  onEdit,
  onUpdate,
  onDelete,
}: ChatListItemProps) {
  const [mode, setMode] = useState<'idle' | 'confirming-delete'>('idle');
  const [isPending, startTransition] = useTransition();

  // ── Delete handlers ────────────────────────────────────────────────────────

  /**
   * handleDeleteClick.
   * @param e - e.
   * @returns Result.
   */
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMode('confirming-delete');
  };
  /**
   * cancelDelete.
   * @returns Result.
   */
  const cancelDelete = () => {
    return setMode('idle');
  };
  /**
   * confirmDelete.
   * @returns Result.
   */
  const confirmDelete = () => {
    startTransition(async () => {
      try {
        await deleteChat(chat.id);
        onDelete(chat.id);
      } catch (error) {
        toast.error((error as Error).message);
        setMode('idle');
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const href = `${ROUTES.DASHBOARD.CHAT}/${chat.id}`;
  const displayTitle = chat.title ?? 'Untitled chat';
  let scopeLabel: string | null = null;

  if ((chat.organization_id ?? null) !== null) {
    scopeLabel = chat.team_id
      ? `Fixed scope: Org #${chat.organization_id} · Team #${chat.team_id}`
      : `Fixed scope: Org #${chat.organization_id}`;
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50'
      }`}
    >
      {/* ── Confirm delete ── */}
      {mode === 'confirming-delete' && (
        <div className='flex items-center gap-1 flex-1 min-w-0'>
          <span className='flex-1 min-w-0 text-xs text-destructive truncate'>
            Delete?
          </span>
          <button
            type='button'
            onClick={cancelDelete}
            className='p-0.5 text-muted-foreground hover:text-foreground cursor-pointer'
            aria-label='Cancel delete'
          >
            Keep
          </button>
          <button
            type='button'
            onClick={confirmDelete}
            disabled={isPending}
            className='rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40 cursor-pointer disabled:cursor-default'
            aria-label='Confirm delete'
          >
            Delete
          </button>
        </div>
      )}

      {/* ── Idle ── */}
      {mode === 'idle' && (
        <>
          <Link
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className='flex-1 min-w-0'
          >
            <div className='min-w-0 truncate text-sm text-foreground'>
              {displayTitle}
            </div>
            {scopeLabel && (
              <p className='truncate text-xs text-muted-foreground'>
                {scopeLabel}
              </p>
            )}
          </Link>
          {/* opacity-based visibility keeps buttons in tab order for keyboard users */}
          <div className='opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity'>
            <button
              type='button'
              onClick={(event) => {
                event.preventDefault();
                if (onEdit) {
                  onEdit(chat);
                  return;
                }
                onUpdate?.(chat);
              }}
              className='p-0.5 text-muted-foreground hover:text-primary cursor-pointer'
              aria-label={`Edit chat "${displayTitle}"`}
            >
              <Pencil className='w-3.5 h-3.5' />
            </button>
            <button
              type='button'
              onClick={handleDeleteClick}
              className='p-0.5 text-muted-foreground hover:text-destructive cursor-pointer'
              aria-label={`Delete chat "${displayTitle}"`}
            >
              <Trash2 className='w-3.5 h-3.5' />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
