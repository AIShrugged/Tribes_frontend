'use client';

import { Calendar, ExternalLink, MessageSquare, Paperclip } from 'lucide-react';
import Link from 'next/link';

import { IssueCodeBadge, issueHrefSegment } from '@/entities/issue';
import {
  type KanbanCard,
  KANBAN_COLUMNS,
  TYPE_COLORS,
} from '@/features/kanban/model/types';
import { ROUTES } from '@/shared/lib/routes';
import ModalBody from '@/shared/ui/modal/modal-body';
import ModalFooter from '@/shared/ui/modal/modal-footer';
import ModalHeader from '@/shared/ui/modal/modal-header';
import { ModalRoot } from '@/shared/ui/modal/modal-root';

interface KanbanCardModalProps {
  card: KanbanCard | null;
  onClose: () => void;
}

export function KanbanCardModal({ card, onClose }: KanbanCardModalProps) {
  return (
    <ModalRoot open={card !== null} onClose={onClose}>
      {card && (
        <>
          <ModalHeader title={card.name} onClick={onClose} />
          <ModalBody>
            {(() => {
              const colConfig = KANBAN_COLUMNS.find((col) => {
                return col.id === card.status;
              });
              return colConfig ? (
                <div className='flex items-center gap-1.5 mb-3'>
                  <span
                    className='w-2 h-2 rounded-full flex-shrink-0'
                    style={{ backgroundColor: colConfig.color }}
                  />
                  <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                    {colConfig.label}
                  </span>
                  <IssueCodeBadge code={card.code} id={card.id} />
                </div>
              ) : null;
            })()}

            {card.type ? (
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-3 ${TYPE_COLORS[card.type] ?? 'bg-secondary text-secondary-foreground'}`}
              >
                {card.type}
              </span>
            ) : null}

            {card.description ? (
              <p className='text-xs text-muted-foreground leading-relaxed mb-3'>
                {card.description}
              </p>
            ) : (
              <p className='text-xs text-muted-foreground italic mb-3'>
                No description
              </p>
            )}

            <div className='flex flex-col gap-2'>
              {card.story_points !== null && card.story_points !== undefined ? (
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-muted-foreground'>Story points</span>
                  <span className='font-medium text-foreground'>
                    {card.story_points}
                  </span>
                </div>
              ) : null}

              {card.assignee ? (
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-muted-foreground'>Assignee</span>
                  <span className='font-medium text-foreground truncate max-w-[200px]'>
                    {card.assignee.name}
                  </span>
                </div>
              ) : null}

              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Created</span>
                <span className='flex items-center gap-1 text-muted-foreground'>
                  <Calendar className='h-3 w-3' />
                  {new Date(card.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {card.attachments_count > 0 || card.comments_count > 0 ? (
              <div className='flex items-center gap-3 text-xs text-muted-foreground pt-3 mt-3 border-t border-border/40'>
                {card.attachments_count > 0 ? (
                  <span className='flex items-center gap-1'>
                    <Paperclip className='h-3 w-3' />
                    {card.attachments_count}
                  </span>
                ) : null}
                {card.comments_count > 0 ? (
                  <span className='flex items-center gap-1'>
                    <MessageSquare className='h-3 w-3' />
                    {card.comments_count}
                  </span>
                ) : null}
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Link
              href={`${ROUTES.DASHBOARD.ISSUES}/${issueHrefSegment(card)}`}
              className='flex items-center justify-center gap-1.5 w-full h-8 text-xs font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors'
            >
              <ExternalLink className='h-3 w-3' />
              Open issue
            </Link>
          </ModalFooter>
        </>
      )}
    </ModalRoot>
  );
}
