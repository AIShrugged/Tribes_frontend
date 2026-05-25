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
}

export function OnboardingGoalCard({ goal, index, onUpdate, onRemove }: Props) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className='rounded-[var(--radius-card)] border border-border bg-surface/40'>
      <div
        className='flex items-center justify-between gap-3 px-4 py-3 cursor-pointer'
        onClick={() => {
          return setExpanded((v) => {
            return !v;
          });
        }}
      >
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-xs text-muted-foreground shrink-0'>
            #{index + 1}
          </span>
          <span className='text-sm font-medium text-foreground truncate'>
            {goal.title || 'Untitled goal'}
          </span>
        </div>
        <div className='flex items-center gap-1 shrink-0'>
          <Button
            type='button'
            variant={BUTTON_VARIANT.ghost}
            className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className='h-3.5 w-3.5' />
          </Button>
          {expanded ? (
            <ChevronUp className='h-4 w-4 text-muted-foreground' />
          ) : (
            <ChevronDown className='h-4 w-4 text-muted-foreground' />
          )}
        </div>
      </div>

      {expanded && (
        <div className='flex flex-col gap-3 px-4 pb-4 border-t border-border pt-3'>
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
