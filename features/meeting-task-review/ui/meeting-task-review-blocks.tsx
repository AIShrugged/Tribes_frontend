'use client';

import { useState } from 'react';

import { getBlockStyle } from '../model/block-helpers';

import { MeetingTaskReviewBlockItem } from './meeting-task-review-block-item';

import type {
  MeetingTaskReviewBlock,
  MeetingTaskReviewBlockType,
} from '../model/types';

interface MeetingTaskReviewBlocksProps {
  blocks: MeetingTaskReviewBlock[];
}

export function MeetingTaskReviewBlocks({
  blocks,
}: MeetingTaskReviewBlocksProps) {
  const [expanded, setExpanded] = useState<MeetingTaskReviewBlockType | null>(
    null,
  );

  const toggle = (type: MeetingTaskReviewBlockType) => {
    setExpanded((prev) => {
      return prev === type ? null : type;
    });
  };

  return (
    <div className='flex flex-col gap-1.5'>
      {blocks.map((block) => {
        const { Icon, iconClass, badgeClass } = getBlockStyle(block.type);
        const isOpen = expanded === block.type;

        return (
          <div
            key={block.type}
            className='rounded-[var(--radius-card)] border border-border bg-card overflow-hidden'
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
                    <MeetingTaskReviewBlockItem key={issue.id} issue={issue} />
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
