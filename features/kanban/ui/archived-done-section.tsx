'use client';

import { format } from 'date-fns';
import Link from 'next/link';

import { issueHrefSegment } from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import SpinLoader from '@/shared/ui/layout/spin-loader';

import type { KanbanCard } from '@/features/kanban/model/types';

interface ArchivedDoneSectionProps {
  cards: KanbanCard[];
  loading: boolean;
  onCardClick: (card: KanbanCard) => void;
}

/**
 * ArchivedDoneSection renders archived cards inside the Done Kanban column.
 * Cards are draggable to allow moving them to active columns.
 */
export function ArchivedDoneSection({
  cards,
  loading,
  onCardClick,
}: ArchivedDoneSectionProps) {
  if (loading) {
    return (
      <div className='flex justify-center py-3 px-2 border-t border-dashed border-border/50'>
        <SpinLoader />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className='px-2 py-3 text-center text-[11px] text-muted-foreground border-t border-dashed border-border/50'>
        No archived cards
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-1.5 px-2 py-2 border-t border-dashed border-border/50'>
      <span className='text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1 pb-0.5'>
        Archived
      </span>
      {cards.map((card) => {
        return (
          <div
            key={card.id}
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
            className='rounded-md border border-dashed border-border/50 bg-card/30 p-2.5 cursor-grab active:cursor-grabbing opacity-60 hover:opacity-80 transition-opacity'
          >
            <Link
              href={`${ROUTES.DASHBOARD.ISSUES}/${issueHrefSegment(card)}`}
              className='block text-xs font-medium text-muted-foreground hover:text-primary leading-snug truncate'
            >
              {card.name}
            </Link>
            {card.close_date ? (
              <span className='text-[10px] text-muted-foreground/60 mt-1 block'>
                Closed {format(new Date(card.close_date), 'MMM d, yyyy')}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
