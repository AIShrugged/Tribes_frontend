'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { memo } from 'react';

import { IssuePriorityBadge } from '@/entities/issue';
import {
  type KanbanCardItemProps,
  TYPE_COLORS,
} from '@/features/kanban/model/types';
import { getInitials } from '@/features/kanban/model/utils';
import { ROUTES } from '@/shared/lib/routes';
import Avatar from '@/shared/ui/common/avatar';

export const KanbanCardItem = memo(function KanbanCardItem({
  card,
  isMoving,
  onCardClick,
}: KanbanCardItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeClass =
    TYPE_COLORS[card.type] ?? 'bg-secondary text-secondary-foreground';

  const params = searchParams.toString();
  const from = encodeURIComponent(params ? `${pathname}?${params}` : pathname);
  const detailHref = `${ROUTES.DASHBOARD.ISSUES}/${card.id}?from=${from}`;

  return (
    <div
      draggable
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('a') ?? target.closest('button')) return;
        onCardClick(card);
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData('cardId', String(card.id));
        event.dataTransfer.setData('sourceStatus', card.status);
      }}
      className={[
        'group rounded-[var(--r-lg)] bg-[var(--card)] p-[var(--sp-4)] cursor-grab active:cursor-grabbing transition-all',
        'shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border),var(--shadow-sm)]',
        isMoving ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      <Link
        href={detailHref}
        className='block text-sm font-medium text-foreground hover:text-primary leading-snug mb-2'
      >
        {card.name}
      </Link>
      {card.description ? (
        <p className='text-xs text-muted-foreground line-clamp-2 mb-3'>
          {card.description}
        </p>
      ) : null}
      {card.type || card.epic ? (
        <div className='flex flex-wrap gap-1 mb-3'>
          {card.type ? (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeClass}`}
            >
              {card.type}
            </span>
          ) : null}
          {card.epic ? (
            <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-violet-500/20 text-violet-300 truncate max-w-[140px]'>
              {card.epic.name}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        {card.assignee ? (
          <>
            <Avatar size='xs' className='text-[10px]'>
              {getInitials(card.assignee.name)}
            </Avatar>
            <span className='text-foreground truncate max-w-[120px]'>
              {card.assignee.name}
            </span>
          </>
        ) : null}
        <IssuePriorityBadge
          priority={card.priority}
          status={card.status}
          className='shrink-0'
        />
        <span className='ml-auto text-muted-foreground'>
          {new Date(card.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
});
