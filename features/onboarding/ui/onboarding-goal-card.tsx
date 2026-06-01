'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { BUTTON_VARIANT } from '@/shared/types/button';
import { Button } from '@/shared/ui/button/Button';
import Input from '@/shared/ui/input/Input';
import Textarea from '@/shared/ui/input/textarea';

import type { EditableGoal } from '../model/types';

interface Props {
  goal: EditableGoal;
  index: number;
  onUpdate: (updated: EditableGoal) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function OnboardingGoalCard({
  goal,
  index,
  onUpdate,
  onRemove,
  disabled,
}: Props) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className='rounded-[var(--radius-card)] border border-border bg-surface/40'>
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        {/* Title zone — click to expand/collapse */}
        <div
          role='button'
          tabIndex={0}
          className='flex flex-1 cursor-pointer items-center gap-2 min-w-0'
          onClick={() => {
            return setExpanded((v) => {
              return !v;
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded((v) => {
                return !v;
              });
            }
          }}
        >
          <span className='text-xs text-muted-foreground shrink-0'>
            #{index + 1}
          </span>
          <span className='text-sm font-medium text-foreground truncate'>
            {goal.title || 'Untitled goal'}
          </span>
        </div>

        {/* Action group: delete | separator | expand chevron */}
        <div className='flex items-center gap-2 shrink-0'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.ghost}
            disabled={disabled}
            aria-label={
              goal.title
                ? `Remove goal ${index + 1}: ${goal.title}`
                : `Remove goal ${index + 1}`
            }
            className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
            onClick={onRemove}
          >
            <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
          </Button>
          <span className='w-px h-4 bg-border shrink-0' aria-hidden='true' />
          <button
            type='button'
            aria-label={expanded ? 'Collapse goal' : 'Expand goal'}
            aria-expanded={expanded}
            onClick={() => {
              return setExpanded((v) => {
                return !v;
              });
            }}
            className='rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
          >
            {expanded ? (
              <ChevronUp className='h-4 w-4' aria-hidden='true' />
            ) : (
              <ChevronDown className='h-4 w-4' aria-hidden='true' />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className='flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3'>
          <Input
            label='Goal title'
            value={goal.title}
            onChange={(e) => {
              return onUpdate({ ...goal, title: e.target.value });
            }}
          />
          <Textarea
            label='Description'
            value={goal.description}
            onChange={(e) => {
              return onUpdate({ ...goal, description: e.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
}
