'use client';

import { Pause, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';

import {
  bulkDeleteReviewIssues,
  bulkPauseReviewIssues,
} from '../api/issue-actions';
import { getBlockStyle } from '../model/block-helpers';

import { MeetingTaskReviewBlockItem } from './meeting-task-review-block-item';

import type {
  MeetingTaskReviewBlock,
  MeetingTaskReviewBlockType,
} from '../model/types';

function sortBlocks(
  blocks: MeetingTaskReviewBlock[],
): MeetingTaskReviewBlock[] {
  return blocks.toSorted((a, b) => {
    if (a.type === 'status_not_updated') return -1;
    if (b.type === 'status_not_updated') return 1;
    return 0;
  });
}

export function MeetingTaskReviewBlocks({
  blocks,
}: {
  blocks: MeetingTaskReviewBlock[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<MeetingTaskReviewBlockType | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);

  const toggle = (type: MeetingTaskReviewBlockType) => {
    setExpanded((prev) => {
      return prev === type ? null : type;
    });
  };

  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkPause = async () => {
    setIsBulkPending(true);
    const result = await bulkPauseReviewIssues([...selectedIds]);
    setIsBulkPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Поставлено на паузу: ${result.data?.pausedCount}`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkPending(true);
    const result = await bulkDeleteReviewIssues([...selectedIds]);
    setIsBulkPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Удалено: ${result.data?.deletedCount}`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const sortedBlocks = sortBlocks(blocks);

  return (
    <div className='flex flex-col gap-1.5'>
      {selectedIds.size > 0 && (
        <div className='flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-2.5'>
          <span className='text-xs text-muted-foreground'>
            Выбрано:{' '}
            <span className='font-medium text-foreground'>
              {selectedIds.size}
            </span>
          </span>
          <div className='flex items-center gap-2'>
            <Button
              size='xs'
              variant='secondary'
              fullWidth={false}
              loading={isBulkPending}
              leftIcon={<Pause className='h-3 w-3' />}
              onClick={handleBulkPause}
            >
              Пауза
            </Button>
            <Button
              size='xs'
              variant='danger'
              fullWidth={false}
              loading={isBulkPending}
              leftIcon={<Trash2 className='h-3 w-3' />}
              onClick={handleBulkDelete}
            >
              Удалить
            </Button>
            <button
              type='button'
              onClick={() => {
                setSelectedIds(new Set());
              }}
              className='text-xs text-muted-foreground hover:text-foreground transition-colors'
            >
              Снять
            </button>
          </div>
        </div>
      )}

      {sortedBlocks.map((block) => {
        const { Icon, iconClass, badgeClass } = getBlockStyle(block.type);
        const isOpen = expanded === block.type;

        return (
          <div
            key={block.type}
            className='rounded-card border border-border bg-card overflow-hidden'
          >
            <button
              type='button'
              onClick={() => {
                return toggle(block.type);
              }}
              className='flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/50'
            >
              <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
              <span className='flex-1 text-sm font-medium text-foreground'>
                {block.label}
              </span>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
              >
                {block.count}
              </span>
            </button>

            {isOpen && block.issues.length > 0 && (
              <div className='border-t border-border bg-background px-4 py-2 flex flex-col gap-1.5'>
                {block.issues.map((issue) => {
                  return (
                    <MeetingTaskReviewBlockItem
                      key={issue.id}
                      issue={issue}
                      selected={selectedIds.has(issue.id)}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
